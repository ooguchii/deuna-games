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
  storeRemoteEditorialPreviewVideo,
} from "@/lib/media/editorial-video";
import {
  parsePreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "url",
  "startSeconds",
  "endSeconds",
] as const;

function readSingleString(
  form: URLSearchParams,
  field: string
) {
  return form.get(field);
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

  if (
    message.includes("URL") ||
    message.includes("remoto") ||
    message.includes("descarga") ||
    message.includes("HTTPS")
  ) {
    return "preview-url-invalida";
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
    readSingleString(
      authorized.form,
      "expectedRevision"
    )
  );
  const sourceUrl =
    readSingleString(authorized.form, "url")?.trim() ?? "";
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
    sourceUrl.length < 8 ||
    sourceUrl.length > 2_048
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-url-invalida&seccion=multimedia`
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
      await storeRemoteEditorialPreviewVideo(
        slug,
        sourceUrl,
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
      "No se pudo importar el preview remoto:",
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
