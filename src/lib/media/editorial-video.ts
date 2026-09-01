import "server-only";

import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildEditorialMediaPublicPath,
  getEditorialMediaRoot,
  isEditorialMediaSlug,
} from "./editorial-media";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "./safe-webm";

export const MAX_PREVIEW_SOURCE_BYTES = 64 * 1024 * 1024;
export const MAX_PREVIEW_DURATION_SECONDS = 30;

const PREFERRED_PREVIEW_BYTES = 1_572_864;
const FFMPEG_TIMEOUT_MS = 90_000;
const MAX_FFMPEG_ERROR_CHARS = 8_000;

const allowedMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
]);

const allowedExtensions = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
]);

type PreviewPreset = {
  width: number;
  fps: number;
  crf: number;
};

const presets: PreviewPreset[] = [
  { width: 400, fps: 15, crf: 41 },
  { width: 360, fps: 12, crf: 44 },
];

export type EditorialPreviewUploadResult = {
  publicPath: string;
  digest: string;
  bytes: number;
  reused: boolean;
  widthLimit: number;
  fps: number;
};

function sourceExtension(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  return allowedExtensions.has(extension) ? extension : ".video";
}

export function isAcceptedPreviewSource(file: File) {
  if (
    file.size <= 0 ||
    file.size > MAX_PREVIEW_SOURCE_BYTES
  ) {
    return false;
  }

  const type = file.type.trim().toLowerCase();
  const extension = path.extname(file.name).toLowerCase();

  return (
    (type.length > 0 && allowedMimeTypes.has(type)) ||
    allowedExtensions.has(extension)
  );
}

async function assertWritableDirectory(
  directory: string,
  mode: number
) {
  await mkdir(directory, {
    recursive: true,
    mode,
  });

  const stats = await lstat(directory);

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(
      "El almacén multimedia no es un directorio seguro."
    );
  }
}

function ffmpegExecutable() {
  return process.env.DEUNA_FFMPEG_PATH?.trim() || "ffmpeg";
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  preset: PreviewPreset
) {
  return new Promise<void>((resolve, reject) => {
    const filter =
      `scale=w='min(${preset.width},iw)':h=-2:` +
      "force_original_aspect_ratio=decrease:force_divisible_by=2," +
      `fps=${preset.fps}`;
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      inputPath,
      "-t",
      String(MAX_PREVIEW_DURATION_SECONDS),
      "-an",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-vf",
      filter,
      "-c:v",
      "libvpx-vp9",
      "-crf",
      String(preset.crf),
      "-b:v",
      "0",
      "-deadline",
      "good",
      "-cpu-used",
      "4",
      "-row-mt",
      "1",
      "-g",
      String(preset.fps * 6),
      "-pix_fmt",
      "yuv420p",
      "-f",
      "webm",
      outputPath,
    ];
    const child = spawn(ffmpegExecutable(), args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < MAX_FFMPEG_ERROR_CHARS) {
        stderr += chunk.slice(
          0,
          MAX_FFMPEG_ERROR_CHARS - stderr.length
        );
      }
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const code = (error as NodeJS.ErrnoException).code;
      reject(
        code === "ENOENT"
          ? new Error(
              "FFmpeg no está disponible. Instálalo o configura DEUNA_FFMPEG_PATH y reinicia DeUna."
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
            "La conversión del preview excedió el tiempo permitido."
          )
        );
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              "FFmpeg no pudo decodificar o convertir el video."
          )
        );
        return;
      }

      resolve();
    });
  });
}

function isAlreadyExistsError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

async function transcodePreview(
  inputPath: string,
  temporaryDirectory: string
) {
  for (let index = 0; index < presets.length; index += 1) {
    const preset = presets[index]!;
    const outputPath = path.join(
      temporaryDirectory,
      `preview-${index}.webm`
    );

    await runFfmpeg(inputPath, outputPath, preset);

    const output = await readFile(outputPath);
    const inspection = inspectSafeEditorialWebm(output);
    const isLastPreset = index === presets.length - 1;

    if (
      inspection &&
      (output.length <= PREFERRED_PREVIEW_BYTES || isLastPreset)
    ) {
      return {
        buffer: output,
        inspection,
        preset,
      };
    }

    if (inspection) {
      continue;
    }

    if (output.length <= MAX_EDITORIAL_PREVIEW_BYTES) {
      throw new Error(
        "El WebM generado no superó la validación multimedia."
      );
    }
  }

  throw new Error(
    "El preview sigue siendo demasiado pesado después de optimizarlo. Usa un fragmento con menos movimiento o menor resolución de origen."
  );
}

export async function storeEditorialPreviewVideo(
  slug: string,
  file: File
): Promise<EditorialPreviewUploadResult> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error(
      "La identidad del juego no es válida para multimedia."
    );
  }

  if (!isAcceptedPreviewSource(file)) {
    throw new Error(
      "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB."
    );
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "deuna-preview-")
  );

  try {
    const inputPath = path.join(
      temporaryDirectory,
      `source${sourceExtension(file)}`
    );
    await writeFile(
      inputPath,
      Buffer.from(await file.arrayBuffer()),
      { flag: "wx", mode: 0o600 }
    );

    const converted = await transcodePreview(
      inputPath,
      temporaryDirectory
    );
    const filename = `${converted.inspection.digest}.webm`;
    const root = getEditorialMediaRoot();
    const gameDirectory = path.join(root, slug);
    const filePath = path.join(gameDirectory, filename);

    await assertWritableDirectory(root, 0o750);
    await assertWritableDirectory(gameDirectory, 0o750);

    let reused = false;

    try {
      await writeFile(filePath, converted.buffer, {
        flag: "wx",
        mode: 0o640,
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const stats = await lstat(filePath);

      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(
          "La ruta multimedia existente no es un archivo seguro."
        );
      }

      const existing = await readFile(filePath);
      const inspection = inspectSafeEditorialWebm(existing);

      if (
        !inspection ||
        inspection.digest !== converted.inspection.digest
      ) {
        throw new Error(
          "El archivo multimedia existente no coincide con su hash."
        );
      }

      reused = true;
    }

    return {
      publicPath: buildEditorialMediaPublicPath(
        slug,
        filename
      ),
      digest: converted.inspection.digest,
      bytes: converted.inspection.bytes,
      reused,
      widthLimit: converted.preset.width,
      fps: converted.preset.fps,
    };
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}
