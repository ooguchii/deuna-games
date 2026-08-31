import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  aboutManifestoFormSchema,
} from "@/lib/admin/about-forms";
import {
  saveAboutManifestoDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target = "/admin/paginas/quienes-somos?seccion=cierre";
const fields = [
  "expectedRevision",
  "manifestoTitle",
  "manifestoHighlight",
  "manifestoText",
  "ctaTitle",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=solicitud`
    );
  }

  const parsed = aboutManifestoFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  try {
    const data = parsed.data;
    const result = await saveAboutManifestoDraft(
      data.expectedRevision,
      authorized.session.userId,
      {
        manifesto: {
          title: data.manifestoTitle,
          highlight: data.manifestoHighlight,
          text: data.manifestoText,
        },
        ctaTitle: data.ctaTitle,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/paginas?estado=no-encontrado"
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
      "No se pudo guardar el manifiesto de Quiénes somos."
    );
    return adminUnavailableResponse();
  }
}
