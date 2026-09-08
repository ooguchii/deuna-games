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

const siteBrandAllowedElements = new Set([
  "svg",
  "g",
  "a",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "solidcolor",
  "clippath",
  "mask",
  "pattern",
  "symbol",
  "use",
  "marker",
  "filter",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "feconvolvematrix",
  "fediffuselighting",
  "fedisplacementmap",
  "fedistantlight",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "fegaussianblur",
  "feimage",
  "femerge",
  "femergenode",
  "femorphology",
  "feoffset",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "text",
  "tspan",
  "textpath",
  "title",
  "desc",
  "style",
  "switch",
  "image",
  "view",
  "meshgradient",
  "meshrow",
  "meshpatch",
  "hatch",
  "hatchpath",
]);

const siteBrandTextElements = new Set([
  "text",
  "tspan",
  "textpath",
  "title",
  "desc",
]);

const forbiddenSiteBrandElements =
  /<\s*\/?\s*(?:[A-Za-z_][A-Za-z0-9_.-]*:)?(?:script|foreignObject|iframe|object|embed|audio|video|canvas|animate|animateMotion|animateTransform|set|handler|listener|discard)\b/i;
const safeInternalReference =
  /^#[A-Za-z0-9_.:-]{1,256}$/;
const safeEmbeddedRaster =
  /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const MAX_SITE_BRAND_ELEMENT_TOKENS = 40_000;

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

function predefinedEntitiesAreSafe(
  value: string,
  allowNumeric = false
) {
  const predefined = value.replace(
    /&(amp|lt|gt|quot|apos);/g,
    ""
  );
  const remaining = allowNumeric
    ? predefined.replace(
        /&#(?:[0-9]+|x[0-9a-f]+);/gi,
        ""
      )
    : predefined;

  return !remaining.includes("&");
}

function internalUrlsAreSafe(value: string) {
  if (
    /\\/.test(value) ||
    /(?:javascript|vbscript|file|ftp|https?):/i.test(value) ||
    /(^|[^:])\/\//.test(value)
  ) {
    return false;
  }

  const urlPattern =
    /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(value))) {
    if (!safeInternalReference.test(match[2]!.trim())) {
      return false;
    }
  }

  return !/url\s*\(/i.test(
    value.replace(urlPattern, "")
  );
}

function cssDeclarationsAreSafe(source: string) {
  const normalized = source.replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );

  if (
    /[\\{}<>@]/.test(normalized) ||
    /!\s*important/i.test(normalized) ||
    /expression\s*\(/i.test(normalized)
  ) {
    return false;
  }

  for (const rawDeclaration of normalized.split(";")) {
    const declaration = rawDeclaration.trim();
    if (!declaration) continue;

    const separator = declaration.indexOf(":");
    if (separator <= 0) return false;

    const property = declaration
      .slice(0, separator)
      .trim();
    const value = declaration
      .slice(separator + 1)
      .trim();

    if (
      !/^(?:--)?[A-Za-z][A-Za-z0-9-]*$/.test(property) ||
      !value ||
      !predefinedEntitiesAreSafe(value) ||
      !internalUrlsAreSafe(value) ||
      /(?:javascript|vbscript|file|ftp|https?|data):/i.test(value)
    ) {
      return false;
    }
  }

  return true;
}

function styleSheetIsSafe(source: string) {
  const normalized = source.replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );

  if (
    /[\\<>@]/.test(normalized) ||
    /expression\s*\(/i.test(normalized)
  ) {
    return false;
  }

  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(normalized))) {
    if (normalized.slice(cursor, match.index).trim()) {
      return false;
    }

    const selector = match[1]!.trim();
    const declarations = match[2] ?? "";

    if (
      !selector ||
      /(?:javascript|vbscript|file|ftp|https?|data):/i.test(selector) ||
      !cssDeclarationsAreSafe(declarations)
    ) {
      return false;
    }

    cursor = rulePattern.lastIndex;
  }

  return !normalized.slice(cursor).trim();
}

function brandHrefIsSafe(
  value: string,
  elementName: string
) {
  const normalized = value.trim();

  if (safeInternalReference.test(normalized)) {
    return true;
  }

  return (
    (elementName === "image" ||
      elementName === "feimage") &&
    safeEmbeddedRaster.test(normalized)
  );
}

function siteBrandAttributesAreSafe(
  source: string,
  elementName: string,
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

    if (
      /^on/i.test(rawName) ||
      name === "src" ||
      name === "xml:base"
    ) {
      return false;
    }

    if (
      name === "xmlns" ||
      name.startsWith("xmlns:")
    ) {
      if (
        !root ||
        /[<>\u0000-\u001f]/.test(value) ||
        !predefinedEntitiesAreSafe(value)
      ) {
        return false;
      }

      if (
        name === "xmlns" &&
        value !== "http://www.w3.org/2000/svg"
      ) {
        return false;
      }
    } else if (
      name === "href" ||
      name === "xlink:href"
    ) {
      if (!brandHrefIsSafe(value, elementName)) {
        return false;
      }
    } else if (name === "style") {
      if (!cssDeclarationsAreSafe(value)) {
        return false;
      }
    } else {
      if (
        (
          rawName.includes(":") &&
          name !== "xml:space" &&
          name !== "xml:lang"
        ) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(value) ||
        !predefinedEntitiesAreSafe(value) ||
        !internalUrlsAreSafe(value) ||
        /(?:javascript|vbscript|file|ftp|https?|data):/i.test(value)
      ) {
        return false;
      }
    }

    cursor = attributePattern.lastIndex;
  }

  return !source.slice(cursor).trim();
}

