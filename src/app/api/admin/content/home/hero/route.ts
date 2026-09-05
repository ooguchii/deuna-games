import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
import { HOME_HERO_MAX_FORM_BYTES } from "@/lib/home/hero-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["expectedRevision", "heroJson"] as const;
const target = "/admin/portada?seccion=hero";

export async function POST(request: NextRequest) {
  const jsonResponse = request.headers.get("accept")?.includes("application/json");
  const reply = (
    adminOrigin: string,
    state: string,
    status: number,
    revision?: number
  ) =>
    jsonResponse
      ? NextResponse.json(
          { state, revision },
          {
            status,
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          }
        )
      : adminRedirect(
          adminOrigin,
          `${target}&estado=${state}`
        );

  const authorized =
    await authorizeAdminFormRequest(request, {
      maxFormBytes: HOME_HERO_MAX_FORM_BYTES,
    });
  if (!authorized.authorized) return authorized.response;

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return reply(
      authorized.adminOrigin,
      "solicitud",
      400
    );
  }

  const parsed = homeHeroEditorFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return reply(
      authorized.adminOrigin,
      "datos",
      400
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

    return reply(
      authorized.adminOrigin,
      state,
      result.outcome === "saved"
        ? 200
        : result.outcome === "conflict"
          ? 409
          : 404,
      "revision" in result ? result.revision : undefined
    );
  } catch {
    console.error(
      "No se pudo guardar el editor unificado del Hero."
    );
    return adminUnavailableResponse();
  }
}