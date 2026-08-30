import "server-only";

import {
  createHash,
} from "node:crypto";

export const MAX_EDITORIAL_IMAGE_BYTES =
  6 * 1024 * 1024;

const allowedChunks = new Set([
  "VP8X",
  "VP8 ",
  "VP8L",
  "ALPH",
]);

const forbiddenFeatureFlags =
  0x20 | // perfil ICC
  0x08 | // EXIF
  0x04 | // XMP
  0x02;  // animación

export type SafeWebpInspection = {
  digest: string;
  bytes: number;
};

export function inspectSafeEditorialWebp(
  buffer: Buffer
): SafeWebpInspection | null {
  if (
    buffer.length < 20 ||
    buffer.length > MAX_EDITORIAL_IMAGE_BYTES
  ) {
    return null;
  }

  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const declaredSize = buffer.readUInt32LE(4);

  if (declaredSize + 8 !== buffer.length) {
    return null;
  }

  let cursor = 12;
  let imageChunks = 0;
  let extendedChunks = 0;

  while (cursor < buffer.length) {
    if (cursor + 8 > buffer.length) {
      return null;
    }

    const chunkType = buffer.toString(
      "ascii",
      cursor,
      cursor + 4
    );
    const chunkSize = buffer.readUInt32LE(
      cursor + 4
    );
    const dataStart = cursor + 8;
    const dataEnd = dataStart + chunkSize;
    const paddedEnd =
      dataEnd + (chunkSize % 2);

    if (
      dataEnd > buffer.length ||
      paddedEnd > buffer.length ||
      !allowedChunks.has(chunkType)
    ) {
      return null;
    }

    if (
      chunkType === "VP8 " ||
      chunkType === "VP8L"
    ) {
      imageChunks += 1;
    }

    if (chunkType === "VP8X") {
      extendedChunks += 1;

      if (
        chunkSize !== 10 ||
        extendedChunks > 1
      ) {
        return null;
      }

      const featureFlags = buffer[dataStart];

      if (
        featureFlags === undefined ||
        (featureFlags & forbiddenFeatureFlags) !== 0
      ) {
        return null;
      }
    }

    cursor = paddedEnd;
  }

  if (
    cursor !== buffer.length ||
    imageChunks !== 1
  ) {
    return null;
  }

  return {
    digest: createHash("sha256")
      .update(buffer)
      .digest("hex"),
    bytes: buffer.length,
  };
}
