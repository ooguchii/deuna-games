import type { NextRequest } from "next/server";

import {
  adminRedirect,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  parsePreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import {
  parseYouTubeVideoUrl,
} from "@/lib/media/youtube-url";
import {
  storeEditorialPreviewVideoFromYouTube,
} from "@/lib/media/youtube-video-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "youtubeUrl",
  "startSeconds",
  "endSeconds",
] as const;

function errorState(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message.includes("yt-dlp no está disponible")) {
    return "ytdlp";
  }

  if (message.includes("FFmpeg no está disponible")) {
    return "ffmpeg";
  }

  if (
    message.includes("worker multimedia") ||
    message.includes("DEUNA_MEDIA_IMPORT_WORKER")
  ) {
    if (message.includes("importación multimedia en curso")) {
      return "youtube-ocupado";
    }
    return "media-worker";
  }

  if (
    message.includes("importación de YouTube en curso") ||
    message.includes("importación multimedia en curso")
  ) {
    return "youtube-ocupado";
  }

  if (
    message.includes("no permite importar") ||
    message.includes("no está disponible públicamente") ||
    message.includes("no pudo obtener")
  ) {
    return "youtube-no-disponible";
  }

  if (
    message.includes("demasiado pesado") ||
    message.includes("debajo de 3 MB")
  ) {
    return "video-pesado";
  }

  if (
    message.includes("recorte") ||
    message.includes("URL")
  ) {
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
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const youtubeUrl =
    authorized.form.get("youtubeUrl")?.trim() ?? "";
  const youtube = parseYouTubeVideoUrl(youtubeUrl);
  const trim = parsePreviewTrimWindow(
    authorized.form.get("startSeconds"),
    authorized.form.get("endSeconds")
  );

  if (!revision.success || !youtube || !trim) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-recorte-invalido&seccion=multimedia`
    );
  }

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

    const upload =
      await storeEditorialPreviewVideoFromYouTube(
        slug,
        youtube.canonicalUrl,
        trim
      );
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      {
        previewClip: upload.publicPath,
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
      "No se pudo preparar el preview de YouTube:",
      error instanceof Error
        ? error.message
        : "error no identificado"
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${errorState(error)}&seccion=multimedia`
    );
  }
}
