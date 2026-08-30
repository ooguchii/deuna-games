import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameAdvancedFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameAdvancedDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "shortTitle",
  "highlightedTitle",
  "developer",
  "publisher",
  "releaseDate",
  "genresText",
  "tagsText",
  "platformsJson",
] as const;

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud#datos-avanzados`
    );
  }

  const parsed = editorialGameAdvancedFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos#datos-avanzados`
    );
  }

  try {
    const {
      expectedRevision,
      genresText,
      tagsText,
      platformsJson,
      ...metadata
    } = parsed.data;
    const result = await saveGameAdvancedDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        ...metadata,
        genres: genresText,
        tags: tagsText,
        platforms: platformsJson,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}#datos-avanzados`
    );
  } catch {
    console.error(
      "No se pudieron guardar los datos avanzados del juego."
    );
    return adminUnavailableResponse();
  }
}
