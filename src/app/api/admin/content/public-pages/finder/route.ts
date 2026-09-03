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
  publicFinderFormSchema,
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
  "flow1",
  "flow2",
  "flow3",
  "trustText",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const target =
    "/admin/paginas/presentacion?seccion=compatibilidad";

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

  const parsed = publicFinderFormSchema.safeParse(
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
        finder: parsed.data.page,
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
      "No se pudo guardar la presentación pública del recomendador."
    );
    return adminUnavailableResponse();
  }
}
