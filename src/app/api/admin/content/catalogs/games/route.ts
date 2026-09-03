import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  gameTaxonomyFormSchema,
} from "@/lib/admin/game-taxonomy-forms";
import {
  saveGameTaxonomyDraft,
} from "@/lib/admin/game-taxonomy-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "taxonomyJson",
] as const;

function catalogSection(request: NextRequest) {
  return request.nextUrl.searchParams.get("seccion") === "etiquetas"
    ? "etiquetas"
    : "clasificaciones";
}

function target(page: string, state: string, section: string) {
  return `${page}?estado=${state}&seccion=${section}`;
}

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const page = "/admin/catalogos";
  const section = catalogSection(request);

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      target(page, "solicitud", section)
    );
  }

  const parsed = gameTaxonomyFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      target(page, "datos", section)
    );
  }

  try {
    const result = await saveGameTaxonomyDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      parsed.data.taxonomyJson
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        target(page, "no-encontrado", section)
      );
    }

    if (result.outcome === "in_use") {
      return adminRedirect(
        authorized.adminOrigin,
        target(page, "catalogo-en-uso", section)
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "catalogo-guardado";

    return adminRedirect(
      authorized.adminOrigin,
      target(page, state, section)
    );
  } catch {
    console.error(
      "No se pudo guardar la taxonomía privada de juegos."
    );
    return adminUnavailableResponse();
  }
}
