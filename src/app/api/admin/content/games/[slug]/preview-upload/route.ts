import { rm } from "node:fs/promises";
import type { NextRequest } from "next/server";

import {
  adminRedirect,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  authorizeAdminStreamingMediaRequest,
} from "@/lib/admin/streaming-media-admin-route";
import {
  storeEditorialPreviewVideoFromPath,
} from "@/lib/media/editorial-video";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import {
  isAcceptedStreamedPreviewSource,
  stageStreamedPreviewSource,
} from "@/lib/media/streamed-preview-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentLengthFromRequest(request: NextRequest) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

function errorState(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message.includes("FFmpeg no está disponible")) {
    return "ffmpeg";
  }

  if (
    message.includes("demasiado pesado") ||
    message.includes("debajo de 3 MB")
  ) {
    return "video-pesado";
  }

  if (message.includes("recorte")) {
    return "preview-recorte-invalido";
  }

  return "video-invalido";
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
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;
  const contentLength = contentLengthFromRequest(request);
  const contentType =
    request.headers.get("content-type") ?? "";
  const extension =
    request.headers.get("x-deuna-source-extension") ?? "";
  const revision = expectedRevisionSchema.safeParse(
    request.headers.get("x-deuna-expected-revision")
  );
  const trim = parsePreviewTrimWindow(
    request.headers.get("x-deuna-trim-start"),
    request.headers.get("x-deuna-trim-end")
  );

  if (!trim) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-recorte-invalido&seccion=multimedia`
    );
  }

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
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=video-invalido&seccion=multimedia`
    );
  }

  let temporaryDirectory: string | null = null;

  try {
    const item = await getEditorialItem(
      "game",
      slug
    );

    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    if (item.revision !== revision.data) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    const staged = await stageStreamedPreviewSource(
      request.body,
      contentLength
    );
    temporaryDirectory = staged.directory;

    const upload =
      await storeEditorialPreviewVideoFromPath(
        slug,
        staged.filePath,
        trim
      );
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      {
        previewClip: upload.publicPath,
        previewMode: undefined,
        youtubePreview: undefined,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-subido&seccion=multimedia`
    );
  } catch (error) {
    console.error(
      "No se pudo preparar el preview de tarjeta:",
      error instanceof Error
        ? error.message
        : "error no identificado"
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${errorState(error)}&seccion=multimedia`
    );
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  }
}
