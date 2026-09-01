import "server-only";

import { spawn } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  downloadViaMediaImportWorker,
  mediaImportWorkerConfigured,
  requireRemoteImportWorkerInProduction,
} from "./media-import-worker-client";
import {
  parseSupportedPlatformVideoUrl,
} from "./platform-video-url";
import {
  MAX_PREVIEW_SOURCE_BYTES,
} from "./preview-video-policy";
import type {
  RemoteEditorialVideo,
} from "./remote-video-source";

const MAX_PLATFORM_STAGE_BYTES = Math.min(
  MAX_PREVIEW_SOURCE_BYTES,
  512 * 1024 * 1024
);
const YTDLP_TIMEOUT_MS = 10 * 60 * 1_000;
const MAX_YTDLP_ERROR_CHARS = 8_000;
const PLATFORM_DOWNLOAD_RATE = "8M";
const YTDLP_JS_RUNTIME =
  process.env.DEUNA_YTDLP_JS_RUNTIME?.trim() || "node";

let platformImportActive = false;

function ytDlpExecutable() {
  return process.env.DEUNA_YTDLP_PATH?.trim() || "yt-dlp";
}

function contentTypeFromFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".mp4" || extension === ".m4v") {
    return "video/mp4";
  }
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";

  return "application/octet-stream";
}

function classifyYtDlpFailure(stderr: string) {
  const normalized = stderr.toLowerCase();

  if (
    normalized.includes("no supported javascript runtime") ||
    normalized.includes("javascript runtime") &&
      normalized.includes("unavailable") ||
    normalized.includes("challenge solving failed")
  ) {
    return new Error(
      "YouTube requiere un runtime JavaScript compatible. DeUna usa Node automáticamente; confirma Node 22 o superior en el mismo entorno donde ejecutas npm run dev."
    );
  }

  if (
    normalized.includes("sign in") ||
    normalized.includes("login") ||
    normalized.includes("private") ||
    normalized.includes("age-restricted") ||
    normalized.includes("members-only") ||
    normalized.includes("not available") ||
    normalized.includes("unavailable")
  ) {
    return new Error(
      "La plataforma no permite importar este video sin iniciar sesión, o el contenido no es público."
    );
  }

  if (
    normalized.includes("unsupported url") ||
    normalized.includes("no suitable extractor")
  ) {
    return new Error(
      "Ese enlace pertenece a una plataforma reconocida, pero yt-dlp no pudo extraer el video. Actualiza yt-dlp y vuelve a intentarlo."
    );
  }

  if (
    normalized.includes("max-filesize") ||
    normalized.includes("file is larger")
  ) {
    return new Error(
      "La copia liviana necesaria para recortar ese video supera 512 MB. Prueba con un video más corto o una URL directa al archivo."
    );
  }

  return new Error(
    "No se pudo obtener el video público desde la plataforma. Comprueba el enlace y mantén yt-dlp actualizado."
  );
}

