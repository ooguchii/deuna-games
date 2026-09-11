import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";

import {
  inspectSafeSiteBrandLogoRaster,
  sanitizeSiteBrandLogoRaster,
} from "../src/lib/media/safe-site-logo-raster.ts";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  typeBuffer.copy(header, 4);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([header, data, footer]);
}

function makePng({ bitDepth, colorType, paletteEntries = 0, trns = null }) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;

  let scanline;
  switch (colorType) {
    case 0:
    case 3:
      scanline = Buffer.from([0x00, 0x00]);
      break;
    case 2:
      scanline = Buffer.from([0x00, 0x10, 0x20, 0x30]);
      break;
    case 4:
      scanline = Buffer.from([0x00, 0x20, 0xff]);
      break;
    case 6:
      scanline = Buffer.from([0x00, 0x10, 0x20, 0x30, 0xff]);
      break;
    default:
      throw new Error(`Unsupported PNG color type in fixture: ${colorType}`);
  }

  const chunks = [pngChunk("IHDR", ihdr)];
  if (paletteEntries > 0) {
    const palette = Buffer.alloc(paletteEntries * 3);
    for (let index = 0; index < palette.length; index += 1) {
      palette[index] = index & 0xff;
    }
    chunks.push(pngChunk("PLTE", palette));
  }
  if (trns) chunks.push(pngChunk("tRNS", trns));
  chunks.push(pngChunk("IDAT", deflateSync(scanline)));
  chunks.push(pngChunk("IEND", Buffer.alloc(0)));
  return Buffer.concat([signature, ...chunks]);
}

const validIndexedPng = makePng({
  bitDepth: 1,
  colorType: 3,
  paletteEntries: 2,
});
assert.ok(sanitizeSiteBrandLogoRaster(validIndexedPng));
assert.ok(inspectSafeSiteBrandLogoRaster(validIndexedPng, "png"));

assert.equal(
  sanitizeSiteBrandLogoRaster(
    makePng({ bitDepth: 8, colorType: 0, paletteEntries: 2 })
  ),
  null,
  "PNG grayscale must reject PLTE"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    makePng({ bitDepth: 8, colorType: 4, paletteEntries: 2 })
  ),
  null,
  "PNG grayscale+alpha must reject PLTE"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    makePng({ bitDepth: 1, colorType: 3, paletteEntries: 3 })
  ),
  null,
  "Indexed PNG palette must fit the IHDR bit depth"
);
assert.ok(
  sanitizeSiteBrandLogoRaster(
    makePng({ bitDepth: 8, colorType: 2, paletteEntries: 2 })
  ),
  "Truecolor PNG may keep a suggested PLTE"
);
assert.ok(
  sanitizeSiteBrandLogoRaster(
    makePng({
      bitDepth: 8,
      colorType: 0,
      trns: Buffer.from([0x00, 0x80]),
    })
  ),
  "8-bit grayscale tRNS accepts a representable sample"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    makePng({
      bitDepth: 8,
      colorType: 0,
      trns: Buffer.from([0x01, 0x00]),
    })
  ),
  null,
  "8-bit grayscale tRNS rejects non-zero high bits"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    makePng({
      bitDepth: 8,
      colorType: 2,
      trns: Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00]),
    })
  ),
  null,
  "8-bit truecolor tRNS rejects samples outside the bit depth"
);

const baselineJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDz+iiivlD+lj//2Q==",
  "base64"
);
const progressiveJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wgARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAVAQEBAAAAAAAAAAAAAAAAAAAFB//aAAwDAQACEAMQAAABnwTS/wD/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEAv/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64"
);

assert.ok(sanitizeSiteBrandLogoRaster(baselineJpeg), "Accept baseline JPEG");
assert.ok(sanitizeSiteBrandLogoRaster(progressiveJpeg), "Accept progressive JPEG");

function markerOffset(buffer, marker) {
  for (let index = 2; index + 1 < buffer.length; index += 1) {
    if (buffer[index] === 0xff && buffer[index + 1] === marker) {
      return index;
    }
  }
  throw new Error(`JPEG marker 0x${marker.toString(16)} not found`);
}

function mutated(buffer, mutate) {
  const clone = Buffer.from(buffer);
  mutate(clone);
  return clone;
}

const baselineSof = markerOffset(baselineJpeg, 0xc0);
const baselineSos = markerOffset(baselineJpeg, 0xda);

