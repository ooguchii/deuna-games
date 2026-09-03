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
  DEFAULT_PREVIEW_FPS,
  DEFAULT_PREVIEW_QUALITY,
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
  type PreviewFps,
  type PreviewQualityId,
  type PreviewTrimWindow,
} from "./preview-video-policy";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "./safe-webm";

export {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_BYTES,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
} from "./preview-video-policy";
export type {
  PreviewFps,
  PreviewQualityId,
  PreviewTrimWindow,
} from "./preview-video-policy";

export type PreviewVideoPurpose = "card" | "hero";

const FFMPEG_TIMEOUT_MS = 4 * 60_000;
const FFPROBE_TIMEOUT_MS = 20_000;
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
  cpuUsed: number;
};

type PreviewQualityProfile = {
  width: number;
  preferredBytes: number;
  compression: readonly {
    crf: number;
    cpuUsed: number;
  }[];
};

const qualityProfiles: Record<PreviewQualityId, PreviewQualityProfile> = {
  "720p": {
    width: 1280,
    preferredBytes: 16 * 1024 * 1024,
    compression: [
      { crf: 32, cpuUsed: 4 },
      { crf: 36, cpuUsed: 4 },
      { crf: 40, cpuUsed: 5 },
      { crf: 44, cpuUsed: 5 },
    ],
  },
  "1080p": {
    width: 1920,
    preferredBytes: 24 * 1024 * 1024,
    compression: [
      { crf: 30, cpuUsed: 3 },
      { crf: 34, cpuUsed: 4 },
      { crf: 38, cpuUsed: 4 },
      { crf: 42, cpuUsed: 5 },
      { crf: 45, cpuUsed: 5 },
    ],
  },
};

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

function assertPreviewTrimWindow(trim: PreviewTrimWindow) {
  const normalized = parsePreviewTrimWindow(
    String(trim.startSeconds),
    String(trim.endSeconds)
  );

  if (!normalized || normalized.durationSeconds !== trim.durationSeconds) {
    throw new Error(
      "El recorte del preview no es válido. El tramo debe durar como máximo 30 segundos."
    );
  }
}

async function assertWritableDirectory(directory: string, mode: number) {
  await mkdir(directory, { recursive: true, mode });
  const stats = await lstat(directory);

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(
      "El almacén multimedia no es un directorio seguro."
    );
  }
}

async function assertSafeSourcePath(inputPath: string) {
  const stats = await lstat(inputPath);

  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size <= 0 ||
    stats.size > MAX_PREVIEW_SOURCE_BYTES
  ) {
    throw new Error("El video fuente temporal no es válido.");
  }
}

function ffmpegExecutable() {
  return process.env.DEUNA_FFMPEG_PATH?.trim() || "ffmpeg";
}

function ffprobeExecutable() {
  const configured = process.env.DEUNA_FFPROBE_PATH?.trim();
  if (configured) return configured;

  const ffmpeg = process.env.DEUNA_FFMPEG_PATH?.trim();
  if (!ffmpeg) return "ffprobe";

  const extension = path.extname(ffmpeg);
  const name = path.basename(ffmpeg, extension);
  if (name.toLowerCase() !== "ffmpeg") return "ffprobe";
  return path.join(path.dirname(ffmpeg), `ffprobe${extension}`);
}

function formatFfmpegSeconds(value: number) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function parseRate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  const rate = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : Number(trimmed);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function probeSourceFps(inputPath: string) {
  return new Promise<number>((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=avg_frame_rate,r_frame_rate",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ];
    const child = spawn(
      /* turbopackIgnore: true */ ffprobeExecutable(),
      args,
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => child.kill("SIGKILL"), FFPROBE_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length < 2_000) stdout += chunk.slice(0, 2_000 - stdout.length);
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < 2_000) stderr += chunk.slice(0, 2_000 - stderr.length);
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const code = (error as NodeJS.ErrnoException).code;
      reject(
        code === "ENOENT"
          ? new Error(
              "FFprobe no está disponible. Instálalo junto con FFmpeg o configura DEUNA_FFPROBE_PATH."
            )
          : error
      );
    });

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (signal) {
        reject(new Error("FFprobe excedió el tiempo permitido."));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || "No se pudieron leer los FPS del video fuente."));
        return;
      }
      const rates = stdout
        .split(/\r?\n/)
        .map(parseRate)
        .filter((value): value is number => value !== null);
      const rate = rates[0];
      if (!rate) {
        reject(new Error("El video fuente no informa FPS válidos."));
        return;
      }
      resolve(rate);
    });
  });
}

