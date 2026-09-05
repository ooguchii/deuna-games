import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  homePresentationFormSchema,
} from "@/lib/admin/frontend-content-forms";
import {
  saveHomePresentationDraft,
} from "@/lib/admin/home-content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "presentationJson",
] as const;
const target = "/admin/portada?seccion=contenido";

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
      `${target}&estado=solicitud`
    );
  }

  const parsed = homePresentationFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  try {
    const result = await saveHomePresentationDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      parsed.data.presentationJson
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=${
        result.outcome === "conflict"
          ? "conflicto"
          : result.outcome === "not_found"
            ? "no-encontrado"
            : "guardado"
      }`
    );
  } catch {
    console.error(
      "No se pudo guardar la presentación de Portada."
    );
    return adminUnavailableResponse();
  }
}