function siteBrandTextIsSafe(
  source: string,
  parent: string | undefined
) {
  if (!source.trim()) return true;
  if (!parent) return false;

  if (parent === "style") {
    return styleSheetIsSafe(source);
  }

  return (
    siteBrandTextElements.has(parent) &&
    !/[<>]/.test(source) &&
    predefinedEntitiesAreSafe(source, true)
  );
}

function normalizedSiteBrandLogoText(input: Buffer) {
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

  if (
    /<!ENTITY\b/i.test(source) ||
    /<!DOCTYPE\b[^>]*\[/i.test(source)
  ) {
    return null;
  }

  source = source
    .replace(/^<\?xml\s+[^?]*\?>\s*/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE\b[^<>]*>\s*/gi, "")
    .replace(
      /<metadata\b[^>]*>[\s\S]*?<\/metadata\s*>\s*/gi,
      ""
    )
    .replace(/<metadata\b[^>]*\/\s*>\s*/gi, "")
    .replace(
      /<style\b([^>]*)>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/style\s*>/gi,
      "<style$1>$2</style>"
    )
    .replace(
      /^(<svg\b[^<>]*?)\s+version\s*=\s*(["'])[^"']*\2/i,
      "$1"
    )
    .trim();

  if (
    !source ||
    !/^<svg\b/i.test(source) ||
    forbiddenSiteBrandElements.test(source) ||
    /<\?/i.test(source) ||
    /<!/i.test(source)
  ) {
    return null;
  }

  const tagPattern =
    /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:_-]*)([^<>]*?)\s*(\/?)>/g;
  const stack: string[] = [];
  let cursor = 0;
  let firstTag = true;
  let closedRoot = false;
  let tokenCount = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source))) {
    if (
      !siteBrandTextIsSafe(
        source.slice(cursor, match.index),
        stack.at(-1)
      )
    ) {
      return null;
    }

    const closing = match[1] === "/";
    const rawName = match[2]!;
    const name = rawName.toLowerCase();
    const attributes = match[3] ?? "";
    const selfClosing = match[4] === "/";

    tokenCount += 1;
    if (
      tokenCount > MAX_SITE_BRAND_ELEMENT_TOKENS ||
      rawName.includes(":") ||
      !siteBrandAllowedElements.has(name)
    ) {
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
        !siteBrandAttributesAreSafe(
          attributes,
          name,
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
    !siteBrandTextIsSafe(
      source.slice(cursor),
      stack.at(-1)
    )
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

function safeNormalizedSiteBrandLogoSource(input: Buffer) {
  const source = normalizedSiteBrandLogoText(input);

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

function shouldPreservePaint(value: string) {
  return (
    transparentPaint(value) ||
    /^url\(\s*(["']?)#[A-Za-z0-9_.:-]{1,256}\1\s*\)$/i.test(
      value.trim()
    )
  );
}

function recolorCssDeclarations(
  source: string,
  color: string
) {
  return source.replace(
    /(^|;)(\s*)(fill|stroke|stop-color|flood-color|lighting-color|color)(\s*:\s*)([^;}]*)/gi,
    (
      full,
      prefix: string,
      spacing: string,
      property: string,
      separator: string,
      value: string
    ) =>
      shouldPreservePaint(value)
        ? full
        : `${prefix}${spacing}${property}${separator}${color}`
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

// Brand logos accept a broad static SVG subset. Exporter metadata and XML
// decorations are removed, but executable content and remote resources stay
// forbidden. The stored asset is normalized once and revalidated on reads.
export function sanitizeSiteBrandLogoSvg(input: Buffer): Buffer | null {
  const source = normalizedSiteBrandLogoText(input);

  if (!source || !hasScalableViewBox(source)) {
    return null;
  }

  return Buffer.from(`${source}\n`, "utf8");
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
  const source = safeNormalizedSiteBrandLogoSource(input);

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

  const source = safeNormalizedSiteBrandLogoSource(input);
  if (!source || !hasScalableViewBox(source)) {
    return null;
  }

  let recolored = source.replace(
    /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(["'])([^"']*)\2/gi,
    (
      attribute,
      name: string,
      quote: string,
      value: string
    ) =>
      shouldPreservePaint(value)
        ? attribute
        : `${name}=${quote}${color}${quote}`
  );

  recolored = recolored.replace(
    /\bstyle\s*=\s*(["'])([^"']*)\1/gi,
    (
      _attribute,
      quote: string,
      value: string
    ) =>
      `style=${quote}${recolorCssDeclarations(value, color)}${quote}`
  );

  recolored = recolored.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (
      _block,
      opening: string,
      css: string,
      closing: string
    ) => {
      const recoloredCss = css.replace(
        /\{([^{}]*)\}/g,
        (_rule, declarations: string) =>
          `{${recolorCssDeclarations(declarations, color)}}`
      );

      return `${opening}${recoloredCss}${closing}`;
    }
  );

  const root = recolored.match(/^<svg\b([^<>]*)>/i);
  if (!root) return null;

  if (
    !/\bfill\s*=/i.test(root[1] ?? "") &&
    !/\bstyle\s*=\s*(["'])[^"']*\bfill\s*:/i.test(
      root[1] ?? ""
    )
  ) {
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
