import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

import {
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "@/lib/admin/session";
import {
  removeStagedEditorialPreviewSource,
  resolveStagedEditorialPreviewSource,
} from "@/lib/media/editorial-video-staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requestedRange(
  request: NextRequest,
  totalBytes: number
) {
  const value = request.headers.get("range");
  if (!value) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return "invalid" as const;

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";

  if (!startText && !endText) {
    return "invalid" as const;
  }

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
  const requestedEnd = endText
    ? Number(endText)
    : totalBytes - 1;

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

async function authorizedSource(
  request: NextRequest,
  slug: string,
  token: string
) {
  if (!isAdminEnabled()) return null;

  const session = await resolveAdminSession(
    request.cookies.get(
      getAdminSessionCookieName()
    )?.value
  );

  if (!session) return null;

  return resolveStagedEditorialPreviewSource(
    slug,
    session.userId,
    token
  );
}

async function serve(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  },
  headOnly: boolean
) {
  const { slug, token } = await context.params;
  const source = await authorizedSource(
    request,
    slug,
    token
  );

  if (!source) return notFound();

  const range = requestedRange(
    request,
    source.bytes
  );
  const sharedHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": source.contentType,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  };

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        ...sharedHeaders,
        "Content-Range": `bytes */${source.bytes}`,
      },
    });
  }

  if (range) {
    const length = range.end - range.start + 1;
    const body = headOnly
      ? null
      : Readable.toWeb(
          createReadStream(source.filePath, {
            start: range.start,
            end: range.end,
          })
        );

    return new Response(
      body as ReadableStream<Uint8Array> | null,
      {
        status: 206,
        headers: {
          ...sharedHeaders,
          "Content-Length": String(length),
          "Content-Range":
            `bytes ${range.start}-${range.end}/${source.bytes}`,
        },
      }
    );
  }

  const body = headOnly
    ? null
    : Readable.toWeb(
        createReadStream(source.filePath)
      );

  return new Response(
    body as ReadableStream<Uint8Array> | null,
    {
      status: 200,
      headers: {
        ...sharedHeaders,
        "Content-Length": String(source.bytes),
      },
    }
  );
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  return serve(request, context, false);
}

export async function HEAD(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  return serve(request, context, true);
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
      token: string;
    }>;
  }
) {
  const { slug, token } = await context.params;
  const source = await authorizedSource(
    request,
    slug,
    token
  );

  if (!source) return notFound();

  await removeStagedEditorialPreviewSource(token);

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
