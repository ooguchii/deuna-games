import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameDownloadFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameDownloadDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "sizeGb",
  "fileCount",
  "platform",
  "sourcesJson",
] as const;

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
  const target = `/admin/juegos/${encodeURIComponent(slug)}#descargas`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `/admin/juegos/${encodeURIComponent(slug)}?estado=solicitud#descargas`
    );
  }

  const parsed = editorialGameDownloadFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `/admin/juegos/${encodeURIComponent(slug)}?estado=datos#descargas`
    );
  }

  try {
    const {
      expectedRevision,
      sourcesJson,
      ...metadata
    } = parsed.data;
    const result = await saveGameDownloadDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        ...metadata,
        sources:
          sourcesJson.length > 0
            ? sourcesJson
            : undefined,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `/admin/juegos/${encodeURIComponent(slug)}?estado=${state}#descargas`
    );
  } catch {
    console.error(
      "No se pudo guardar la configuración de descarga."
    );
    return adminUnavailableResponse();
  }
}
