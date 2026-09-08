import assert from "node:assert/strict";
import {
  inspectSafeSiteBrandLogoRaster,
  sanitizeSiteBrandLogoRaster,
  SITE_BRAND_RASTER_FORMATS,
} from "../src/lib/media/safe-site-logo-raster.ts";
import {
  inspectSafeSiteBrandLogoSvg,
  recolorSafeSiteBrandLogoSvg,
  sanitizeSiteBrandLogoSvg,
  sanitizeTaxonomySvgIcon,
} from "../src/lib/media/safe-svg-icon.ts";

const drawing = '<g transform="translate(0,24) scale(1,-1)" fill="#000000" stroke="none"><path d="M2 2h20v20H2z"/></g>';
const root = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
const potraceExport = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="24pt" height="24pt" viewBox="0 0 24 24">
<metadata>Created by potrace 1.16</metadata>${drawing}</svg>`;
const recraftLikeExport = `<?xml version="1.0" encoding="utf-8" ?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1254" height="1254" viewBox="0 0 1254 1254">
<metadata><c2pa:manifest xmlns:c2pa="http://c2pa.org/manifest">signed-editor-metadata</c2pa:manifest></metadata>
<defs><linearGradient id="gradient_0" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1254" y2="1254"><stop offset="0" stop-color="#3A4C62"/><stop offset="1" stop-color="#0A7779" stop-opacity="0.98823529"/></linearGradient></defs>
<path fill="#03F7F9" d="M0 0h1254v1254H0z"/>
<path fill="url(#gradient_0)" fill-opacity="0.8" d="M100 100h1054v1054H100z"/>
</svg>`;
const styledExport = root(`
<style type="text/css">.paint{fill:#03F7F9;stroke:url(#gradient_1)}</style>
<defs><linearGradient id="gradient_1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
<path class="paint" style="stroke-width:2;opacity:.9" d="M2 2h20v20H2z"/>
<image href="data:image/png;base64,iVBORw0KGgo=" x="1" y="1" width="1" height="1"/>
`);

const sanitize = (source) => sanitizeSiteBrandLogoSvg(Buffer.from(source));

const potraceOutput = sanitize(potraceExport);
assert.ok(potraceOutput, "Accept a Potrace export");
assert.ok(inspectSafeSiteBrandLogoSvg(potraceOutput), "Stored Potrace output passes the strict reader");
assert.ok(potraceOutput.toString().includes(drawing), "Preserve Potrace paths, transforms and paint");
assert.doesNotMatch(potraceOutput.toString(), /DOCTYPE|metadata|version=/);
assert.deepEqual(sanitize(potraceOutput.toString()), potraceOutput, "Potrace normalization is idempotent");

const recraftOutput = sanitize(recraftLikeExport);
assert.ok(recraftOutput, "Accept a Recraft-style multicolor SVG export");
assert.ok(inspectSafeSiteBrandLogoSvg(recraftOutput), "Stored Recraft-style output passes the strict reader");
assert.doesNotMatch(recraftOutput.toString(), /metadata|c2pa:manifest/);
assert.match(recraftOutput.toString(), /<defs><linearGradient/);
assert.match(recraftOutput.toString(), /fill="url\(#gradient_0\)"/);
assert.match(recraftOutput.toString(), /xmlns:xlink=/);
assert.deepEqual(sanitize(recraftOutput.toString()), recraftOutput, "Recraft-style normalization is idempotent");

const styledOutput = sanitize(styledExport);
assert.ok(styledOutput, "Accept safe inline CSS, internal paint references and embedded raster data");
assert.match(styledOutput.toString(), /<style type="text\/css">/);
assert.ok(recolorSafeSiteBrandLogoSvg(styledOutput, "#ff0847"), "Recoloring remains available for Marca/Personalizado modes");
assert.ok(recolorSafeSiteBrandLogoSvg(recraftOutput, "#ff0847"), "Gradient SVGs can be recolored for social output");

const hostileMetadataOutput = sanitize(
  root('<metadata><script>alert(1)</script></metadata>' + drawing)
);
assert.ok(hostileMetadataOutput, "Discard metadata wholesale before storing the drawing");
assert.doesNotMatch(hostileMetadataOutput.toString(), /metadata|script|alert/);
assert.ok(inspectSafeSiteBrandLogoSvg(hostileMetadataOutput), "Metadata-stripped output remains safe and canonical");

assert.equal(sanitizeTaxonomySvgIcon(Buffer.from(potraceExport)), null, "Taxonomy SVG policy stays intentionally strict");
assert.ok(sanitize(root(drawing)));

for (const source of [
  '<!DOCTYPE svg [<!ENTITY x "test">]>' + root(drawing),
  '<!DOCTYPE svg SYSTEM "file:///etc/passwd" [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + root(drawing),
  root('<script>alert(1)</script>' + drawing),
  root('<foreignObject><div>html</div></foreignObject>' + drawing),
  root('<path onload="alert(1)" d="M0 0"/>'),
  root('<use href="https://example.com/shape.svg#shape"/>'),
  root('<path fill="url(https://example.com/paint.svg#paint)" d="M0 0"/>'),
  root('<animate attributeName="opacity" values="0;1" dur="1s"/>'),
  root('<path style="fill:u\\72l(https://example.com/paint)" d="M0 0"/>'),
  root('<style>@import url(https://example.com/theme.css);</style>' + drawing),
  root('<image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4="/>'),
  root('<image href="https://example.com/image.png"/>'),
  potraceExport.replace('svg10.dtd"', 'svg10.dtd" [<!ENTITY x "test">]'),
]) {
  assert.equal(sanitize(source), null, "Reject executable, active, external or entity-driven SVG content");
}

assert.equal(sanitizeSiteBrandLogoSvg(Buffer.alloc(256 * 1024 + 1)), null);
assert.equal(sanitizeSiteBrandLogoSvg(Buffer.from([0xff])), null);
assert.equal(sanitize('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'), null, "Require a scalable viewBox");

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

assert.deepEqual(
  SITE_BRAND_RASTER_FORMATS,
  ["png", "jpg", "webp", "gif"],
  "Keep the supported raster contract explicit"
);

const trace = Buffer.from("private-exporter-trace", "utf8");

const pngBase = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const pngIendStart = pngBase.indexOf(Buffer.from("IEND", "ascii")) - 4;
const pngWithMetadata = Buffer.concat([
  pngBase.subarray(0, pngIendStart),
  pngChunk("tEXt", Buffer.concat([Buffer.from("Software\0"), trace])),
  pngBase.subarray(pngIendStart),
  trace,
]);
const pngOutput = sanitizeSiteBrandLogoRaster(pngWithMetadata);
assert.ok(pngOutput && pngOutput.inspection.format === "png", "Accept a valid PNG by content signature");
assert.equal(pngOutput.buffer.includes(trace), false, "Strip PNG text metadata and bytes appended after IEND");
assert.ok(inspectSafeSiteBrandLogoRaster(pngOutput.buffer, "png"), "Stored PNG passes the strict reader");
assert.equal(inspectSafeSiteBrandLogoRaster(pngWithMetadata, "png"), null, "Reject unsanitized PNG metadata at read time");

const jpegBase = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64"
);
const jpegComment = Buffer.alloc(4 + trace.length);
jpegComment[0] = 0xff;
jpegComment[1] = 0xfe;
jpegComment.writeUInt16BE(trace.length + 2, 2);
trace.copy(jpegComment, 4);
const jpegWithMetadata = Buffer.concat([
  jpegBase.subarray(0, 2),
  jpegComment,
  jpegBase.subarray(2),
  trace,
]);
const jpegOutput = sanitizeSiteBrandLogoRaster(jpegWithMetadata);
assert.ok(jpegOutput && jpegOutput.inspection.format === "jpg", "Accept JPEG regardless of browser filename/MIME spelling");
assert.equal(jpegOutput.buffer.includes(trace), false, "Strip JPEG APP/COM metadata and bytes appended after EOI");
assert.ok(inspectSafeSiteBrandLogoRaster(jpegOutput.buffer, "jpg"), "Stored JPEG passes the strict reader");
assert.equal(inspectSafeSiteBrandLogoRaster(jpegWithMetadata, "jpg"), null, "Reject unsanitized JPEG metadata at read time");

const gifBase = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);
const gifImageStart = gifBase.indexOf(0x2c);
const gifTrailer = gifBase.lastIndexOf(0x3b);
const gifComment = Buffer.concat([
  Buffer.from([0x21, 0xfe, trace.length]),
  trace,
  Buffer.from([0x00]),
]);
const gifWithMetadata = Buffer.concat([
  gifBase.subarray(0, gifImageStart),
  gifComment,
  gifBase.subarray(gifImageStart, gifTrailer + 1),
  trace,
]);
const gifOutput = sanitizeSiteBrandLogoRaster(gifWithMetadata);
assert.ok(gifOutput && gifOutput.inspection.format === "gif", "Accept a static GIF");
assert.equal(gifOutput.buffer.includes(trace), false, "Strip GIF comment/application metadata and trailing bytes");
assert.ok(inspectSafeSiteBrandLogoRaster(gifOutput.buffer, "gif"), "Stored GIF passes the strict reader");
assert.equal(inspectSafeSiteBrandLogoRaster(gifWithMetadata, "gif"), null, "Reject unsanitized GIF metadata at read time");

const gifImageBlock = gifBase.subarray(gifImageStart, gifTrailer);
const animatedGif = Buffer.concat([
  gifBase.subarray(0, gifImageStart),
  gifImageBlock,
  gifImageBlock,
  Buffer.from([0x3b]),
]);
assert.equal(sanitizeSiteBrandLogoRaster(animatedGif), null, "Reject animated/multi-frame GIF instead of persisting hidden frames");
assert.equal(sanitizeSiteBrandLogoRaster(Buffer.from("not-an-image")), null, "Reject unknown binary formats by content");

console.log("Site logo import: OK (SVG Potrace/Recraft plus PNG/JPEG/WebP/GIF contract, metadata stripping, stored revalidation, static-only raster policy, recoloring and active-content rejection).");
