import "server-only";

import { spawn } from "node:child_process";
import { lstat, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  downloadViaMediaImportWorker,
  mediaImportWorkerConfigured,
  requireRemoteImportWorkerInProduction,
} from "./media-import-worker-client";
import {
  getPreviewProvider,
  parsePreviewProviderUrl,
  type PreviewProviderId,
} from "./preview-providers";
import { MAX_PREVIEW_SOURCE_BYTES } from "./preview-video-policy";
import type { RemoteEditorialVideo } from "./remote-video-source";

const MAX_PLATFORM_STAGE_BYTES = Math.min(MAX_PREVIEW_SOURCE_BYTES, 512 * 1024 * 1024);
const YTDLP_TIMEOUT_MS = 10 * 60 * 1_000;
const MAX_YTDLP_ERROR_CHARS = 8_000;
const PLATFORM_DOWNLOAD_RATE = "8M";
const YTDLP_JS_RUNTIME = process.env.DEUNA_YTDLP_JS_RUNTIME?.trim() || "node";
const YTDLP_REMOTE_COMPONENT = process.env.DEUNA_YTDLP_REMOTE_COMPONENT?.trim() || "ejs:github";
const YTDLP_COOKIES_FILE = process.env.DEUNA_YTDLP_COOKIES_FILE?.trim() || "";

function configuredYouTubeClients() {
  const configured = process.env.DEUNA_YTDLP_YOUTUBE_CLIENTS?.trim() ?? "";
  if (!configured || configured.toLowerCase() === "auto" || configured.toLowerCase() === "default,web_embedded") {
    return "web_embedded,default";
  }
  return configured;
}

const YOUTUBE_PUBLIC_CLIENTS = configuredYouTubeClients();
const YTDLP_DIAGNOSTICS = process.env.DEUNA_YTDLP_DIAGNOSTICS?.trim() === "1" || process.env.NODE_ENV !== "production";
let platformImportActive = false;

function ytDlpExecutable() {
  return process.env.DEUNA_YTDLP_PATH?.trim() || "yt-dlp";
}

function contentTypeFromFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".mp4" || extension === ".m4v") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";
  return "application/octet-stream";
}

function classifyYtDlpFailure(stderr: string, provider: PreviewProviderId) {
  const normalized = stderr.toLowerCase();
  const label = getPreviewProvider(provider).label;

  if (provider === "youtube" && (normalized.includes("http error 429") || normalized.includes("too many requests"))) {
    return new Error("YouTube bloqueó temporalmente esta IP (HTTP 429). Evita reintentos repetidos y vuelve a probar después o desde otra IP.");
  }
  if (provider === "youtube" && (normalized.includes("captcha") || normalized.includes("sign in to confirm"))) {
    return new Error("YouTube activó una verificación anti-bot. Mantén yt-dlp actualizado y, si la IP exige Proof-of-Origin, configura un PO Token Provider o una sesión autorizada.");
  }
  if (normalized.includes("private") || normalized.includes("members-only")) {
    return new Error(`${label} no permite importar este contenido porque es privado o exclusivo para miembros.`);
  }
  if (normalized.includes("sign in") || normalized.includes("login") || normalized.includes("unavailable") || normalized.includes("not available")) {
    return new Error(`${label} no entregó un stream público descargable para este enlace.`);
  }
  if (normalized.includes("unsupported url") || normalized.includes("no suitable extractor")) {
    return new Error(`El enlace pertenece a ${label}, pero el extractor no reconoce ese formato. Actualiza yt-dlp y vuelve a intentarlo.`);
  }
  if (normalized.includes("max-filesize") || normalized.includes("file is larger")) {
    return new Error(`La copia temporal de ${label} supera 512 MB.`);
  }
  return new Error(`No se pudo obtener el video público desde ${label}. Revisa el diagnóstico de yt-dlp.`);
}

function platformSpecificArgs(provider: PreviewProviderId) {
  if (provider !== "youtube") return [];
  return ["--extractor-args", `youtube:player_client=${YOUTUBE_PUBLIC_CLIENTS}`];
}

