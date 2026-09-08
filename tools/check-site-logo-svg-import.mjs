import assert from "node:assert/strict";
import {
  inspectSafeSiteBrandLogoSvg,
  recolorSafeSiteBrandLogoSvg,
  sanitizeSiteBrandLogoSvg,
  sanitizeTaxonomySvgIcon,
} from "../src/lib/media/safe-svg-icon.ts";

const drawing = '<g transform="translate(0,24) scale(1,-1)" fill="#000000" stroke="none"><path d="M2 2h20v20H2z"/></g>';
const root = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
const exported = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="24pt" height="24pt" viewBox="0 0 24 24">
<metadata>Created by potrace 1.16</metadata>${drawing}</svg>`;

const sanitize = (source) => sanitizeSiteBrandLogoSvg(Buffer.from(source));
const output = sanitize(exported);
assert.ok(output, "Accept a Potrace export");
assert.ok(inspectSafeSiteBrandLogoSvg(output), "Stored output passes the strict reader");
assert.ok(output.toString().includes(drawing), "Preserve paths, transforms and paint");
assert.doesNotMatch(output.toString(), /DOCTYPE|metadata|version=/);
assert.deepEqual(sanitize(output.toString()), output, "Normalization is idempotent");
assert.ok(recolorSafeSiteBrandLogoSvg(output, "#ff0847"), "Social rendering can recolor the imported logo");
assert.equal(sanitizeTaxonomySvgIcon(Buffer.from(exported)), null, "Taxonomy policy stays unchanged");
assert.ok(sanitize(root(drawing)));

for (const source of [
  '<!DOCTYPE svg [<!ENTITY x "test">]>' + root(drawing),
  '<!DOCTYPE svg SYSTEM "file:///etc/passwd">' + root(drawing),
  root('<metadata><script>alert(1)</script></metadata>' + drawing),
  root('<metadata>&external;</metadata>' + drawing),
  root('<script>alert(1)</script>' + drawing),
  root('<path onload="alert(1)" d="M0 0"/>'),
  root('<use href="#shape"/>'),
  root('<defs><linearGradient id="paint"/></defs>' + drawing),
  root('<path style="fill:red" d="M0 0"/>'),
  root('<image href="https://example.com/image.png"/>'),
  exported.replace('svg10.dtd"', 'svg10.dtd" [<!ENTITY x "test">]'),
]) {
  assert.equal(sanitize(source), null, "Reject unsafe or unsupported structures");
}
assert.equal(sanitizeSiteBrandLogoSvg(Buffer.alloc(256 * 1024 + 1)), null);
assert.equal(sanitizeSiteBrandLogoSvg(Buffer.from([0xff])), null);
console.log("Site logo SVG import: OK (Potrace export, drawing preservation, stored validation, recoloring and rejected content).");
