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

function decodeCanonicalBase64(value: string) {
  if (
    value.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    return null;
  }

  const unpadded = value.replace(/=+$/, "");

  if (unpadded.length % 4 === 1) {
    return null;
  }

  const decoded = Buffer.from(unpadded, "base64");
  if (decoded.length === 0) return null;

  const canonical = decoded.toString("base64");

  if (
    canonical.replace(/=+$/, "") !== unpadded
  ) {
    return null;
  }

  return {
    decoded,
    canonical,
  };
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
  if (format === "jpg") return "data:image/jpeg";
  return `data:image/${format}`;
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
      /\s+(?:data-[A-Za-z0-9_.:-]+|aria-[A-Za-z0-9_.:-]+|role|tabindex|focusable|title)\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      ""
    );
  const withoutInlineCssComments =
    withoutNonVisualAttributes.replace(
      /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (
        _full,
        doubleQuotedValue: string | undefined,
        singleQuotedValue: string | undefined
      ) => {
        const usesDoubleQuotes =
          doubleQuotedValue !== undefined;
        const quote = usesDoubleQuotes ? '"' : "'";
        const value = usesDoubleQuotes
          ? doubleQuotedValue
          : singleQuotedValue ?? "";

        return `style=${quote}${stripCssComments(value)}${quote}`;
      }
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
 *
 * The returned SVG is reserialized through the canonical structural sanitizer
 * so callers cannot accidentally persist a valid-but-noncanonical transform.
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
      const decodedPayload = decodeCanonicalBase64(
        compactBase64
      );

      if (!expectedFormat || !decodedPayload) {
        invalid = true;
        return _full;
      }

      const sanitized = sanitizeSiteBrandLogoRaster(
        decodedPayload.decoded
      );

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

  if (output.length > MAX_TAXONOMY_SVG_ICON_BYTES) {
    return null;
  }

  return sanitizeSiteBrandLogoSvg(output);
}

export function sanitizePrivacySafeSiteBrandLogoSvg(
  input: Buffer
): Buffer | null {
  const structurallySafe = sanitizeSiteBrandLogoSvg(input);
  if (!structurallySafe) return null;

  const withoutNonVisualMetadata =
    stripNonVisualSiteBrandSvgMetadata(structurallySafe);
  const nestedRastersSanitized =
    sanitizeSiteBrandLogoEmbeddedRasters(
      withoutNonVisualMetadata
    );

  if (!nestedRastersSanitized) return null;

  const privacyStable = stripNonVisualSiteBrandSvgMetadata(
    nestedRastersSanitized
  );
  if (!privacyStable.equals(nestedRastersSanitized)) {
    return null;
  }

  return inspectSafeSiteBrandLogoSvg(
    nestedRastersSanitized
  )
    ? nestedRastersSanitized
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

  const normalizedRasters =
    sanitizeSiteBrandLogoEmbeddedRasters(input);

  if (
    !normalizedRasters ||
    !normalizedRasters.equals(input)
  ) {
    return null;
  }

  return inspection;
}