for (const [name, candidate] of [
  [
    "duplicate SOF component id",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSof + 13] = buffer[baselineSof + 10];
    }),
  ],
  [
    "zero SOF horizontal sampling factor",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSof + 11] = 0x02;
    }),
  ],
  [
    "out-of-range SOF quantization selector",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSof + 12] = 0x04;
    }),
  ],
  [
    "scan-header length/Ns mismatch",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSos + 4] = 2;
    }),
  ],
  [
    "scan-header unknown component selector",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSos + 5] = 99;
    }),
  ],
  [
    "scan-header duplicate component selector",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSos + 7] = buffer[baselineSos + 5];
    }),
  ],
  [
    "baseline scan table selector outside 0..1",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSos + 6] = 0x20;
    }),
  ],
  [
    "baseline scan spectral selection",
    mutated(baselineJpeg, (buffer) => {
      buffer[baselineSos + 11] = 1;
    }),
  ],
]) {
  assert.equal(
    sanitizeSiteBrandLogoRaster(candidate),
    null,
    `Reject JPEG with ${name}`
  );
}

const progressiveSos = markerOffset(progressiveJpeg, 0xda);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    mutated(progressiveJpeg, (buffer) => {
      buffer[progressiveSos + 12] = 63;
    })
  ),
  null,
  "Progressive DC scan requires Se=0 when Ss=0"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    mutated(progressiveJpeg, (buffer) => {
      buffer[progressiveSos + 13] = 0xe0;
    })
  ),
  null,
  "Progressive JPEG rejects successive approximation above 13"
);

const gifBase = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);
const gifImageStart = gifBase.indexOf(0x2c);
assert.ok(sanitizeSiteBrandLogoRaster(gifBase), "Accept canonical static GIF");

assert.equal(
  sanitizeSiteBrandLogoRaster(
    mutated(gifBase, (buffer) => {
      buffer[11] = 2;
    })
  ),
  null,
  "GIF background index must fit the global color table"
);
assert.equal(
  sanitizeSiteBrandLogoRaster(
    mutated(gifBase, (buffer) => {
      buffer[gifImageStart + 9] |= 0x08;
    })
  ),
  null,
  "GIF image descriptor reserved bits must stay zero"
);

const gifWithoutGlobalTableHeader = Buffer.from(gifBase.subarray(0, 13));
gifWithoutGlobalTableHeader[10] &= 0x7f;
const gifWithoutAnyTable = Buffer.concat([
  gifWithoutGlobalTableHeader,
  gifBase.subarray(gifImageStart),
]);
assert.equal(
  sanitizeSiteBrandLogoRaster(gifWithoutAnyTable),
  null,
  "Standalone GIF logo requires an active global or local color table"
);

const transparentIndexOutsidePalette = Buffer.concat([
  gifBase.subarray(0, gifImageStart),
  Buffer.from([0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x02, 0x00]),
  gifBase.subarray(gifImageStart),
]);
assert.equal(
  sanitizeSiteBrandLogoRaster(transparentIndexOutsidePalette),
  null,
  "GIF transparent index must fit the active color table"
);

const validTransparentGif = Buffer.concat([
  gifBase.subarray(0, gifImageStart),
  Buffer.from([0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x01, 0x00]),
  gifBase.subarray(gifImageStart),
]);
const validTransparentOutput = sanitizeSiteBrandLogoRaster(validTransparentGif);
assert.ok(validTransparentOutput?.inspection.hasAlpha);
assert.ok(inspectSafeSiteBrandLogoRaster(validTransparentOutput.buffer, "gif"));

const duplicateGraphicControl = Buffer.concat([
  gifBase.subarray(0, gifImageStart),
  Buffer.from([0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]),
  gifBase.subarray(gifImageStart),
]);
assert.equal(
  sanitizeSiteBrandLogoRaster(duplicateGraphicControl),
  null,
  "GIF allows at most one Graphic Control Extension for a rendering block"
);

const gif87With89Extension = Buffer.from(validTransparentGif);
Buffer.from("GIF87a", "ascii").copy(gif87With89Extension, 0);
assert.equal(
  sanitizeSiteBrandLogoRaster(gif87With89Extension),
  null,
  "GIF87a must not carry GIF89a extensions"
);

console.log(
  "Site logo raster structure: OK (PNG palette/tRNS, JPEG SOF/scan-header baseline+progressive and GIF color-table/control invariants)."
);
