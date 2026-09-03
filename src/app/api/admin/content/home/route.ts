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
  editorialHomeConfigFormSchema,
} from "@/lib/admin/home-config-forms";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "curationJson",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const target = "/admin/portada?seccion=curaduria";

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

    const {
      expectedRevision,
      curationJson,
    } = parsed.data;
    const result = await saveHomeConfigDraft(
      expectedRevision,
      authorized.session.userId,
      {
        heroSlugs: curationJson.hero.slugs,
        popularSlugs: curationJson.popular.slugs,
        lowSpecSlugs: curationJson.lowSpec.slugs,
        recommendedSlugs:
          curationJson.recommended.slugs,
        curation: {
          hero: { mode: curationJson.hero.mode },
          popular: { mode: curationJson.popular.mode },
          lowSpec: { mode: curationJson.lowSpec.mode },
          recommended: {
            mode: curationJson.recommended.mode,
          },
        },
        sections: item.payload.sections,
        copy: item.payload.copy,
      }
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
      "No se pudo guardar la configuración de portada."
    );
    return adminUnavailableResponse();
  }
}
