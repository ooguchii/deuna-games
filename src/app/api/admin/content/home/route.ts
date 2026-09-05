import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialHomeConfigFormSchema,
} from "@/lib/admin/home-config-forms";
import {
  saveHomeCurationDraft,
} from "@/lib/admin/home-content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "curationJson",
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

  const parsed = editorialHomeConfigFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  try {
    const result = await saveHomeCurationDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      parsed.data.curationJson
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
      "No se pudo guardar la configuración de portada."
    );
    return adminUnavailableResponse();
  }
}
