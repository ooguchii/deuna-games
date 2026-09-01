import {
  createHash,
} from "node:crypto";

export const MAX_EDITORIAL_IMAGE_BYTES =
  6 * 1024 * 1024;
export const MAX_EDITORIAL_IMAGE_DIMENSION =
  8_192;
export const MAX_EDITORIAL_IMAGE_PIXELS =
  33_554_432;

const allowedChunks = new Set([
  "VP8X",
  "VP8 ",
  "VP8L",
  "ALPH",
]);
const removableMetadataChunks = new Set([
  "ICCP",
  "EXIF",
  "XMP ",
]);
const metadataFlagMask =
  0x20 | // ICC profile
  0x08 | // EXIF
  0x04; // XMP

export type SafeWebpInspection = {
  digest: string;
  bytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
};

type Dimensions = {
  width: number;
  height: number;
};

function dimensionsAreSafe({
  width,
  height,
}: Dimensions) {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_EDITORIAL_IMAGE_DIMENSION &&
    height <= MAX_EDITORIAL_IMAGE_DIMENSION &&
    width * height <= MAX_EDITORIAL_IMAGE_PIXELS
  );
}

function readUInt24LE(
  buffer: Buffer,
  offset: number
) {
  return (
    buffer[offset]! |
    (buffer[offset + 1]! << 8) |
    (buffer[offset + 2]! << 16)
  );
}

function inspectVp8(
  buffer: Buffer,
  dataStart: number,
  chunkSize: number
): Dimensions | null {
  if (chunkSize < 10) return null;

  const frameTag =
    buffer[dataStart]! |
    (buffer[dataStart + 1]! << 8) |
    (buffer[dataStart + 2]! << 16);

  if ((frameTag & 1) !== 0) {
    return null;
  }

  if (
    buffer[dataStart + 3] !== 0x9d ||
    buffer[dataStart + 4] !== 0x01 ||
    buffer[dataStart + 5] !== 0x2a
  ) {
    return null;
  }

  const dimensions = {
    width:
      buffer.readUInt16LE(dataStart + 6) &
      0x3fff,
    height:
      buffer.readUInt16LE(dataStart + 8) &
      0x3fff,
  };

  return dimensionsAreSafe(dimensions)
    ? dimensions
    : null;
}

function inspectVp8l(
  buffer: Buffer,
  dataStart: number,
  chunkSize: number
): {
  dimensions: Dimensions;
  alpha: boolean;
} | null {
  if (
    chunkSize < 5 ||
    buffer[dataStart] !== 0x2f
  ) {
    return null;
  }

  const bits = buffer.readUInt32LE(
    dataStart + 1
  );
  const version = bits >>> 29;

  if (version !== 0) return null;

  const dimensions = {
    width: (bits & 0x3fff) + 1,
    height: ((bits >>> 14) & 0x3fff) + 1,
  };

  if (!dimensionsAreSafe(dimensions)) {
    return null;
  }

  return {
    dimensions,
    alpha: ((bits >>> 28) & 1) === 1,
  };
}

function inspectVp8x(
  buffer: Buffer,
  dataStart: number,
  chunkSize: number
): {
  dimensions: Dimensions;
  alpha: boolean;
} | null {
  if (chunkSize !== 10) return null;

  const featureFlags = buffer[dataStart];

  if (
    featureFlags === undefined ||
    (featureFlags & ~0x10) !== 0 ||
    buffer[dataStart + 1] !== 0 ||
    buffer[dataStart + 2] !== 0 ||
    buffer[dataStart + 3] !== 0
  ) {
    return null;
  }

  const dimensions = {
    width:
      readUInt24LE(buffer, dataStart + 4) + 1,
    height:
      readUInt24LE(buffer, dataStart + 7) + 1,
  };

  if (!dimensionsAreSafe(dimensions)) {
    return null;
  }

  return {
    dimensions,
    alpha: (featureFlags & 0x10) !== 0,
  };
}

function hasValidRiffEnvelope(buffer: Buffer) {
  if (
    buffer.length < 20 ||
    buffer.length > MAX_EDITORIAL_IMAGE_BYTES ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return false;
  }

  return buffer.readUInt32LE(4) + 8 === buffer.length;
}

