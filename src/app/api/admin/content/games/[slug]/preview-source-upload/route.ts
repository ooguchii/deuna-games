import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  authorizeAdminStreamingMediaRequest,
} from "@/lib/admin/streaming-media-admin-route";
import {
  createStagedUploadedPreviewSource,
  ensureStagedEditorialPreviewProxy,
  removeStagedEditorialPreviewSource,
} from "@/lib/media/editorial-video-staging";
import {
  MAX_PREVIEW_SOURCE_BYTES,
} from "@/lib/media/preview-video-policy";
import {
  isAcceptedStreamedPreviewSource,
} from "@/lib/media/streamed-preview-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function contentLengthFromRequest(request: NextRequest) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const authorized =
    await authorizeAdminStreamingMediaRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const contentLength = contentLengthFromRequest(request);
  const contentType =
    request.headers.get("content-type") ?? "";
  const extension =
    request.headers.get("x-deuna-source-extension") ?? "";
  const revision = expectedRevisionSchema.safeParse(
    request.headers.get("x-deuna-expected-revision")
  );

  if (
    !revision.success ||
    !request.body ||
    (contentLength !== null &&
      (!Number.isSafeInteger(contentLength) ||
        contentLength <= 0 ||
        contentLength > MAX_PREVIEW_SOURCE_BYTES)) ||
    !isAcceptedStreamedPreviewSource(
      `source${extension}`,
      contentType,
      contentLength
    )
  ) {
    return json(
      { error: "El video fuente no es válido." },
      400
    );
  }

  let stagedToken: string | null = null;

  try {
    const item = await getEditorialItem(
      "game",
      slug
    );

    if (!item) {
      return json(
        { error: "El juego ya no está disponible." },
        404
      );
    }

    if (item.revision !== revision.data) {
      return json(
        {
          error:
            "Otra pestaña guardó una revisión más reciente. Recarga el editor antes de preparar el video.",
        },
        409
      );
    }

    const staged = await createStagedUploadedPreviewSource(
      slug,
      authorized.session.userId,
      request.body,
      contentLength,
      contentType
    );
    stagedToken = staged.token;

    const proxy = await ensureStagedEditorialPreviewProxy(staged);

    return json({
      token: staged.token,
      src:
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${staged.token}/proxy`,
      bytes: staged.bytes,
      proxyBytes: proxy.bytes,
      contentType: proxy.contentType,
      expiresAt: staged.expiresAt,
    });
  } catch (error) {
    if (stagedToken) {
      await removeStagedEditorialPreviewSource(stagedToken);
    }

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo preparar la vista previa compatible.",
      },
      400
    );
  }
}
