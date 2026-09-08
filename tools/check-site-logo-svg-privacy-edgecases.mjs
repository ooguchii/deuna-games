import assert from "node:assert/strict";

import {
  inspectPrivacySafeSiteBrandLogoSvg,
  sanitizePrivacySafeSiteBrandLogoSvg,
} from "../src/lib/media/safe-site-logo-svg.ts";

const root = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;

const mixedQuoteTraceA = "private'exporter-trace";
const mixedQuoteTraceB = 'private"exporter-trace';

const mixedQuoteMetadata = root(`
<path d="M2 2h20v20H2z" data-exporter="${mixedQuoteTraceA}" aria-label="${mixedQuoteTraceA}" title="${mixedQuoteTraceA}" style="/* ${mixedQuoteTraceA} */ opacity:.9"/>
<path d='M4 4h16v16H4z' data-exporter='${mixedQuoteTraceB}' aria-label='${mixedQuoteTraceB}' title='${mixedQuoteTraceB}' style='/* ${mixedQuoteTraceB} */ opacity:.8'/>
`);

const mixedQuoteOutput = sanitizePrivacySafeSiteBrandLogoSvg(
  Buffer.from(mixedQuoteMetadata)
);

assert.ok(
  mixedQuoteOutput,
  "Accept safe SVG geometry even when removable metadata contains the opposite quote character"
);
assert.equal(
  mixedQuoteOutput.toString().includes(mixedQuoteTraceA),
  false,
  "Strip double-quoted non-visual metadata even when its value contains apostrophes"
);
assert.equal(
  mixedQuoteOutput.toString().includes(mixedQuoteTraceB),
  false,
  "Strip single-quoted non-visual metadata even when its value contains double quotes"
);
assert.doesNotMatch(
  mixedQuoteOutput.toString(),
  /data-exporter|aria-label|\btitle=|\/\*/i,
  "No removable metadata attribute or CSS comment may survive canonicalization"
);
assert.ok(
  inspectPrivacySafeSiteBrandLogoSvg(mixedQuoteOutput),
  "Mixed-quote metadata output must be stable under the strict privacy reader"
);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const paddedBase64 = png.toString("base64");
const unpaddedBase64 = paddedBase64.replace(/=+$/, "");

assert.notEqual(
  unpaddedBase64,
  paddedBase64,
  "Fixture must exercise genuinely unpadded Base64"
);

const unpaddedEmbeddedRaster = root(
  `<image href="data:image/png;base64,${unpaddedBase64}" x="0" y="0" width="1" height="1"/>`
);
const unpaddedOutput = sanitizePrivacySafeSiteBrandLogoSvg(
  Buffer.from(unpaddedEmbeddedRaster)
);

assert.ok(
  unpaddedOutput,
  "Accept valid unpadded Base64 from real-world SVG exporters"
);
assert.match(
  unpaddedOutput.toString(),
  new RegExp(
    `href="data:image/png;base64,${paddedBase64.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`
  ),
  "Re-emit embedded raster Base64 in one padded canonical representation"
);
assert.ok(
  inspectPrivacySafeSiteBrandLogoSvg(unpaddedOutput),
  "Canonicalized unpadded raster output must be stable at read time"
);

for (const invalidBase64 of [
  "A",
  "AA=A",
]) {
  assert.equal(
    sanitizePrivacySafeSiteBrandLogoSvg(
      Buffer.from(
        root(
          `<image href="data:image/png;base64,${invalidBase64}" x="0" y="0" width="1" height="1"/>`
        )
      )
    ),
    null,
    "Reject malformed or non-canonical embedded Base64 instead of relying on permissive decoder behavior"
  );
}

console.log(
  "Site logo SVG privacy edge cases: OK (mixed-quote metadata stripping, unpadded Base64 compatibility and canonical embedded raster encoding)."
);
