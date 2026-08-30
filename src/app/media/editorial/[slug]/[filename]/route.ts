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

  if (
    !isEditorialMediaSlug(slug) ||
    !isEditorialMediaFilename(filename)
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

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > MAX_EDITORIAL_IMAGE_BYTES
    ) {
      return notFoundResponse();
    }

    const content = await readFile(
      resolved.filePath
    );

    return new Response(
      new Uint8Array(content),
      {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(content.length),
          "Cache-Control":
            "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    return notFoundResponse();
  }
}
