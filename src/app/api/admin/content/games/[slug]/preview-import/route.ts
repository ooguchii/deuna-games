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
  storeEditorialPreviewVideoFromPath,
} from "@/lib/media/editorial-video";
import {
  removeStagedEditorialPreviewSource,
  resolveStagedEditorialPreviewSource,
} from "@/lib/media/editorial-video-staging";
import {
  parsePreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "sourceToken",
  "startSeconds",
  "endSeconds",
] as const;

function errorState(error: unknown) {
  const message = error instanceof Error ? error.message : "";

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
  const authorized = await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );
  const sourceToken = authorized.form.get("sourceToken")?.trim() ?? "";
  const trim = parsePreviewTrimWindow(
    authorized.form.get("startSeconds"),
    authorized.form.get("endSeconds")
  );

  if (!trim) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-recorte-invalido&seccion=multimedia`
    );
  }

  if (!revision.success || !/^[a-f0-9]{48}$/.test(sourceToken)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-source-expirada&seccion=multimedia`
    );
  }

  try {
    const item = await getEditorialItem("game", slug);

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

    const source = await resolveStagedEditorialPreviewSource(
      slug,
      authorized.session.userId,
      sourceToken
    );

    if (!source) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=preview-source-expirada&seccion=multimedia`
      );
    }

    const upload = await storeEditorialPreviewVideoFromPath(
      slug,
      source.filePath,
      trim
    );
    const result = await saveGameMediaDraft(
      slug,
      revision.data,
      authorized.session.userId,
      {
        previewClip: upload.publicPath,
        previewMode: "webm",
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

    await removeStagedEditorialPreviewSource(sourceToken);

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=preview-subido&seccion=multimedia`
    );
  } catch (error) {
    console.error(
      "No se pudo preparar el preview remoto:",
      error instanceof Error ? error.message : "error no identificado"
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${errorState(error)}&seccion=multimedia`
    );
  }
}
