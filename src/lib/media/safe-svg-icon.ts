import {
  createHash,
} from "node:crypto";

export const MAX_TAXONOMY_SVG_ICON_BYTES =
  256 * 1024;

const allowedElements = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

const allowedAttributes = new Set([
  "xmlns",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "opacity",
  "transform",
  "preserveaspectratio",
  "vector-effect",
]);

export type SafeTaxonomySvgInspection = {
  digest: string;
  bytes: number;
};

function decodeUtf8(input: Buffer) {
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
    }).decode(input);
  } catch {
    return null;
  }
}

function hasUnsafeValue(value: string) {
  return (
    /[&<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ||
    /(?:javascript|data|file|https?):/i.test(value) ||
    /url\s*\(/i.test(value) ||
    /\/\//.test(value)
  );
}

function attributesAreSafe(
  source: string,
  root: boolean
) {
  const attributePattern =
    /([A-Za-z_:][A-Za-z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(source))) {
    if (source.slice(cursor, match.index).trim()) {
      return false;
    }

    const rawName = match[1]!;
    const name = rawName.toLowerCase();
    const value = match[2] ?? match[3] ?? "";

    if (!allowedAttributes.has(name)) {
      return false;
    }

    if (name === "xmlns") {
      if (
        !root ||
        rawName !== "xmlns" ||
        value !== "http://www.w3.org/2000/svg"
      ) {
        return false;
      }
    } else if (hasUnsafeValue(value)) {
      return false;
    }

    cursor = attributePattern.lastIndex;
  }

  return !source.slice(cursor).trim();
}

function normalizedSvgText(input: Buffer) {
  if (
    input.length === 0 ||
    input.length > MAX_TAXONOMY_SVG_ICON_BYTES
  ) {
    return null;
  }

  const decoded = decodeUtf8(input);

  if (!decoded) return null;

  let source = decoded
    .replace(/^\uFEFF/, "")
    .trim();

  source = source
    .replace(/^<\?xml\s+[^?]*\?>\s*/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (
    !source ||
    !/^<svg\b/i.test(source) ||
    /<!DOCTYPE\b/i.test(source) ||
    /<!ENTITY\b/i.test(source) ||
    /<\?/i.test(source) ||
    /<!(?!\-\-)/i.test(source) ||
    /\bon[a-z0-9_-]+\s*=/i.test(source) ||
    /\b(?:href|xlink:href|src|style)\s*=/i.test(source)
  ) {
    return null;
  }

  const tagPattern =
    /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:_-]*)([^<>]*?)\s*(\/?)>/g;
  const stack: string[] = [];
  let cursor = 0;
  let firstTag = true;
  let closedRoot = false;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source))) {
    if (source.slice(cursor, match.index).trim()) {
      return null;
    }

    const closing = match[1] === "/";
    const name = match[2]!.toLowerCase();
    const attributes = match[3] ?? "";
    const selfClosing = match[4] === "/";

    if (!allowedElements.has(name)) {
      return null;
    }

    if (firstTag) {
      if (closing || selfClosing || name !== "svg") {
        return null;
      }
      firstTag = false;
    } else if (closedRoot) {
      return null;
    }

    if (closing) {
      if (
        selfClosing ||
        attributes.trim() ||
        stack.pop() !== name
      ) {
        return null;
      }

      if (stack.length === 0) {
        if (name !== "svg") return null;
        closedRoot = true;
      }
    } else {
      if (
        !attributesAreSafe(
          attributes,
          name === "svg" && stack.length === 0
        )
      ) {
        return null;
      }

      if (!selfClosing) {
        stack.push(name);
      }
    }

    cursor = tagPattern.lastIndex;
  }

  if (
    firstTag ||
    !closedRoot ||
    stack.length !== 0 ||
    source.slice(cursor).trim()
  ) {
    return null;
  }

  return source;
}

function safeNormalizedSvgSource(input: Buffer) {
  const source = normalizedSvgText(input);

  if (!source) return null;

  const sanitized = Buffer.from(`${source}\n`, "utf8");
  return sanitized.equals(input) ? source : null;
}

