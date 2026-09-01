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
  authorizeAdminMediaRequest,
} from "@/lib/admin/media-admin-route";
import {
  hasExactAdminMediaFormFields,
  MAX_ADMIN_PREVIEW_REQUEST_BYTES,
} from "@/lib/admin/media-request-security";
import {
  isAcceptedPreviewSource,
  storeEditorialPreviewVideo,
} from "@/lib/media/editorial-video";
import {
  parsePreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "startSeconds",
  "endSeconds",
  "video",
] as const;

function readSingleString(
  form: FormData,
  field: string
) {
  const value = form.get(field);
  return typeof value === "string" ? value : null;
}

function readSingleFile(
  form: FormData,
  field: string
) {
  const value = form.get(field);
  return value instanceof File ? value : null;
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
    await authorizeAdminMediaRequest(
      request,
      {
        maximumBytes:
          MAX_ADMIN_PREVIEW_REQUEST_BYTES,
      }
    );

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !hasExactAdminMediaFormFields(
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
    readSingleString(
      authorized.form,
      "expectedRevision"
    )
  );
  const video = readSingleFile(
    authorized.form,
    "video"
  );
  const trim = parsePreviewTrimWindow(
    readSingleString(
      authorized.form,
      "startSeconds"
    ),
    readSingleString(
      authorized.form,
      "endSeconds"
    )
  );

  if (!trim) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-recorte-invalido&seccion=multimedia`
    );
  }

  if (
    !revision.success ||
    !video ||
    !isAcceptedPreviewSource(video)
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=video-invalido&seccion=multimedia`
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

    const upload = await storeEditorialPreviewVideo(
      slug,
      video,
      trim
    );
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      {
        previewMode: "webm",
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
      "No se pudo preparar el preview de tarjeta:",
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
