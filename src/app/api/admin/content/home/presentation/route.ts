import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  getEditorialItem,
  saveHomeConfigDraft,
} from "@/lib/admin/content-service";
import {
  homePresentationFormSchema,
} from "@/lib/admin/frontend-content-forms";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "presentationJson",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const target =
    "/admin/portada?seccion=presentacion";

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
    const item = await getEditorialItem(
      "home_config",
      "home"
    );

    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}&estado=no-encontrado`
      );
    }

    const result = await saveHomeConfigDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        heroSlugs: item.payload.heroSlugs,
        popularSlugs: item.payload.popularSlugs,
        lowSpecSlugs: item.payload.lowSpecSlugs,
        recommendedSlugs:
          item.payload.recommendedSlugs,
        sections:
          parsed.data.presentationJson.sections,
        copy: parsed.data.presentationJson.copy,
      }
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
