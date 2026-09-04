import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  gameEditorSuccessTarget,
  requestedGameEditorContinuation,
} from "@/lib/admin/game-editor-flow";
import {
  saveGameClassificationSection,
} from "@/lib/admin/game-editor-sections-service";
import {
  gameClassificationSectionSchema,
} from "@/lib/admin/game-editor-section-validation";
import {
  resolveGameTaxonomySelection,
} from "@/lib/admin/game-taxonomy-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "category",
  "genresText",
  "tagsText",
] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;

  const { slug } = await context.params;
  const target = `/admin/juegos/${encodeURIComponent(slug)}`;
  const continuation = requestedGameEditorContinuation(
    request.nextUrl,
    "datos"
  );

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=datos`
    );
  }

  const parsed = gameClassificationSectionSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=datos`
    );
  }

  try {
    const {
      expectedRevision,
      category,
      genresText,
      tagsText,
    } = parsed.data;
    const classification = await resolveGameTaxonomySelection({
      category,
      genres: genresText,
      tags: tagsText,
      currentGameKey: slug,
    });

    if (!classification.valid || !classification.category) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=clasificacion&seccion=datos`
      );
    }

    const result = await saveGameClassificationSection(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        category: classification.category,
        genres: classification.genres,
        tags: classification.tags,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }
    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto&seccion=datos`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      gameEditorSuccessTarget(target, "datos", continuation)
    );
  } catch {
    console.error("No se pudo guardar Clasificación del juego.");
    return adminUnavailableResponse();
  }
}