function hasScalableViewBox(source: string) {
  const root = source.match(/^<svg\b([^<>]*)>/i);
  if (!root) return false;

  const match = root[1]?.match(
    /\bviewbox\s*=\s*(?:"([^"]+)"|'([^']+)')/i
  );
  const value = match?.[1] ?? match?.[2];
  if (!value) return false;

  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  return (
    numbers.length === 4 &&
    numbers.every(Number.isFinite) &&
    numbers[2]! > 0 &&
    numbers[3]! > 0
  );
}

function transparentPaint(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "none" ||
    normalized === "transparent" ||
    /^#[0-9a-f]{3}0$/i.test(normalized) ||
    /^#[0-9a-f]{6}00$/i.test(normalized) ||
    /^(?:rgba|hsla)\([\s\S]*,\s*0(?:\.0+)?%?\s*\)$/i.test(normalized) ||
    /^(?:rgb|hsl)\([\s\S]*\/\s*0(?:\.0+)?%?\s*\)$/i.test(normalized)
  );
}

export function sanitizeTaxonomySvgIcon(
  input: Buffer
): Buffer | null {
  const source = normalizedSvgText(input);

  return source
    ? Buffer.from(`${source}\n`, "utf8")
    : null;
}

// Exporter-only decorations are removed before the strict drawing validator.
// Never resolve a DTD, expand entities, or retain metadata in the stored asset.
export function sanitizeSiteBrandLogoSvg(input: Buffer): Buffer | null {
  if (!input.length || input.length > MAX_TAXONOMY_SVG_ICON_BYTES) {
    return null;
  }
  const decoded = decodeUtf8(input);
  if (!decoded) return null;

  const source = decoded
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^<\?xml\s+[^?]*\?>\s*/, "")
    .replace(
      /^<!DOCTYPE svg PUBLIC\s+"-\/\/W3C\/\/DTD SVG 20010904\/\/EN"\s+"http:\/\/www\.w3\.org\/TR\/2001\/REC-SVG-20010904\/DTD\/svg10\.dtd"\s*>\s*/,
      ""
    )
    .replace(/<metadata\s*>[^<&]*<\/metadata\s*>/g, "")
    .replace(/^(<svg\b[^<>]*?)\s+version\s*=\s*(["'])1\.[01]\2/, "$1");

  return sanitizeTaxonomySvgIcon(Buffer.from(source, "utf8"));
}

export function inspectSafeTaxonomySvgIcon(
  input: Buffer
): SafeTaxonomySvgInspection | null {
  const source = safeNormalizedSvgSource(input);

  if (!source) return null;

  return {
    digest: createHash("sha256")
      .update(input)
      .digest("hex"),
    bytes: input.length,
  };
}

export function inspectSafeSiteBrandLogoSvg(
  input: Buffer
): SafeTaxonomySvgInspection | null {
  const source = safeNormalizedSvgSource(input);

  if (!source || !hasScalableViewBox(source)) {
    return null;
  }

  return {
    digest: createHash("sha256")
      .update(input)
      .digest("hex"),
    bytes: input.length,
  };
}

export function recolorSafeSiteBrandLogoSvg(
  input: Buffer,
  color: string
): Buffer | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return null;
  }

  const source = safeNormalizedSvgSource(input);
  if (!source || !hasScalableViewBox(source)) {
    return null;
  }

  let recolored = source.replace(
    /\b(fill|stroke)\s*=\s*(["'])([^"']*)\2/gi,
    (attribute, name: string, quote: string, value: string) =>
      transparentPaint(value)
        ? attribute
        : `${name}=${quote}${color}${quote}`
  );
  const root = recolored.match(/^<svg\b([^<>]*)>/i);

  if (!root) return null;

  if (!/\bfill\s*=/i.test(root[1] ?? "")) {
    recolored = recolored.replace(
      /^<svg\b([^<>]*)>/i,
      `<svg$1 fill="${color}">`
    );
  }

  const output = Buffer.from(`${recolored}\n`, "utf8");
  return inspectSafeSiteBrandLogoSvg(output)
    ? output
    : null;
}
