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

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const page = "/admin/catalogos";

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${page}?estado=solicitud`
    );
  }

  const parsed = gameTaxonomyFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${page}?estado=datos`
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
        `${page}?estado=no-encontrado`
      );
    }

    if (result.outcome === "in_use") {
      return adminRedirect(
        authorized.adminOrigin,
        `${page}?estado=catalogo-en-uso`
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "catalogo-guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${page}?estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo guardar la taxonomía privada de juegos."
    );
    return adminUnavailableResponse();
  }
}
