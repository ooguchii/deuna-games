import {
  lstat,
  open,
  readFile,
} from "node:fs/promises";

import {
  buildEditorialMediaPublicPath,
  isEditorialMediaFilename,
  isEditorialMediaSlug,
  resolveEditorialMediaDiskPath,
} from "@/lib/media/editorial-media";
import {
  resolveEditorialMediaServingAccess,
  TAXONOMY_ICON_MEDIA_SLUG,
} from "@/lib/media/editorial-media-serving";
import {
  inspectSafeSiteBrandLogoRaster,
  siteBrandRasterContentType,
  type SiteBrandRasterFormat,
} from "@/lib/media/safe-site-logo-raster";
import {
  inspectPrivacySafeSiteBrandLogoSvg,
} from "@/lib/media/safe-site-logo-svg";
import {
  inspectSafeTaxonomySvgIcon,
  MAX_TAXONOMY_SVG_ICON_BYTES,
} from "@/lib/media/safe-svg-icon";
import {
  inspectSafeEditorialWebm,
  MAX_EDITORIAL_PREVIEW_BYTES,
} from "@/lib/media/safe-webm";
import {
  inspectSafeEditorialWebp,
  MAX_EDITORIAL_IMAGE_BYTES,
} from "@/lib/media/safe-webp";
import {
  SITE_BRAND_LOGO_SLUG,
} from "@/lib/site/logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_VALIDATED_WEBM_CACHE_ENTRIES = 96;

type ValidatedWebmIdentity = {
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  ino: number;
};

const validatedWebmCache = new Map<
  string,
  ValidatedWebmIdentity
>();

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requestedRange(
  request: Request,
  totalBytes: number
) {
  const value = request.headers.get("range");
  if (!value) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return "invalid" as const;

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";

  if (!startText && !endText) return "invalid" as const;

  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return "invalid" as const;
    }

    return {
      start: Math.max(0, totalBytes - suffix),
      end: totalBytes - 1,
    };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : totalBytes - 1;

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalBytes
  ) {
    return "invalid" as const;
  }

  return {
    start,
    end: Math.min(requestedEnd, totalBytes - 1),
  };
}

function currentWebmIdentity(stats: {
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  ino: number;
}): ValidatedWebmIdentity {
  return {
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    ino: stats.ino,
  };
}

function matchesValidatedIdentity(
  cached: ValidatedWebmIdentity,
  current: ValidatedWebmIdentity
) {
  return (
    cached.size === current.size &&
    cached.mtimeMs === current.mtimeMs &&
    cached.ctimeMs === current.ctimeMs &&
    cached.ino === current.ino
  );
}

function rememberValidatedWebm(
  filePath: string,
  identity: ValidatedWebmIdentity
) {
  validatedWebmCache.delete(filePath);
  validatedWebmCache.set(filePath, identity);

  while (
    validatedWebmCache.size > MAX_VALIDATED_WEBM_CACHE_ENTRIES
  ) {
    const oldest = validatedWebmCache.keys().next().value;
    if (!oldest) break;
    validatedWebmCache.delete(oldest);
  }
}

async function validateWebmForServing(
  filePath: string,
  identity: ValidatedWebmIdentity
) {
  const cached = validatedWebmCache.get(filePath);

  if (cached && matchesValidatedIdentity(cached, identity)) {
    validatedWebmCache.delete(filePath);
    validatedWebmCache.set(filePath, cached);
    return {
      safe: true as const,
      content: null,
    };
  }

  const content = await readFile(filePath);
  const safe = inspectSafeEditorialWebm(content);

  if (!safe) {
    validatedWebmCache.delete(filePath);
    return {
      safe: false as const,
      content: null,
    };
  }

  rememberValidatedWebm(filePath, identity);

  return {
    safe: true as const,
    content,
  };
}

async function readFileRange(
  filePath: string,
  start: number,
  end: number
) {
  const length = end - start + 1;
  const buffer = Buffer.allocUnsafe(length);
  const handle = await open(filePath, "r");

  try {
    let offset = 0;

    while (offset < length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        length - offset,
        start + offset
      );

      if (bytesRead <= 0) {
        throw new Error("No se pudo completar el rango multimedia.");
      }

      offset += bytesRead;
    }

    return buffer;
  } finally {
    await handle.close();
  }
}

