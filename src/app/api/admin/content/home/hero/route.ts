import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  homeHeroEditorFormSchema,
} from "@/lib/admin/home-config-forms";
import {
  saveHomeHeroDraft,
} from "@/lib/admin/home-content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision", "heroJson"] as const;
const target = "/admin/portada?seccion=hero";

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=solicitud`
    );
  }

  const parsed = homeHeroEditorFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  try {
    const hero = parsed.data.heroJson;
    const result = await saveHomeHeroDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        mode: hero.mode,
        slugs: hero.slugs,
        presentation: hero.presentation,
      }
    );
    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : result.outcome === "not_found"
          ? "no-encontrado"
          : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo guardar el editor unificado del Hero."
    );
    return adminUnavailableResponse();
  }
}
