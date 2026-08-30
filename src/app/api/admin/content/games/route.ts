import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameCreateFormSchema,
} from "@/lib/admin/content-create-forms";
import {
  createGameDraft,
} from "@/lib/admin/content-create-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "slug",
  "title",
  "description",
  "category",
  "version",
  "badge",
  "imageAlt",
] as const;

export async function POST(
  request: NextRequest
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const createPage = "/admin/juegos/nuevo";

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
    editorialGameCreateFormSchema.safeParse(
      Object.fromEntries(authorized.form)
    );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${createPage}?estado=datos`
    );
  }

  try {
    const result = await createGameDraft(
      authorized.session.userId,
      parsed.data
    );

    if (result.outcome === "exists") {
      return adminRedirect(
        authorized.adminOrigin,
        `${createPage}?estado=duplicado`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `/admin/juegos/${encodeURIComponent(result.key)}?estado=creado`
    );
  } catch {
    console.error(
      "No se pudo crear el borrador del juego."
    );
    return adminUnavailableResponse();
  }
}
