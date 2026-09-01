import {
  lstat,
  readFile,
} from "node:fs/promises";

import {
  buildEditorialMediaPublicPath,
  isEditorialMediaFilename,
  isEditorialMediaSlug,
  resolveEditorialMediaDiskPath,
} from "@/lib/media/editorial-media";
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (
    !isEditorialMediaSlug(slug) ||
    !isEditorialMediaFilename(filename) ||
    (isSvg && slug !== "taxonomy-icons") ||
    (isWebm && slug === "taxonomy-icons")
  ) {
    return notFoundResponse();
  }

  try {
    const publicPath = buildEditorialMediaPublicPath(
      slug,
      filename
    );
    const resolved =
      resolveEditorialMediaDiskPath(publicPath);

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

    const content = await readFile(
      resolved.filePath
    );
    const safe = isSvg
      ? inspectSafeTaxonomySvgIcon(content)
      : isWebm
        ? inspectSafeEditorialWebm(content)
        : inspectSafeEditorialWebp(content);

    if (!safe) {
      return notFoundResponse();
    }

    const sharedHeaders = {
      "Cache-Control":
        "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    if (isWebm) {
      const range = requestedRange(request, content.length);

      if (range === "invalid") {
        return new Response(null, {
          status: 416,
          headers: {
            ...sharedHeaders,
            "Content-Range": `bytes */${content.length}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      if (range) {
        const body = content.subarray(
          range.start,
          range.end + 1
        );

        return new Response(new Uint8Array(body), {
          status: 206,
          headers: {
            ...sharedHeaders,
            "Content-Type": "video/webm",
            "Content-Length": String(body.length),
            "Content-Range":
              `bytes ${range.start}-${range.end}/${content.length}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

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

    const headers = isSvg
      ? {
          ...sharedHeaders,
          "Content-Length": String(content.length),
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'none'; sandbox",
        }
      : {
          ...sharedHeaders,
          "Content-Length": String(content.length),
          "Content-Type": "image/webp",
        };

    return new Response(
      new Uint8Array(content),
      {
        status: 200,
        headers,
      }
    );
  } catch {
    return notFoundResponse();
  }
}
