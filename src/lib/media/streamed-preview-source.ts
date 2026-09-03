import "server-only";

import { createWriteStream } from "node:fs";
import {
  lstat,
  mkdtemp,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  MAX_PREVIEW_SOURCE_BYTES,
} from "./preview-video-policy";

const allowedMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
  "application/octet-stream",
]);

const allowedExtensions = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
]);

export function isAcceptedStreamedPreviewSource(
  filename: string,
  contentType: string,
  contentLength: number | null
) {
  if (
    contentLength !== null &&
    (
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > MAX_PREVIEW_SOURCE_BYTES
    )
  ) {
    return false;
  }

  const type = contentType
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";
  const extension = path
    .extname(filename.trim())
    .toLowerCase();

  if (!allowedMimeTypes.has(type)) {
    return false;
  }

  return (
    type !== "application/octet-stream" ||
    allowedExtensions.has(extension)
  );
}

export async function stageStreamedPreviewSource(
  body: ReadableStream<Uint8Array>,
  expectedBytes: number | null
) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "deuna-preview-upload-")
  );
  const filePath = path.join(directory, "source.video");
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;

      if (
        total > MAX_PREVIEW_SOURCE_BYTES ||
        (expectedBytes !== null && total > expectedBytes)
      ) {
        callback(
          new Error(
            "El video fuente supera el límite permitido de 1 GB."
          )
        );
        return;
      }

      callback(null, chunk);
    },
  });
  const input = Readable.from(
    body as unknown as AsyncIterable<Uint8Array>
  );
  const output = createWriteStream(filePath, {
    flags: "wx",
    mode: 0o600,
  });

  try {
    await pipeline(input, limiter, output);

    if (total <= 0) {
      throw new Error("El video fuente está vacío.");
    }

    if (expectedBytes !== null && total !== expectedBytes) {
      throw new Error(
        "La carga del video fuente quedó incompleta."
      );
    }

    const stats = await lstat(filePath);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size !== total ||
      stats.size > MAX_PREVIEW_SOURCE_BYTES
    ) {
      throw new Error(
        "El video fuente temporal no superó la validación de almacenamiento."
      );
    }

    return {
      directory,
      filePath,
      bytes: total,
    };
  } catch (error) {
    await rm(directory, {
      recursive: true,
      force: true,
    });
    throw error;
  }
}
