import { createHash } from "node:crypto";

import {
  inspectSafeEditorialWebp,
  MAX_EDITORIAL_IMAGE_BYTES,
  MAX_EDITORIAL_IMAGE_DIMENSION,
  MAX_EDITORIAL_IMAGE_PIXELS,
  sanitizeEditorialWebp,
} from "./safe-webp.ts";

export const SITE_BRAND_RASTER_FORMATS = [
  "png",
  "jpg",
  "webp",
  "gif",
] as const;

export type SiteBrandRasterFormat =
  (typeof SITE_BRAND_RASTER_FORMATS)[number];

export type SafeSiteBrandRasterInspection = {
  digest: string;
  bytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  format: SiteBrandRasterFormat;
};

export type SanitizedSiteBrandRaster = {
  buffer: Buffer;
  inspection: SafeSiteBrandRasterInspection;
};

type Dimensions = {
  width: number;
  height: number;
};

function dimensionsAreSafe({ width, height }: Dimensions) {
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

function digest(buffer: Buffer) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
]);

const pngPreservedAncillaryChunks = new Set([
  "tRNS",
]);

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^
        (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngBitDepthIsValid(
  bitDepth: number,
  colorType: number
) {
  if (colorType === 0) {
    return [1, 2, 4, 8, 16].includes(bitDepth);
  }
  if (colorType === 2 || colorType === 4 || colorType === 6) {
    return [8, 16].includes(bitDepth);
  }
  if (colorType === 3) {
    return [1, 2, 4, 8].includes(bitDepth);
  }
  return false;
}

function pngTransparencyIsValid(
  input: Buffer,
  dataStart: number,
  chunkLength: number,
  bitDepth: number,
  colorType: number,
  paletteEntries: number
) {
  if (colorType === 0 && chunkLength === 2) {
    const gray = input.readUInt16BE(dataStart);
    return bitDepth === 16 || gray < 1 << bitDepth;
  }

  if (colorType === 2 && chunkLength === 6) {
    if (bitDepth === 16) return true;
    const maxSample = (1 << bitDepth) - 1;
    return (
      input.readUInt16BE(dataStart) <= maxSample &&
      input.readUInt16BE(dataStart + 2) <= maxSample &&
      input.readUInt16BE(dataStart + 4) <= maxSample
    );
  }

  if (colorType === 3) {
    return chunkLength > 0 && chunkLength <= paletteEntries;
  }

  return false;
}

function processPng(
  input: Buffer,
  stripMetadata: boolean
): SanitizedSiteBrandRaster | null {
  if (
    input.length < 8 + 12 + 13 + 12 ||
    input.length > MAX_EDITORIAL_IMAGE_BYTES ||
    !input.subarray(0, 8).equals(PNG_SIGNATURE)
  ) {
    return null;
  }

  const output: Buffer[] = [PNG_SIGNATURE];
  let cursor = 8;
  let chunkIndex = 0;
  let seenIhdr = false;
  let seenPlte = false;
  let seenIdat = false;
  let idatClosed = false;
  let seenIend = false;
  let seenTrns = false;
  let dimensions: Dimensions | null = null;
  let bitDepth: number | null = null;
  let colorType: number | null = null;
  let paletteEntries = 0;
  let hasAlpha = false;

  while (cursor < input.length) {
    if (cursor + 12 > input.length || seenIend) {
      return null;
    }

    const chunkLength = input.readUInt32BE(cursor);
    const typeStart = cursor + 4;
    const dataStart = cursor + 8;
    const dataEnd = dataStart + chunkLength;
    const crcOffset = dataEnd;
    const chunkEnd = crcOffset + 4;

    if (
      chunkLength > MAX_EDITORIAL_IMAGE_BYTES ||
      chunkEnd > input.length
    ) {
      return null;
    }

    const chunkType = input.toString(
      "ascii",
      typeStart,
      dataStart
    );

    if (!/^[A-Za-z]{4}$/.test(chunkType)) {
      return null;
    }

    const actualCrc = input.readUInt32BE(crcOffset);
    const expectedCrc = crc32(
      input.subarray(typeStart, dataEnd)
    );

    if (actualCrc !== expectedCrc) {
      return null;
    }

    const isCritical =
      (input[typeStart]! & 0x20) === 0;
    let preserve = false;

    if (chunkType === "IHDR") {
      if (
        chunkIndex !== 0 ||
        seenIhdr ||
        chunkLength !== 13
      ) {
        return null;
      }

      const width = input.readUInt32BE(dataStart);
      const height = input.readUInt32BE(dataStart + 4);
      const nextBitDepth = input[dataStart + 8]!;
      const nextColorType = input[dataStart + 9]!;
      const compression = input[dataStart + 10]!;
      const filter = input[dataStart + 11]!;
      const interlace = input[dataStart + 12]!;

      if (
        !dimensionsAreSafe({ width, height }) ||
        !pngBitDepthIsValid(nextBitDepth, nextColorType) ||
        compression !== 0 ||
        filter !== 0 ||
        (interlace !== 0 && interlace !== 1)
      ) {
        return null;
      }

      dimensions = { width, height };
      bitDepth = nextBitDepth;
      colorType = nextColorType;
      hasAlpha = nextColorType === 4 || nextColorType === 6;
      seenIhdr = true;
      preserve = true;
    } else if (!seenIhdr) {
      return null;
    } else if (chunkType === "PLTE") {
      const nextPaletteEntries = chunkLength / 3;
      if (
        seenPlte ||
        seenIdat ||
        chunkLength === 0 ||
        chunkLength > 768 ||
        chunkLength % 3 !== 0 ||
        colorType === 0 ||
        colorType === 4 ||
        (colorType === 3 &&
          (bitDepth === null ||
            nextPaletteEntries > 1 << bitDepth))
      ) {
        return null;
      }
      seenPlte = true;
      paletteEntries = nextPaletteEntries;
      preserve = true;
    } else if (chunkType === "IDAT") {
      if (seenIend || idatClosed) return null;
      seenIdat = true;
      preserve = true;
    } else if (chunkType === "IEND") {
      if (
        !seenIdat ||
        seenIend ||
        chunkLength !== 0
      ) {
        return null;
      }
      seenIend = true;
      preserve = true;
    } else {
      if (seenIdat) idatClosed = true;

      if (isCritical) {
        return null;
      }

      if (chunkType === "tRNS") {
        if (
          seenTrns ||
          seenIdat ||
          bitDepth === null ||
          colorType === null ||
          !pngTransparencyIsValid(
            input,
            dataStart,
            chunkLength,
            bitDepth,
            colorType,
            paletteEntries
          )
        ) {
          return null;
        }
        seenTrns = true;
        hasAlpha = true;
      }

      preserve = pngPreservedAncillaryChunks.has(
        chunkType
      );

      if (!stripMetadata && !preserve) {
        return null;
      }
    }

    if (preserve) {
      output.push(
        Buffer.from(input.subarray(cursor, chunkEnd))
      );
    }

    cursor = chunkEnd;
    chunkIndex += 1;

    if (seenIend) break;
  }

  if (
    !seenIhdr ||
    !seenIdat ||
    !seenIend ||
    !dimensions ||
    bitDepth === null ||
    colorType === null ||
    (colorType === 3 && !seenPlte)
  ) {
    return null;
  }

  const candidate = Buffer.concat(output);

  if (
    !stripMetadata &&
    candidate.length !== input.length
  ) {
    return null;
  }

  return {
    buffer: candidate,
    inspection: {
      digest: digest(candidate),
      bytes: candidate.length,
      width: dimensions.width,
      height: dimensions.height,
      hasAlpha,
      format: "png",
    },
  };
}

const JPEG_STANDALONE_MARKERS = new Set([
  0x01,
]);

const JPEG_SUPPORTED_SOF_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
]);

