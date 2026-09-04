import type { NextRequest } from "next/server";

import { resolveHomeConfig } from "@/data/home-config";
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
    "/admin/portada?seccion=contenido";

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

    const current = resolveHomeConfig(item.payload);
    const submittedCopy = parsed.data.presentationJson.copy;
    const result = await saveHomeConfigDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        heroSlugs: current.heroSlugs,
        popularSlugs: current.popularSlugs,
        lowSpecSlugs: current.lowSpecSlugs,
        recommendedSlugs: current.recommendedSlugs,
        curation: current.curation,
        heroPresentation: current.heroPresentation,
        sections: parsed.data.presentationJson.sections,
        copy: {
          ...submittedCopy,
          hero: current.copy.hero,
        },
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
