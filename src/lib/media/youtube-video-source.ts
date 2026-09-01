import "server-only";

import { spawn } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  storeEditorialPreviewVideoFromPath,
  type EditorialPreviewUploadResult,
} from "./editorial-video";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "./preview-video-policy";
import {
  parseYouTubeVideoUrl,
} from "./youtube-url";

const YTDLP_TIMEOUT_MS = 120_000;
const MAX_YTDLP_ERROR_CHARS = 6_000;
const YOUTUBE_DOWNLOAD_RATE = "6M";

let youtubeImportActive = false;

function ytDlpExecutable() {
  return process.env.DEUNA_YTDLP_PATH?.trim() || "yt-dlp";
}

function formatSectionSeconds(value: number) {
  const totalMilliseconds = Math.round(value * 1_000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor(
    (totalMilliseconds % 3_600_000) / 60_000
  );
  const seconds = Math.floor(
    (totalMilliseconds % 60_000) / 1_000
  );
  const milliseconds = totalMilliseconds % 1_000;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    `${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`,
  ].join(":");
}

function normalizedOutputTrim(trim: PreviewTrimWindow) {
  const normalized = parsePreviewTrimWindow(
    "0",
    String(trim.durationSeconds)
  );

  if (!normalized) {
    throw new Error(
      "El recorte de YouTube no es válido."
    );
  }

  return normalized;
}

function classifyYtDlpFailure(stderr: string) {
  const normalized = stderr.toLowerCase();

  if (
    normalized.includes("sign in") ||
    normalized.includes("private video") ||
    normalized.includes("age-restricted") ||
    normalized.includes("members-only") ||
    normalized.includes("unavailable")
  ) {
    return new Error(
      "YouTube no permite importar este video sin autenticación o el video no está disponible públicamente."
    );
  }

  return new Error(
    "No se pudo obtener el tramo seleccionado desde YouTube. Actualiza yt-dlp y vuelve a intentarlo."
  );
}

function runYtDlp(
  canonicalUrl: string,
  temporaryDirectory: string,
  trim: PreviewTrimWindow
) {
  return new Promise<void>((resolve, reject) => {
    const outputTemplate = path.join(
      temporaryDirectory,
      "source.%(ext)s"
    );
    const section =
      `*${formatSectionSeconds(trim.startSeconds)}-${formatSectionSeconds(trim.endSeconds)}`;
    const args = [
      "--no-config",
      "--no-playlist",
      "--max-downloads",
      "1",
      "--concurrent-fragments",
      "1",
      "--limit-rate",
      YOUTUBE_DOWNLOAD_RATE,
      "--retries",
      "2",
      "--fragment-retries",
      "2",
      "--socket-timeout",
      "15",
      "--no-cache-dir",
      "--no-progress",
      "--no-part",
      "--no-mtime",
      "--no-write-subs",
      "--no-write-auto-subs",
      "--no-write-thumbnail",
      "--no-write-info-json",
      "--no-write-playlist-metafiles",
      "--match-filter",
      "duration > 0",
      "--format",
      "bestvideo[height<=480]/best[height<=480]/worstvideo",
      "--download-sections",
      section,
      "--force-keyframes-at-cuts",
      "--max-filesize",
      "64M",
      "--output",
      outputTemplate,
      canonicalUrl,
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
              "yt-dlp no está disponible. Instálalo o configura DEUNA_YTDLP_PATH y reinicia DeUna."
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
            "La importación de YouTube excedió el tiempo permitido."
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
      "YouTube no produjo una única fuente temporal válida."
    );
  }

  const filePath = path.join(
    temporaryDirectory,
    candidates[0]!
  );
  const stats = await lstat(filePath);

  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size <= 0 ||
    stats.size > MAX_PREVIEW_SOURCE_BYTES
  ) {
    throw new Error(
      "El tramo temporal de YouTube no superó la validación de tamaño."
    );
  }

  return filePath;
}

export async function storeEditorialPreviewVideoFromYouTube(
  slug: string,
  value: string,
  trim: PreviewTrimWindow
): Promise<EditorialPreviewUploadResult> {
  const youtube = parseYouTubeVideoUrl(value);
  const normalizedTrim = parsePreviewTrimWindow(
    String(trim.startSeconds),
    String(trim.endSeconds)
  );

  if (!youtube || !normalizedTrim) {
    throw new Error(
      "La URL o el recorte de YouTube no son válidos."
    );
  }

  if (youtubeImportActive) {
    throw new Error(
      "Ya hay una importación de YouTube en curso. Espera a que termine antes de iniciar otra."
    );
  }

  youtubeImportActive = true;
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "deuna-youtube-preview-")
  );

  try {
    await runYtDlp(
      youtube.canonicalUrl,
      temporaryDirectory,
      normalizedTrim
    );
    const sourcePath = await resolveDownloadedSource(
      temporaryDirectory
    );

    return await storeEditorialPreviewVideoFromPath(
      slug,
      sourcePath,
      normalizedOutputTrim(normalizedTrim)
    );
  } finally {
    youtubeImportActive = false;
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}
