import type { NextRequest } from "next/server";

import { resolveHomeConfig } from "@/data/home-config";
import { adminRedirect, adminUnavailableResponse, authorizeAdminFormRequest } from "@/lib/admin/admin-route";
import { getEditorialItem, saveHomeConfigDraft } from "@/lib/admin/content-service";
import { homeHeroEditorFormSchema } from "@/lib/admin/home-config-forms";
import { hasExactAdminFormFields } from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision", "heroJson"] as const;
const target = "/admin/portada?seccion=hero";

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;
  if (!hasExactAdminFormFields(authorized.form, fields)) return adminRedirect(authorized.adminOrigin, `${target}&estado=solicitud`);
  const parsed = homeHeroEditorFormSchema.safeParse(Object.fromEntries(authorized.form));
  if (!parsed.success) return adminRedirect(authorized.adminOrigin, `${target}&estado=datos`);

  try {
    const item = await getEditorialItem("home_config", "home");
    if (!item) return adminRedirect(authorized.adminOrigin, `${target}&estado=no-encontrado`);
    const current = resolveHomeConfig(item.payload);
    const hero = parsed.data.heroJson;
    const result = await saveHomeConfigDraft(parsed.data.expectedRevision, authorized.session.userId, {
      heroSlugs: hero.slugs,
      popularSlugs: current.popularSlugs,
      lowSpecSlugs: current.lowSpecSlugs,
      recommendedSlugs: current.recommendedSlugs,
      curation: { ...current.curation, hero: { mode: hero.mode } },
      heroPresentation: hero.presentation,
      sections: current.sections,
      copy: { ...current.copy, hero: hero.copy },
    });
    const state = result.outcome === "conflict" ? "conflicto" : result.outcome === "not_found" ? "no-encontrado" : "guardado";
    return adminRedirect(authorized.adminOrigin, `${target}&estado=${state}`);
  } catch {
    console.error("No se pudo guardar el editor unificado del Hero.");
    return adminUnavailableResponse();
  }
}
