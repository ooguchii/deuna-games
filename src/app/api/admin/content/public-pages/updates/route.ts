import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  savePublicPagesConfigDraft,
} from "@/lib/admin/content-service";
import {
  publicUpdatesFormSchema,
} from "@/lib/admin/frontend-content-forms";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "eyebrow",
  "title",
  "highlight",
  "description",
  "info1Title",
  "info1Text",
  "info2Title",
  "info2Text",
  "info3Title",
  "info3Text",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const target =
    "/admin/paginas/presentacion?seccion=actualizaciones";

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=solicitud`
    );
  }

  const parsed = publicUpdatesFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  try {
    const result = await savePublicPagesConfigDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      (current) => ({
        ...current,
        updates: parsed.data.page,
      })
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}&estado=no-encontrado`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=${
        result.outcome === "conflict"
          ? "conflicto"
          : "guardado"
      }`
    );
  } catch {
    console.error(
      "No se pudo guardar la presentación pública de actualizaciones."
    );
    return adminUnavailableResponse();
  }
}
