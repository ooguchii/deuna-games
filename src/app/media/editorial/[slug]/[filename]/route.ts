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

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      slug: string;
      filename: string;
    }>;
  }
) {
  const { slug, filename } = await context.params;
  const isSvg = filename.endsWith(".svg");

  if (
    !isEditorialMediaSlug(slug) ||
    !isEditorialMediaFilename(filename) ||
    (isSvg && slug !== "taxonomy-icons")
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
      : inspectSafeEditorialWebp(content);

    if (!safe) {
      return notFoundResponse();
    }

    const headers: Record<string, string> = {
      "Content-Type": isSvg
        ? "image/svg+xml; charset=utf-8"
        : "image/webp",
      "Content-Length": String(content.length),
      "Cache-Control":
        "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    if (isSvg) {
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'none'; sandbox";
    }

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
