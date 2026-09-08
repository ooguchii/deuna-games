import assert from "node:assert/strict";
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

assert.equal(sanitizeTaxonomySvgIcon(Buffer.from(potraceExport)), null, "Taxonomy SVG policy stays intentionally strict");
assert.ok(sanitize(root(drawing)));

for (const source of [
  '<!DOCTYPE svg [<!ENTITY x "test">]>' + root(drawing),
  '<!DOCTYPE svg SYSTEM "file:///etc/passwd" [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + root(drawing),
  root('<metadata><script>alert(1)</script></metadata>' + drawing),
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

console.log("Site logo SVG import: OK (Potrace/Recraft normalization, multicolor gradients, safe static CSS/data assets, stored validation, recoloring and active-content rejection).");