export function inspectSafeEditorialWebp(
  buffer: Buffer
): SafeWebpInspection | null {
  if (!hasValidRiffEnvelope(buffer)) {
    return null;
  }

  let cursor = 12;
  let chunkIndex = 0;
  let imageChunks = 0;
  let alphaChunks = 0;
  let imageType: "VP8 " | "VP8L" | null = null;
  let imageDimensions: Dimensions | null = null;
  let canvasDimensions: Dimensions | null = null;
  let extendedAlpha = false;
  let losslessAlpha = false;

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

    if (chunkType === "VP8X") {
      if (chunkIndex !== 0 || canvasDimensions) {
        return null;
      }

      const extended = inspectVp8x(
        buffer,
        dataStart,
        chunkSize
      );

      if (!extended) return null;

      canvasDimensions = extended.dimensions;
      extendedAlpha = extended.alpha;
    } else if (chunkType === "ALPH") {
      alphaChunks += 1;

      if (
        alphaChunks > 1 ||
        imageChunks > 0 ||
        !canvasDimensions ||
        !extendedAlpha ||
        chunkSize === 0
      ) {
        return null;
      }
    } else if (chunkType === "VP8 ") {
      imageChunks += 1;

      if (imageChunks > 1) return null;

      imageType = "VP8 ";
      imageDimensions = inspectVp8(
        buffer,
        dataStart,
        chunkSize
      );

      if (!imageDimensions) return null;
    } else if (chunkType === "VP8L") {
      imageChunks += 1;

      if (
        imageChunks > 1 ||
        alphaChunks > 0
      ) {
        return null;
      }

      const lossless = inspectVp8l(
        buffer,
        dataStart,
        chunkSize
      );

      if (!lossless) return null;

      imageType = "VP8L";
      imageDimensions = lossless.dimensions;
      losslessAlpha = lossless.alpha;
    }

    cursor = paddedEnd;
    chunkIndex += 1;
  }

  if (
    cursor !== buffer.length ||
    imageChunks !== 1 ||
    !imageType ||
    !imageDimensions
  ) {
    return null;
  }

  if (
    alphaChunks > 0 &&
    imageType !== "VP8 "
  ) {
    return null;
  }

  const actualAlpha =
    alphaChunks > 0 ||
    losslessAlpha;

  if (
    canvasDimensions &&
    extendedAlpha !== actualAlpha
  ) {
    return null;
  }

  if (
    canvasDimensions &&
    (
      imageDimensions.width > canvasDimensions.width ||
      imageDimensions.height > canvasDimensions.height
    )
  ) {
    return null;
  }

  return {
    digest: createHash("sha256")
      .update(buffer)
      .digest("hex"),
    bytes: buffer.length,
    width:
      canvasDimensions?.width ??
      imageDimensions.width,
    height:
      canvasDimensions?.height ??
      imageDimensions.height,
    hasAlpha: actualAlpha,
  };
}

export function sanitizeEditorialWebp(
  input: Buffer
): Buffer | null {
  if (!hasValidRiffEnvelope(input)) {
    return null;
  }

  const chunks: Buffer[] = [];
  let cursor = 12;
  let changed = false;

  while (cursor < input.length) {
    if (cursor + 8 > input.length) {
      return null;
    }

    const chunkType = input.toString(
      "ascii",
      cursor,
      cursor + 4
    );
    const chunkSize = input.readUInt32LE(
      cursor + 4
    );
    const dataEnd = cursor + 8 + chunkSize;
    const paddedEnd = dataEnd + (chunkSize % 2);

    if (
      dataEnd > input.length ||
      paddedEnd > input.length
    ) {
      return null;
    }

    if (removableMetadataChunks.has(chunkType)) {
      changed = true;
      cursor = paddedEnd;
      continue;
    }

    const copied = Buffer.from(
      input.subarray(cursor, paddedEnd)
    );

    if (
      chunkType === "VP8X" &&
      chunkSize === 10
    ) {
      const previousFlags = copied[8];

      if (previousFlags === undefined) {
        return null;
      }

      copied[8] &= ~metadataFlagMask;

      if (copied[8] !== previousFlags) {
        changed = true;
      }
    }

    chunks.push(copied);
    cursor = paddedEnd;
  }

  if (cursor !== input.length) {
    return null;
  }

  const candidate = changed
    ? (() => {
        const body = Buffer.concat(chunks);
        const output = Buffer.alloc(12 + body.length);
        output.write("RIFF", 0, "ascii");
        output.writeUInt32LE(output.length - 8, 4);
        output.write("WEBP", 8, "ascii");
        body.copy(output, 12);
        return output;
      })()
    : input;

  return inspectSafeEditorialWebp(candidate)
    ? candidate
    : null;
}
