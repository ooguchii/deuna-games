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
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
  parsePreviewViewport,
  type PreviewQualityId,
  type PreviewTrimWindow,
  type PreviewViewport,
  type PreviewViewportAspectId,
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
  PreviewQualityId,
  PreviewTrimWindow,
  PreviewViewport,
} from "./preview-video-policy";

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
  cpuUsed: number;
};

type PreviewQualityProfile = {
  preferredBytes: number;
  presets: readonly PreviewPreset[];
};

const qualityProfiles: Record<
  PreviewQualityId,
  PreviewQualityProfile
> = {
  performance: {
    preferredBytes: 1_048_576,
    presets: [
      { width: 360, fps: 12, crf: 44, cpuUsed: 6 },
      { width: 320, fps: 10, crf: 46, cpuUsed: 6 },
    ],
  },
  balanced: {
    preferredBytes: 1_572_864,
    presets: [
      { width: 480, fps: 15, crf: 41, cpuUsed: 5 },
      { width: 360, fps: 12, crf: 44, cpuUsed: 6 },
    ],
  },
  high: {
    // Alta acepta el primer encode seguro por debajo del límite duro. Sólo
    // reintenta si realmente supera 3 MB, evitando codificaciones redundantes.
    preferredBytes: MAX_EDITORIAL_PREVIEW_BYTES,
    presets: [
      { width: 640, fps: 20, crf: 38, cpuUsed: 4 },
      { width: 480, fps: 15, crf: 41, cpuUsed: 5 },
      { width: 360, fps: 12, crf: 44, cpuUsed: 6 },
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

function assertPreviewTrimWindow(
  trim: PreviewTrimWindow
) {
  const normalized = parsePreviewTrimWindow(
    String(trim.startSeconds),
    String(trim.endSeconds)
  );

  if (
    !normalized ||
    normalized.durationSeconds !== trim.durationSeconds
  ) {
    throw new Error(
      "El recorte del preview no es válido. El tramo debe durar como máximo 30 segundos."
    );
  }
}

function assertPreviewViewport(
  viewport: PreviewViewport
) {
  const normalized = parsePreviewViewport(
    String(viewport.x),
    String(viewport.y),
    String(viewport.zoom),
    viewport.aspect
  );

  if (
    !normalized ||
    normalized.x !== viewport.x ||
    normalized.y !== viewport.y ||
    normalized.zoom !== viewport.zoom ||
    normalized.aspect !== viewport.aspect
  ) {
    throw new Error(
      "El encuadre del preview no es válido."
    );
  }
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

async function assertSafeSourcePath(inputPath: string) {
  const stats = await lstat(inputPath);

  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size <= 0 ||
    stats.size > MAX_PREVIEW_SOURCE_BYTES
  ) {
    throw new Error(
      "El video fuente temporal no es válido."
    );
  }
}

function ffmpegExecutable() {
  return process.env.DEUNA_FFMPEG_PATH?.trim() || "ffmpeg";
}

function formatFfmpegSeconds(value: number) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatFilterNumber(value: number) {
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function viewportAspectRatio(
  aspect: PreviewViewportAspectId
) {
  if (aspect === "16:9") return 16 / 9;
  if (aspect === "1:1") return 1;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "9:16") return 9 / 16;
  return null;
}

function buildViewportCropFilter(
  viewport: PreviewViewport
) {
  const noSpatialCrop =
    viewport.aspect === "source" &&
    viewport.zoom === 1;
  if (noSpatialCrop) return null;

  const x = formatFilterNumber(viewport.x);
  const y = formatFilterNumber(viewport.y);
  const zoom = formatFilterNumber(viewport.zoom);
  const ratio = viewportAspectRatio(viewport.aspect);

  const widthExpression = ratio === null
    ? `max(2,trunc(iw/${zoom}/2)*2)`
    : `max(2,trunc(min(iw,ih*${formatFilterNumber(ratio)})/${zoom}/2)*2)`;
  const heightExpression = ratio === null
    ? `max(2,trunc(ih/${zoom}/2)*2)`
    : `max(2,trunc(min(ih,iw/${formatFilterNumber(ratio)})/${zoom}/2)*2)`;

  return (
    `crop=w='${widthExpression}':h='${heightExpression}':` +
    `x='(iw-ow)*${x}':y='(ih-oh)*${y}'`
  );
}

function buildVideoFilter(
  preset: PreviewPreset,
  viewport: PreviewViewport
) {
  const crop = buildViewportCropFilter(viewport);
  const filters = crop ? [crop] : [];
  // `preset.width` representa el lado mayor objetivo. Así un encuadre 9:16
  // en calidad Alta termina como 360x640 en lugar de conservar 1080 px de alto.
  filters.push(
    `scale=w='if(gte(iw,ih),min(${preset.width},iw),-2)':` +
      `h='if(gte(iw,ih),-2,min(${preset.width},ih))':` +
      "force_original_aspect_ratio=decrease:force_divisible_by=2"
  );
  filters.push(`fps=${preset.fps}`);
  return filters.join(",");
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  preset: PreviewPreset,
  trim: PreviewTrimWindow,
  viewport: PreviewViewport
) {
  return new Promise<void>((resolve, reject) => {
    const filter = buildVideoFilter(preset, viewport);
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
      String(preset.cpuUsed),
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
  temporaryDirectory: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId,
  viewport: PreviewViewport
) {
  assertPreviewTrimWindow(trim);
  assertPreviewViewport(viewport);
  await assertSafeSourcePath(inputPath);

  const profile = qualityProfiles[quality];

  for (let index = 0; index < profile.presets.length; index += 1) {
    const preset = profile.presets[index]!;
    const outputPath = path.join(
      temporaryDirectory,
      `preview-${quality}-${index}.webm`
    );

    await runFfmpeg(
      inputPath,
      outputPath,
      preset,
      trim,
      viewport
    );

    const output = await readFile(outputPath);
    const inspection = inspectSafeEditorialWebm(output);
    const isLastPreset = index === profile.presets.length - 1;

    if (
      inspection &&
      (output.length <= profile.preferredBytes || isLastPreset)
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
    "El preview sigue siendo demasiado pesado después de reducir automáticamente su calidad. Usa un fragmento con menos movimiento, un tramo más corto o el perfil Ligera."
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
}

async function convertSourcePath(
  slug: string,
  inputPath: string,
  temporaryDirectory: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId,
  viewport: PreviewViewport
) {
  const converted = await transcodePreview(
    inputPath,
    temporaryDirectory,
    trim,
    quality,
    viewport
  );

  return persistConvertedPreview(slug, converted);
}

export async function storeEditorialPreviewVideoFromPath(
  slug: string,
  inputPath: string,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId = DEFAULT_PREVIEW_QUALITY,
  viewport: PreviewViewport = DEFAULT_PREVIEW_VIEWPORT
): Promise<EditorialPreviewUploadResult> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error(
      "La identidad del juego no es válida para multimedia."
    );
  }

  assertPreviewTrimWindow(trim);
  assertPreviewViewport(viewport);
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
      viewport
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}

export async function storeEditorialPreviewVideo(
  slug: string,
  file: File,
  trim: PreviewTrimWindow,
  quality: PreviewQualityId = DEFAULT_PREVIEW_QUALITY,
  viewport: PreviewViewport = DEFAULT_PREVIEW_VIEWPORT
): Promise<EditorialPreviewUploadResult> {
  if (!isEditorialMediaSlug(slug)) {
    throw new Error(
      "La identidad del juego no es válida para multimedia."
    );
  }

  if (!isAcceptedPreviewSource(file)) {
    throw new Error(
      "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 1 GB."
    );
  }

  assertPreviewTrimWindow(trim);
  assertPreviewViewport(viewport);

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
      viewport
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}
