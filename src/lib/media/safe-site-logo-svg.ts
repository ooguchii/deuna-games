import {
  inspectSafeSiteBrandLogoSvg,
  MAX_TAXONOMY_SVG_ICON_BYTES,
  sanitizeSiteBrandLogoSvg,
  type SafeTaxonomySvgInspection,
} from "./safe-svg-icon.ts";
import {
  sanitizeSiteBrandLogoRaster,
} from "./safe-site-logo-raster.ts";

const embeddedRasterDataUriPattern =
  /\b(href|xlink:href)\s*=\s*(["'])data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)\2/gi;

const anyEmbeddedRasterDataUriPattern =
  /data:image\/(?:png|jpe?g|webp);base64,/gi;

function isCanonicalBase64(value: string) {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  );
}

function expectedRasterFormat(mimeSubtype: string) {
  const normalized = mimeSubtype.toLowerCase();

  if (normalized === "png") return "png" as const;
  if (normalized === "webp") return "webp" as const;
  if (normalized === "jpg" || normalized === "jpeg") {
    return "jpg" as const;
  }

  return null;
}

function canonicalRasterMime(format: "png" | "jpg" | "webp") {
  if (format === "jpg") return "image/jpeg";
  return `image/${format}`;
}

function stripCssComments(value: string) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Drops non-visual descriptive/exporter fields after the broad SVG parser has
 * already established that the document is static and structurally safe.
 * SiteLogoMark renders the asset as decorative background/mask, so these
 * fields are not part of the accessibility contract and can otherwise carry
 * author, exporter, prompt or filename traces without changing the picture.
 */
function stripNonVisualSiteBrandSvgMetadata(
  input: Buffer
) {
  const source = input.toString("utf8");
  const withoutDescriptiveElements = source
    .replace(
      /<\s*(title|desc)\b[^>]*>[\s\S]*?<\/\s*\1\s*>\s*/gi,
      ""
    )
    .replace(
      /<\s*(?:title|desc)\b[^>]*\/\s*>\s*/gi,
      ""
    );
  const withoutNonVisualAttributes =
    withoutDescriptiveElements.replace(
      /\s+(?:data-[A-Za-z0-9_.:-]+|aria-[A-Za-z0-9_.:-]+|role|tabindex|focusable|title)\s*=\s*(["'])[^"']*\1/gi,
      ""
    );
  const withoutInlineCssComments =
    withoutNonVisualAttributes.replace(
      /\bstyle\s*=\s*(["'])([^"']*)\1/gi,
      (
        _full,
        quote: string,
        value: string
      ) =>
        `style=${quote}${stripCssComments(value)}${quote}`
    );
  const withoutStyleBlockComments =
    withoutInlineCssComments.replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
      (
        _full,
        opening: string,
        css: string,
        closing: string
      ) =>
        `${opening}${stripCssComments(css)}${closing}`
    );

  return Buffer.from(
    withoutStyleBlockComments,
    "utf8"
  );
}

/**
 * Rewrites embedded raster data URIs inside an already-safe brand SVG.
 *
 * The broad SVG contract deliberately permits PNG/JPEG/WebP data URIs for
 * static exports. Those nested files must cross the same privacy boundary as
 * top-level raster logos: content detection, static-only validation and
 * metadata removal. Otherwise EXIF/XMP/ICC/comments could survive inside an
 * otherwise sanitized SVG.
 */
export function sanitizeSiteBrandLogoEmbeddedRasters(
  input: Buffer
): Buffer | null {
  if (
    input.length <= 0 ||
    input.length > MAX_TAXONOMY_SVG_ICON_BYTES
  ) {
    return null;
  }

  const source = input.toString("utf8");
  let invalid = false;
  let replacements = 0;

  const normalized = source.replace(
    embeddedRasterDataUriPattern,
    (
      _full,
      attributeName: string,
      quote: string,
      mimeSubtype: string,
      base64: string
    ) => {
      const compactBase64 = base64.replace(/\s+/g, "");
      const expectedFormat = expectedRasterFormat(mimeSubtype);

      if (
        !expectedFormat ||
        !isCanonicalBase64(compactBase64)
      ) {
        invalid = true;
        return _full;
      }

      const decoded = Buffer.from(
        compactBase64,
        "base64"
      );

      if (
        decoded.length === 0 ||
        decoded.toString("base64") !== compactBase64
      ) {
        invalid = true;
        return _full;
      }

      const sanitized = sanitizeSiteBrandLogoRaster(decoded);

      if (
        !sanitized ||
        sanitized.inspection.format !== expectedFormat
      ) {
        invalid = true;
        return _full;
      }

      replacements += 1;

      return `${attributeName}=${quote}${canonicalRasterMime(
        expectedFormat
      )};base64,${sanitized.buffer.toString("base64")}${quote}`;
    }
  );

  if (invalid) return null;

  const advertisedEmbeddedRasters =
    source.match(anyEmbeddedRasterDataUriPattern)?.length ?? 0;

  if (advertisedEmbeddedRasters !== replacements) {
    return null;
  }

  const output = Buffer.from(normalized, "utf8");

  return output.length <= MAX_TAXONOMY_SVG_ICON_BYTES
    ? output
    : null;
}

export function sanitizePrivacySafeSiteBrandLogoSvg(
  input: Buffer
): Buffer | null {
  const structurallySafe = sanitizeSiteBrandLogoSvg(input);
  if (!structurallySafe) return null;

  const withoutNonVisualMetadata =
    stripNonVisualSiteBrandSvgMetadata(structurallySafe);
  const sanitized = sanitizeSiteBrandLogoEmbeddedRasters(
    withoutNonVisualMetadata
  );

  if (!sanitized) return null;

  return inspectSafeSiteBrandLogoSvg(sanitized)
    ? sanitized
    : null;
}

export function inspectPrivacySafeSiteBrandLogoSvg(
  input: Buffer
): SafeTaxonomySvgInspection | null {
  const inspection = inspectSafeSiteBrandLogoSvg(input);
  if (!inspection) return null;

  const withoutNonVisualMetadata =
    stripNonVisualSiteBrandSvgMetadata(input);

  if (!withoutNonVisualMetadata.equals(input)) {
    return null;
  }

  const normalized = sanitizeSiteBrandLogoEmbeddedRasters(input);

  if (!normalized || !normalized.equals(input)) {
    return null;
  }

  return inspection;
}