function buildVideoFilter(preset: PreviewPreset) {
  const fps = Math.round(preset.fps * 1000) / 1000;
  return (
    `scale=w='if(gte(iw,ih),min(${preset.width},iw),-2)':` +
    `h='if(gte(iw,ih),-2,min(${preset.width},ih))':` +
    "force_original_aspect_ratio=decrease:force_divisible_by=2," +
    `fps=${fps}:round=down`
  );
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  preset: PreviewPreset,
  trim: PreviewTrimWindow
) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-ss",
      formatFfmpegSeconds(trim.startSeconds),
      "-i",
      inputPath,
      "-t",
      formatFfmpegSeconds(trim.durationSeconds),
      "-map",
      "0:v:0",
      "-an",
      "-sn",
      "-dn",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-filter_threads",
      "1",
      "-vf",
      buildVideoFilter(preset),
      "-c:v",
      "libvpx-vp9",
      "-crf",
      String(preset.crf),
      "-b:v",
      "0",
      "-deadline",
      "good",
      "-cpu-used",
      String(preset.cpuUsed),
      "-row-mt",
      "1",
      "-g",
      String(Math.max(1, Math.round(preset.fps * 6))),
      "-pix_fmt",
      "yuv420p",
      "-f",
      "webm",
      outputPath,
    ];
    const child = spawn(
      /* turbopackIgnore: true */ ffmpegExecutable(),
      args,
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      }
    );
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < MAX_FFMPEG_ERROR_CHARS) {
        stderr += chunk.slice(0, MAX_FFMPEG_ERROR_CHARS - stderr.length);
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
        reject(new Error("La conversión del preview excedió el tiempo permitido."));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || "FFmpeg no pudo decodificar o convertir el video."));
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
  temporaryDirectory: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId,
  requestedFps: PreviewFps,
  purpose: PreviewVideoPurpose
) {
  assertPreviewTrimWindow(trim);
  await assertSafeSourcePath(inputPath);

  const profile = qualityProfiles[quality];
  const sourceFps = await probeSourceFps(inputPath);
  const effectiveFps = Math.max(
    1,
    Math.round(Math.min(requestedFps, sourceFps) * 1000) / 1000
  );

  for (let index = 0; index < profile.compression.length; index += 1) {
    const compression = profile.compression[index]!;
    const preset: PreviewPreset = {
      width: profile.width,
      fps: effectiveFps,
      crf: compression.crf,
      cpuUsed: compression.cpuUsed,
    };
    const outputPath = path.join(
      temporaryDirectory,
      `preview-${purpose}-${quality}-${requestedFps}fps-${index}.webm`
    );

    await runFfmpeg(inputPath, outputPath, preset, trim);
    const output = await readFile(outputPath);
    const inspection = inspectSafeEditorialWebm(output);
    const isLastPreset = index === profile.compression.length - 1;

    if (inspection && (output.length <= profile.preferredBytes || isLastPreset)) {
      return { buffer: output, inspection, preset };
    }

    if (inspection) continue;
    if (output.length <= MAX_EDITORIAL_PREVIEW_BYTES) {
      throw new Error("El WebM generado no superó la validación multimedia.");
    }
  }

  throw new Error(
    `El master ${quality} a ${requestedFps} FPS supera el límite seguro incluso con compresión alta. Acorta el tramo, usa 720p o reduce FPS.`
  );
}

async function persistConvertedPreview(
  slug: string,
  converted: Awaited<ReturnType<typeof transcodePreview>>
): Promise<EditorialPreviewUploadResult> {
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
    if (!isAlreadyExistsError(error)) throw error;

    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("La ruta multimedia existente no es un archivo seguro.");
    }

    const existing = await readFile(filePath);
    const inspection = inspectSafeEditorialWebm(existing);
    if (!inspection || inspection.digest !== converted.inspection.digest) {
      throw new Error("El archivo multimedia existente no coincide con su hash.");
    }
    reused = true;
  }

  return {
    publicPath: buildEditorialMediaPublicPath(slug, filename),
    digest: converted.inspection.digest,
    bytes: converted.inspection.bytes,
    reused,
    widthLimit: converted.preset.width,
    fps: converted.preset.fps,
  };
}

async function convertSourcePath(
  slug: string,
  inputPath: string,
  temporaryDirectory: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId,
  fps: PreviewFps,
  purpose: PreviewVideoPurpose
) {
  const converted = await transcodePreview(
    inputPath,
    temporaryDirectory,
    trim,
    quality,
    fps,
    purpose
  );
  return persistConvertedPreview(slug, converted);
}

export async function storeEditorialPreviewVideoFromPath(
  slug: string,
  inputPath: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId = DEFAULT_PREVIEW_QUALITY,
  purpose: PreviewVideoPurpose = "card",
  fps: PreviewFps = DEFAULT_PREVIEW_FPS
): Promise<EditorialPreviewUploadResult> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error("La identidad del juego no es válida para multimedia.");
  }

  assertPreviewTrimWindow(trim);
  await assertSafeSourcePath(inputPath);

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "deuna-preview-convert-")
  );

  try {
    return await convertSourcePath(
      slug,
      inputPath,
      temporaryDirectory,
      trim,
      quality,
      fps,
      purpose
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function storeEditorialPreviewVideo(
  slug: string,
  file: File,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId = DEFAULT_PREVIEW_QUALITY,
  purpose: PreviewVideoPurpose = "card",
  fps: PreviewFps = DEFAULT_PREVIEW_FPS
): Promise<EditorialPreviewUploadResult> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error("La identidad del juego no es válida para multimedia.");
  }

  if (!isAcceptedPreviewSource(file)) {
    throw new Error("Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 1 GB.");
  }

  assertPreviewTrimWindow(trim);
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

    return await convertSourcePath(
      slug,
      inputPath,
      temporaryDirectory,
      trim,
      quality,
      fps,
      purpose
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