function runYtDlp(
  sourceUrl: string,
  temporaryDirectory: string
) {
  return new Promise<void>((resolve, reject) => {
    const outputTemplate = path.join(
      temporaryDirectory,
      "source.%(ext)s"
    );
    const args = [
      "--no-config",
      "--js-runtimes",
      YTDLP_JS_RUNTIME,
      "--no-playlist",
      "--max-downloads",
      "1",
      "--concurrent-fragments",
      "1",
      "--limit-rate",
      PLATFORM_DOWNLOAD_RATE,
      "--retries",
      "2",
      "--fragment-retries",
      "2",
      "--socket-timeout",
      "20",
      "--no-cache-dir",
      "--no-progress",
      "--no-part",
      "--no-mtime",
      "--no-write-subs",
      "--no-write-auto-subs",
      "--no-write-thumbnail",
      "--no-write-info-json",
      "--no-write-playlist-metafiles",
      "--format",
      "best[height<=480][vcodec^=avc1][ext=mp4]/best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst",
      "--max-filesize",
      "512M",
      "--output",
      outputTemplate,
      sourceUrl,
    ];
    const child = spawn(ytDlpExecutable(), args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, YTDLP_TIMEOUT_MS);

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length >= MAX_YTDLP_ERROR_CHARS) return;
      stderr += chunk.slice(
        0,
        MAX_YTDLP_ERROR_CHARS - stderr.length
      );
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const code = (error as NodeJS.ErrnoException).code;
      reject(
        code === "ENOENT"
          ? new Error(
              "yt-dlp no está disponible. Instálalo o configura DEUNA_YTDLP_PATH para importar YouTube, Facebook y otras plataformas."
            )
          : error
      );
    });

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (signal) {
        reject(
          new Error(
            "La importación desde la plataforma excedió el tiempo permitido."
          )
        );
        return;
      }

      if (code !== 0) {
        reject(classifyYtDlpFailure(stderr));
        return;
      }

      resolve();
    });
  });
}

async function resolveDownloadedSource(
  temporaryDirectory: string
) {
  const entries = await readdir(temporaryDirectory);
  const candidates = entries.filter(
    (entry) =>
      entry.startsWith("source.") &&
      !entry.endsWith(".part") &&
      !entry.endsWith(".ytdl") &&
      !entry.endsWith(".json")
  );

  if (candidates.length !== 1) {
    throw new Error(
      "La plataforma no produjo una única fuente temporal válida."
    );
  }

  const filename = candidates[0]!;
  const filePath = path.join(
    temporaryDirectory,
    filename
  );
  const stats = await lstat(filePath);

  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size <= 0 ||
    stats.size > MAX_PLATFORM_STAGE_BYTES
  ) {
    throw new Error(
      "La copia temporal de la plataforma no superó la validación de tamaño."
    );
  }

  return {
    filePath,
    filename,
    bytes: stats.size,
  };
}

async function downloadDirectlyForDevelopment(
  sourceUrl: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  const temporaryDirectory = await mkdtemp(
    path.join(
      path.dirname(destinationPath),
      ".deuna-platform-"
    )
  );

  try {
    await runYtDlp(sourceUrl, temporaryDirectory);
    const downloaded = await resolveDownloadedSource(
      temporaryDirectory
    );

    await rename(downloaded.filePath, destinationPath);

    return {
      bytes: downloaded.bytes,
      contentType: contentTypeFromFilename(
        downloaded.filename
      ),
      sourceUrl,
    };
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}

export async function downloadPlatformEditorialVideo(
  value: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  const platform = parseSupportedPlatformVideoUrl(value);

  if (!platform) {
    throw new Error(
      "El enlace no pertenece a una plataforma de video compatible."
    );
  }

  if (platformImportActive) {
    throw new Error(
      "Ya hay una importación de plataforma en curso. Espera a que termine antes de iniciar otra."
    );
  }

  requireRemoteImportWorkerInProduction();
  platformImportActive = true;

  try {
    if (mediaImportWorkerConfigured()) {
      const worker = await downloadViaMediaImportWorker(
        {
          kind: "platform",
          url: platform.url,
        },
        destinationPath
      );

      if (
        worker.bytes <= 0 ||
        worker.bytes > MAX_PLATFORM_STAGE_BYTES
      ) {
        throw new Error(
          "El worker multimedia produjo una copia de plataforma fuera del límite permitido."
        );
      }

      return {
        bytes: worker.bytes,
        contentType: worker.contentType,
        sourceUrl: worker.sourceUrl || platform.url,
      };
    }

    return await downloadDirectlyForDevelopment(
      platform.url,
      destinationPath
    );
  } finally {
    platformImportActive = false;
  }
}

export const MAX_PLATFORM_PREVIEW_SOURCE_BYTES =
  MAX_PLATFORM_STAGE_BYTES;
