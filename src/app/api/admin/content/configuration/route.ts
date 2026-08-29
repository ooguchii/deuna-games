import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialSiteConfigFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveSiteConfigDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "name",
  "shortName",
  "description",
  "language",
  "themeColor",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      "/admin/configuracion?estado=solicitud"
    );
  }

  const parsed = editorialSiteConfigFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      "/admin/configuracion?estado=datos"
    );
  }

  try {
    const { expectedRevision, ...input } = parsed.data;
    const result = await saveSiteConfigDraft(
      expectedRevision,
      authorized.session.userId,
      input
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/configuracion?estado=no-encontrado"
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `/admin/configuracion?estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo guardar la configuración editorial."
    );
    return adminUnavailableResponse();
  }
}
