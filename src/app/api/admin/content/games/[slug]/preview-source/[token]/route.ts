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
import {
  openMediaImportWorkerPreviewStream,
} from "@/lib/media/media-import-worker-client";
import {
  serveStagedPreviewFile,
} from "@/lib/media/staged-preview-http";

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

function unavailable() {
  return new Response("La vista previa remota no está disponible.", {
    status: 502,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
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

  if (source.kind === "file") {
    return serveStagedPreviewFile(
      request,
      source,
      headOnly
    );
  }

  if (headOnly) {
    return new Response(null, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": source.contentType,
        "Content-Length": String(source.bytes),
        "Accept-Ranges": "bytes",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const streamed = await openMediaImportWorkerPreviewStream(
      source.workerSessionId,
      request.headers.get("range"),
      false
    );
    if (!streamed.stream) return unavailable();
    return new Response(
      Readable.toWeb(streamed.stream) as ReadableStream<Uint8Array>,
      {
        status: streamed.statusCode,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Type": streamed.contentType,
          "Content-Length": String(streamed.contentLength),
          "Accept-Ranges": "bytes",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          ...(streamed.contentRange
            ? { "Content-Range": streamed.contentRange }
            : {}),
        },
      }
    );
  } catch {
    return unavailable();
  }
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
