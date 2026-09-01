import "server-only";

import { spawn } from "node:child_process";
import {
  lstat,
  rm,
} from "node:fs/promises";

const PROXY_TIMEOUT_MS = 15 * 60 * 1_000;
const MAX_FFMPEG_ERROR_CHARS = 8_000;
export const MAX_EDITORIAL_EDIT_PROXY_BYTES =
  512 * 1024 * 1024;

function ffmpegExecutable() {
  return process.env.DEUNA_FFMPEG_PATH?.trim() || "ffmpeg";
}

export async function createEditorialPreviewProxy(
  inputPath: string,
  outputPath: string
) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
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
    "scale=w='min(320,iw)':h=-2:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=8",
    "-c:v",
    "libvpx-vp9",
    "-deadline",
    "realtime",
    "-cpu-used",
    "8",
    "-row-mt",
    "1",
    "-threads",
    "2",
    "-b:v",
    "250k",
    "-maxrate",
    "300k",
    "-bufsize",
    "600k",
    "-g",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-f",
    "webm",
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
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
    }, PROXY_TIMEOUT_MS);

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
              "FFmpeg no está disponible para crear la vista previa compatible."
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
            "La creación de la vista previa compatible excedió el tiempo permitido."
          )
        );
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              "FFmpeg no pudo crear la vista previa compatible."
          )
        );
        return;
      }

      resolve();
    });
  });

  try {
    const stats = await lstat(outputPath);

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > MAX_EDITORIAL_EDIT_PROXY_BYTES
    ) {
      throw new Error(
        "La vista previa compatible generada no superó la validación de tamaño."
      );
    }

    return {
      filePath: outputPath,
      bytes: stats.size,
      contentType: "video/webm" as const,
    };
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
}
