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

export function sanitizeTaxonomySvgIcon(
  input: Buffer
): Buffer | null {
  const source = normalizedSvgText(input);

  return source
    ? Buffer.from(`${source}\n`, "utf8")
    : null;
}

export function inspectSafeTaxonomySvgIcon(
  input: Buffer
): SafeTaxonomySvgInspection | null {
  const sanitized = sanitizeTaxonomySvgIcon(input);

  if (
    !sanitized ||
    !sanitized.equals(input)
  ) {
    return null;
  }

  return {
    digest: createHash("sha256")
      .update(input)
      .digest("hex"),
    bytes: input.length,
  };
}
