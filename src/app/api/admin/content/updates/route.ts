import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialUpdateCreateFormSchema,
} from "@/lib/admin/content-create-forms";
import {
  createUpdateDraft,
} from "@/lib/admin/content-create-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "id",
  "gameSlug",
  "version",
  "publishedAt",
  "type",
  "summary",
  "featured",
] as const;

export async function POST(
  request: NextRequest
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const createPage = "/admin/actualizaciones/nueva";

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${createPage}?estado=solicitud`
    );
  }

  const parsed =
    editorialUpdateCreateFormSchema.safeParse(
      Object.fromEntries(authorized.form)
    );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${createPage}?estado=datos`
    );
  }

  try {
    const result = await createUpdateDraft(
      authorized.session.userId,
      parsed.data
    );

    if (result.outcome === "exists") {
      return adminRedirect(
        authorized.adminOrigin,
        `${createPage}?estado=duplicado`
      );
    }

    if (result.outcome === "game_not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        `${createPage}?estado=juego-no-encontrado`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `/admin/actualizaciones/${encodeURIComponent(result.key)}?estado=actualizacion-creada`
    );
  } catch {
    console.error(
      "No se pudo crear el borrador de la actualización."
    );
    return adminUnavailableResponse();
  }
}