const JPEG_OTHER_SOF_MARKERS = new Set([
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

function jpegScanHeaderIsValid(
  input: Buffer,
  cursor: number,
  segmentLength: number,
  sofMarker: number,
  frameComponentIds: readonly number[]
) {
  const scanComponents = input[cursor + 2]!;

  if (
    scanComponents < 1 ||
    scanComponents > frameComponentIds.length ||
    segmentLength !== 6 + 2 * scanComponents
  ) {
    return false;
  }

  const scanIds = new Set<number>();
  const maxTableSelector = sofMarker === 0xc0 ? 1 : 3;

  for (let index = 0; index < scanComponents; index += 1) {
    const componentOffset = cursor + 3 + 2 * index;
    const componentId = input[componentOffset]!;
    const tableSelectors = input[componentOffset + 1]!;
    const dcTable = tableSelectors >> 4;
    const acTable = tableSelectors & 0x0f;

    if (
      !frameComponentIds.includes(componentId) ||
      scanIds.has(componentId) ||
      dcTable > maxTableSelector ||
      acTable > maxTableSelector
    ) {
      return false;
    }

    scanIds.add(componentId);
  }

  const parameterOffset = cursor + 3 + 2 * scanComponents;
  const spectralStart = input[parameterOffset]!;
  const spectralEnd = input[parameterOffset + 1]!;
  const approximation = input[parameterOffset + 2]!;
  const approximationHigh = approximation >> 4;
  const approximationLow = approximation & 0x0f;

  if (sofMarker === 0xc0 || sofMarker === 0xc1) {
    return (
      spectralStart === 0 &&
      spectralEnd === 63 &&
      approximationHigh === 0 &&
      approximationLow === 0
    );
  }

  if (sofMarker !== 0xc2) return false;

  return (
    spectralStart <= 63 &&
    spectralEnd <= 63 &&
    spectralEnd >= spectralStart &&
    approximationHigh <= 13 &&
    approximationLow <= 13 &&
    (spectralStart !== 0 || spectralEnd === 0) &&
    (spectralStart === 0 || scanComponents === 1) &&
    (approximationHigh === 0 ||
      approximationHigh === approximationLow + 1)
  );
}

function processJpeg(
  input: Buffer,
  stripMetadata: boolean
): SanitizedSiteBrandRaster | null {
  if (
    input.length < 4 ||
    input.length > MAX_EDITORIAL_IMAGE_BYTES ||
    input[0] !== 0xff ||
    input[1] !== 0xd8
  ) {
    return null;
  }

  const output: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let cursor = 2;
  let dimensions: Dimensions | null = null;
  let components = 0;
  let sofMarker: number | null = null;
  let frameComponentIds: number[] = [];
  let seenSof = false;
  let seenSos = false;
  let seenEoi = false;

  while (cursor < input.length) {
    if (input[cursor] !== 0xff) {
      return null;
    }

    let markerStart = cursor;
    while (
      markerStart + 1 < input.length &&
      input[markerStart + 1] === 0xff
    ) {
      markerStart += 1;
    }

    if (markerStart + 1 >= input.length) {
      return null;
    }

    const marker = input[markerStart + 1]!;
    cursor = markerStart + 2;

    if (marker === 0x00 || marker === 0xd8) {
      return null;
    }

    if (marker === 0xd9) {
      seenEoi = true;
      output.push(Buffer.from([0xff, 0xd9]));
      break;
    }

    if (JPEG_STANDALONE_MARKERS.has(marker)) {
      output.push(Buffer.from([0xff, marker]));
      continue;
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      return null;
    }

    if (cursor + 2 > input.length) {
      return null;
    }

    const segmentLength = input.readUInt16BE(cursor);
    if (segmentLength < 2) return null;

    const segmentEnd = cursor + segmentLength;
    if (segmentEnd > input.length) {
      return null;
    }

    const isMetadata =
      (marker >= 0xe0 && marker <= 0xef) ||
      marker === 0xfe;

    if (JPEG_OTHER_SOF_MARKERS.has(marker)) {
      return null;
    }

    if (JPEG_SUPPORTED_SOF_MARKERS.has(marker)) {
      if (
        seenSof ||
        segmentLength < 8
      ) {
        return null;
      }

      const precision = input[cursor + 2]!;
      const height = input.readUInt16BE(cursor + 3);
      const width = input.readUInt16BE(cursor + 5);
      const nextComponents = input[cursor + 7]!;

      if (
        precision !== 8 ||
        !dimensionsAreSafe({ width, height }) ||
        ![1, 3].includes(nextComponents) ||
        segmentLength !== 8 + 3 * nextComponents
      ) {
        return null;
      }

      const nextComponentIds: number[] = [];
      const seenComponentIds = new Set<number>();

      for (let index = 0; index < nextComponents; index += 1) {
        const componentOffset = cursor + 8 + 3 * index;
        const componentId = input[componentOffset]!;
        const sampling = input[componentOffset + 1]!;
        const horizontalSampling = sampling >> 4;
        const verticalSampling = sampling & 0x0f;
        const quantizationTable = input[componentOffset + 2]!;

        if (
          seenComponentIds.has(componentId) ||
          horizontalSampling < 1 ||
          horizontalSampling > 4 ||
          verticalSampling < 1 ||
          verticalSampling > 4 ||
          quantizationTable > 3
        ) {
          return null;
        }

        seenComponentIds.add(componentId);
        nextComponentIds.push(componentId);
      }

      dimensions = { width, height };
      components = nextComponents;
      sofMarker = marker;
      frameComponentIds = nextComponentIds;
      seenSof = true;
    }

    if (marker === 0xda) {
      if (
        !seenSof ||
        sofMarker === null ||
        !jpegScanHeaderIsValid(
          input,
          cursor,
          segmentLength,
          sofMarker,
          frameComponentIds
        )
      ) {
        return null;
      }

      seenSos = true;
      output.push(
        Buffer.from(
          input.subarray(markerStart, segmentEnd)
        )
      );

      let scanCursor = segmentEnd;
      let markerBoundary = -1;

      while (scanCursor < input.length) {
        if (input[scanCursor] !== 0xff) {
          scanCursor += 1;
          continue;
        }

        if (scanCursor + 1 >= input.length) {
          return null;
        }

        const next = input[scanCursor + 1]!;

        if (next === 0x00) {
          scanCursor += 2;
          continue;
        }

        if (next === 0xff) {
          scanCursor += 1;
          continue;
        }

        if (next >= 0xd0 && next <= 0xd7) {
          scanCursor += 2;
          continue;
        }

        markerBoundary = scanCursor;
        break;
      }

      if (markerBoundary < 0) {
        return null;
      }

      output.push(
        Buffer.from(
          input.subarray(segmentEnd, markerBoundary)
        )
      );
      cursor = markerBoundary;
      continue;
    }

    if (isMetadata) {
      if (!stripMetadata) return null;
    } else {
      output.push(
        Buffer.from(
          input.subarray(markerStart, segmentEnd)
        )
      );
    }

    cursor = segmentEnd;
  }

  if (
    !seenSof ||
    !seenSos ||
    !seenEoi ||
    !dimensions ||
    sofMarker === null ||
    ![1, 3].includes(components) ||
    frameComponentIds.length !== components
  ) {
    return null;
  }

  const candidate = Buffer.concat(output);

  if (
    !stripMetadata &&
    candidate.length !== input.length
  ) {
    return null;
  }

  return {
    buffer: candidate,
    inspection: {
      digest: digest(candidate),
      bytes: candidate.length,
      width: dimensions.width,
      height: dimensions.height,
      hasAlpha: false,
      format: "jpg",
    },
  };
}

function readGifSubBlocks(
  input: Buffer,
  start: number
) {
  let cursor = start;

  while (cursor < input.length) {
    const size = input[cursor]!;
    cursor += 1;

    if (size === 0) {
      return cursor;
    }

    if (cursor + size > input.length) {
      return null;
    }

    cursor += size;
  }

  return null;
}

function processGif(
  input: Buffer,
  stripMetadata: boolean
): SanitizedSiteBrandRaster | null {
  if (
    input.length < 14 ||
    input.length > MAX_EDITORIAL_IMAGE_BYTES
  ) {
    return null;
  }

  const signature = input.toString("ascii", 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") {
    return null;
  }

  const width = input.readUInt16LE(6);
  const height = input.readUInt16LE(8);

  if (!dimensionsAreSafe({ width, height })) {
    return null;
  }

  const packed = input[10]!;
  const globalTable = (packed & 0x80) !== 0;
  const globalTableEntries = globalTable
    ? 1 << ((packed & 0x07) + 1)
    : 0;
  const globalTableSize = 3 * globalTableEntries;
  const dataStart = 13 + globalTableSize;

  if (
    dataStart > input.length ||
    (globalTable && input[11]! >= globalTableEntries)
  ) {
    return null;
  }

  const header = Buffer.from(input.subarray(0, dataStart));
  header[12] = 0;
  const output: Buffer[] = [header];
  let cursor = dataStart;
  let imageCount = 0;
  let hasAlpha = false;
  let pendingGraphicControl: Buffer | null = null;
  let pendingTransparentIndex: number | null = null;
  let seenTrailer = false;

  while (cursor < input.length) {
    const blockType = input[cursor]!;

    if (blockType === 0x3b) {
      seenTrailer = true;
      output.push(Buffer.from([0x3b]));
      break;
    }

    if (blockType === 0x21) {
      if (
        signature !== "GIF89a" ||
        cursor + 2 > input.length
      ) {
        return null;
      }
      const label = input[cursor + 1]!;

      if (label === 0xf9) {
        if (
          pendingGraphicControl ||
          cursor + 8 > input.length ||
          input[cursor + 2] !== 4 ||
          input[cursor + 7] !== 0
        ) {
          return null;
        }

        const packedFields = input[cursor + 3]!;
        const disposalMethod = (packedFields >> 2) & 0x07;
        const transparent = (packedFields & 0x01) !== 0;
        const transparentIndex = input[cursor + 6]!;

        if (
          (packedFields & 0xe0) !== 0 ||
          disposalMethod > 3
        ) {
          return null;
        }

        pendingGraphicControl = Buffer.from([
          0x21,
          0xf9,
          0x04,
          transparent ? 0x01 : 0x00,
          0x00,
          0x00,
          transparentIndex,
          0x00,
        ]);
        pendingTransparentIndex = transparent
          ? transparentIndex
          : null;
        cursor += 8;
        continue;
      }

      let extensionDataStart: number;
      let consumesGraphicControl = false;

      if (label === 0xfe) {
        extensionDataStart = cursor + 2;
      } else if (label === 0xff || label === 0x01) {
        if (cursor + 3 > input.length) return null;
        const fixedBlockSize = input[cursor + 2]!;
        const expectedBlockSize = label === 0xff ? 11 : 12;
        if (fixedBlockSize !== expectedBlockSize) {
          return null;
        }
        extensionDataStart = cursor + 3 + fixedBlockSize;
        if (extensionDataStart > input.length) {
          return null;
        }
        consumesGraphicControl = label === 0x01;
      } else {
        return null;
      }

      const extensionEnd = readGifSubBlocks(
        input,
        extensionDataStart
      );
      if (extensionEnd === null) return null;
      if (!stripMetadata) return null;

      if (consumesGraphicControl) {
        pendingGraphicControl = null;
        pendingTransparentIndex = null;
      }

      cursor = extensionEnd;
      continue;
    }

    if (blockType !== 0x2c) {
      return null;
    }

    if (cursor + 10 > input.length) return null;
    imageCount += 1;
    if (imageCount > 1) return null;

    const left = input.readUInt16LE(cursor + 1);
    const top = input.readUInt16LE(cursor + 3);
    const imageWidth = input.readUInt16LE(cursor + 5);
    const imageHeight = input.readUInt16LE(cursor + 7);

    if (
      !dimensionsAreSafe({
        width: imageWidth,
        height: imageHeight,
      }) ||
      left + imageWidth > width ||
      top + imageHeight > height
    ) {
      return null;
    }

    const imagePacked = input[cursor + 9]!;
    if ((imagePacked & 0x18) !== 0) return null;

    const localTable = (imagePacked & 0x80) !== 0;
    const localTableEntries = localTable
      ? 1 << ((imagePacked & 0x07) + 1)
      : 0;
    const localTableSize = 3 * localTableEntries;
    const activeTableEntries = localTable
      ? localTableEntries
      : globalTableEntries;
    const lzwOffset = cursor + 10 + localTableSize;

    if (
      activeTableEntries === 0 ||
      lzwOffset + 1 > input.length ||
      (pendingTransparentIndex !== null &&
        pendingTransparentIndex >= activeTableEntries)
    ) {
      return null;
    }

    const lzwMinimumCodeSize = input[lzwOffset]!;
    if (
      lzwMinimumCodeSize < 2 ||
      lzwMinimumCodeSize > 8
    ) {
      return null;
    }

    const imageEnd = readGifSubBlocks(
      input,
      lzwOffset + 1
    );
    if (imageEnd === null) return null;

    if (pendingGraphicControl) {
      output.push(pendingGraphicControl);
      if (pendingTransparentIndex !== null) {
        hasAlpha = true;
      }
    }

    output.push(
      Buffer.from(input.subarray(cursor, imageEnd))
    );
    cursor = imageEnd;
    pendingGraphicControl = null;
    pendingTransparentIndex = null;
  }

  if (
    imageCount !== 1 ||
    !seenTrailer ||
    pendingGraphicControl !== null ||
    pendingTransparentIndex !== null
  ) {
    return null;
  }

  const candidate = Buffer.concat(output);

  if (
    !stripMetadata &&
    candidate.length !== input.length
  ) {
    return null;
  }

  return {
    buffer: candidate,
    inspection: {
      digest: digest(candidate),
      bytes: candidate.length,
      width,
      height,
      hasAlpha,
      format: "gif",
    },
  };
}

function processWebp(
  input: Buffer,
  stripMetadata: boolean
): SanitizedSiteBrandRaster | null {
  const buffer = stripMetadata
    ? sanitizeEditorialWebp(input)
    : input;
  const inspection = buffer
    ? inspectSafeEditorialWebp(buffer)
    : null;

  if (
    !buffer ||
    !inspection ||
    (!stripMetadata && buffer.length !== input.length)
  ) {
    return null;
  }

  return {
    buffer,
    inspection: {
      ...inspection,
      format: "webp",
    },
  };
}

function detectedFormat(
  input: Buffer
): SiteBrandRasterFormat | null {
  if (
    input.length >= 8 &&
    input.subarray(0, 8).equals(PNG_SIGNATURE)
  ) {
    return "png";
  }

  if (
    input.length >= 2 &&
    input[0] === 0xff &&
    input[1] === 0xd8
  ) {
    return "jpg";
  }

  if (
    input.length >= 12 &&
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  if (
    input.length >= 6 &&
    (input.toString("ascii", 0, 6) === "GIF87a" ||
      input.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "gif";
  }

  return null;
}

function processRaster(
  input: Buffer,
  stripMetadata: boolean
) {
  const format = detectedFormat(input);

  switch (format) {
    case "png":
      return processPng(input, stripMetadata);
    case "jpg":
      return processJpeg(input, stripMetadata);
    case "webp":
      return processWebp(input, stripMetadata);
    case "gif":
      return processGif(input, stripMetadata);
    default:
      return null;
  }
}

export function sanitizeSiteBrandLogoRaster(
  input: Buffer
) {
  return processRaster(input, true);
}

export function inspectSafeSiteBrandLogoRaster(
  input: Buffer,
  expectedFormat?: SiteBrandRasterFormat
): SafeSiteBrandRasterInspection | null {
  const result = processRaster(input, false);

  if (
    !result ||
    (expectedFormat &&
      result.inspection.format !== expectedFormat)
  ) {
    return null;
  }

  return result.inspection;
}

export function siteBrandRasterContentType(
  format: SiteBrandRasterFormat
) {
  switch (format) {
    case "png":
      return "image/png";
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
  }
}