function siteLogoRasterFormat(
  filename: string
): SiteBrandRasterFormat | null {
  if (filename.endsWith(".png")) return "png";
  if (filename.endsWith(".jpg")) return "jpg";
  if (filename.endsWith(".webp")) return "webp";
  if (filename.endsWith(".gif")) return "gif";
  return null;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      filename: string;
    }>;
  }
) {
  const { slug, filename } = await context.params;
  const isSvg = filename.endsWith(".svg");
  const isWebm = filename.endsWith(".webm");
  const isWebp = filename.endsWith(".webp");
  const isTaxonomyAsset =
    slug === TAXONOMY_ICON_MEDIA_SLUG;
  const isSiteLogoAsset = slug === SITE_BRAND_LOGO_SLUG;
  const isRestrictedImageNamespace =
    isTaxonomyAsset || isSiteLogoAsset;
  const logoRasterFormat = isSiteLogoAsset
    ? siteLogoRasterFormat(filename)
    : null;

  if (
    !isEditorialMediaSlug(slug) ||
    !isEditorialMediaFilename(filename) ||
    (isSvg && !isRestrictedImageNamespace) ||
    (isWebm && isRestrictedImageNamespace) ||
    (!isSvg && !isWebm && !isWebp && !isSiteLogoAsset) ||
    (isTaxonomyAsset && !isSvg && !isWebp) ||
    (isSiteLogoAsset && !isSvg && !logoRasterFormat)
  ) {
    return notFoundResponse();
  }

  try {
    const publicPath = buildEditorialMediaPublicPath(
      slug,
      filename
    );
    const resolved = resolveEditorialMediaDiskPath(publicPath);

    if (!resolved) {
      return notFoundResponse();
    }

    const stats = await lstat(resolved.filePath);
    const maximumBytes = isSvg
      ? MAX_TAXONOMY_SVG_ICON_BYTES
      : isWebm
        ? MAX_EDITORIAL_PREVIEW_BYTES
        : MAX_EDITORIAL_IMAGE_BYTES;

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > maximumBytes
    ) {
      return notFoundResponse();
    }

    const servingAccess =
      await resolveEditorialMediaServingAccess(
        slug,
        publicPath
      );

    if (!servingAccess) {
      return notFoundResponse();
    }

    const sharedHeaders = {
      "Cache-Control":
        servingAccess === "admin"
          ? "private, no-store, max-age=0"
          : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(servingAccess === "public"
        ? { ETag: `"${filename}"` }
        : {}),
    };

    if (isWebm) {
      const identity = currentWebmIdentity(stats);
      const validation = await validateWebmForServing(
        resolved.filePath,
        identity
      );

      if (!validation.safe) {
        return notFoundResponse();
      }

      const range = requestedRange(request, stats.size);

      if (range === "invalid") {
        return new Response(null, {
          status: 416,
          headers: {
            ...sharedHeaders,
            "Content-Range": `bytes */${stats.size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      if (range) {
        const body = validation.content
          ? validation.content.subarray(
              range.start,
              range.end + 1
            )
          : await readFileRange(
              resolved.filePath,
              range.start,
              range.end
            );

        return new Response(new Uint8Array(body), {
          status: 206,
          headers: {
            ...sharedHeaders,
            "Content-Type": "video/webm",
            "Content-Length": String(body.length),
            "Content-Range":
              `bytes ${range.start}-${range.end}/${stats.size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      const content =
        validation.content ??
        (await readFile(resolved.filePath));

      return new Response(new Uint8Array(content), {
        status: 200,
        headers: {
          ...sharedHeaders,
          "Content-Type": "video/webm",
          "Content-Length": String(content.length),
          "Accept-Ranges": "bytes",
        },
      });
    }

    const content = await readFile(resolved.filePath);
    const safe = isSvg
      ? isSiteLogoAsset
        ? inspectPrivacySafeSiteBrandLogoSvg(content)
        : inspectSafeTaxonomySvgIcon(content)
      : isSiteLogoAsset && logoRasterFormat
        ? inspectSafeSiteBrandLogoRaster(
            content,
            logoRasterFormat
          )
        : inspectSafeEditorialWebp(content);
    const expectedDigest = filename.slice(
      0,
      filename.lastIndexOf(".")
    );

    if (
      !safe ||
      (
        (isSiteLogoAsset || isSvg) &&
        safe.digest !== expectedDigest
      )
    ) {
      return notFoundResponse();
    }

    const headers = isSvg
      ? {
          ...sharedHeaders,
          "Content-Length": String(content.length),
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        }
      : {
          ...sharedHeaders,
          "Content-Length": String(content.length),
          "Content-Type":
            isSiteLogoAsset && logoRasterFormat
              ? siteBrandRasterContentType(logoRasterFormat)
              : "image/webp",
        };

    return new Response(new Uint8Array(content), {
      status: 200,
      headers,
    });
  } catch {
    return notFoundResponse();
  }
}