function runYtDlp(provider: PreviewProviderId, sourceUrl: string, temporaryDirectory: string) {
  return new Promise<void>((resolve, reject) => {
    const outputTemplate = path.join(temporaryDirectory, "source.%(ext)s");
    const args = [
      "--no-config",
      "--js-runtimes", YTDLP_JS_RUNTIME,
      "--remote-components", YTDLP_REMOTE_COMPONENT,
      ...(YTDLP_COOKIES_FILE ? ["--cookies", YTDLP_COOKIES_FILE] : []),
      ...platformSpecificArgs(provider),
      "--no-playlist",
      "--max-downloads", "1",
      "--concurrent-fragments", "1",
      "--limit-rate", PLATFORM_DOWNLOAD_RATE,
      "--retries", "2",
      "--fragment-retries", "2",
      "--socket-timeout", "20",
      "--no-cache-dir",
      "--no-progress",
      "--no-part",
      "--no-mtime",
      "--no-write-subs",
      "--no-write-auto-subs",
      "--no-write-thumbnail",
      "--no-write-info-json",
      "--no-write-playlist-metafiles",
      "--format", "best[height<=480][vcodec^=avc1][ext=mp4]/best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst",
      "--max-filesize", "512M",
      "--output", outputTemplate,
      sourceUrl,
    ];
    const child = spawn(ytDlpExecutable(), args, { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) child.kill("SIGKILL");
    }, YTDLP_TIMEOUT_MS);

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < MAX_YTDLP_ERROR_CHARS) stderr += chunk.slice(0, MAX_YTDLP_ERROR_CHARS - stderr.length);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const code = (error as NodeJS.ErrnoException).code;
      reject(code === "ENOENT" ? new Error("yt-dlp no está disponible. Instálalo o configura DEUNA_YTDLP_PATH.") : error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (signal) return reject(new Error("La importación desde la plataforma excedió el tiempo permitido."));
      if (code !== 0) {
        if (YTDLP_DIAGNOSTICS && stderr.trim()) console.error(`[media-import:${provider}] ${stderr.slice(-MAX_YTDLP_ERROR_CHARS)}`);
        return reject(classifyYtDlpFailure(stderr, provider));
      }
      resolve();
    });
  });
}

async function resolveDownloadedSource(temporaryDirectory: string) {
  const entries = await readdir(temporaryDirectory);
  const candidates = entries.filter((entry) => entry.startsWith("source.") && !entry.endsWith(".part") && !entry.endsWith(".ytdl") && !entry.endsWith(".json"));
  if (candidates.length !== 1) throw new Error("La plataforma no produjo una única fuente temporal válida.");
  const filename = candidates[0]!;
  const filePath = path.join(temporaryDirectory, filename);
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > MAX_PLATFORM_STAGE_BYTES) {
    throw new Error("La copia temporal de la plataforma no superó la validación de tamaño.");
  }
  return { filePath, filename, bytes: stats.size };
}

async function downloadDirectlyForDevelopment(
  provider: PreviewProviderId,
  sourceUrl: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  const temporaryDirectory = await mkdtemp(path.join(path.dirname(destinationPath), ".deuna-platform-"));
  try {
    await runYtDlp(provider, sourceUrl, temporaryDirectory);
    const downloaded = await resolveDownloadedSource(temporaryDirectory);
    await rename(downloaded.filePath, destinationPath);
    return {
      bytes: downloaded.bytes,
      contentType: contentTypeFromFilename(downloaded.filename),
      sourceUrl,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function downloadPlatformEditorialVideo(
  provider: PreviewProviderId,
  value: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  const normalized = parsePreviewProviderUrl(provider, value);
  if (!normalized) {
    throw new Error(`La URL no pertenece al proveedor seleccionado: ${getPreviewProvider(provider).label}.`);
  }
  if (platformImportActive) throw new Error("Ya hay una importación de plataforma en curso. Espera a que termine antes de iniciar otra.");

  requireRemoteImportWorkerInProduction();
  platformImportActive = true;
  try {
    if (mediaImportWorkerConfigured()) {
      const worker = await downloadViaMediaImportWorker({ kind: "platform", provider, url: normalized }, destinationPath);
      if (worker.bytes <= 0 || worker.bytes > MAX_PLATFORM_STAGE_BYTES) {
        throw new Error("El worker multimedia produjo una copia de plataforma fuera del límite permitido.");
      }
      return {
        bytes: worker.bytes,
        contentType: worker.contentType,
        sourceUrl: worker.sourceUrl || normalized,
      };
    }
    return await downloadDirectlyForDevelopment(provider, normalized, destinationPath);
  } finally {
    platformImportActive = false;
  }
}

export const MAX_PLATFORM_PREVIEW_SOURCE_BYTES = MAX_PLATFORM_STAGE_BYTES;
