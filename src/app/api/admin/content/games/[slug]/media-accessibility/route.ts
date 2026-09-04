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
  saveGameMediaAccessibilitySection,
} from "@/lib/admin/game-editor-sections-service";
import {
  gameMediaAccessibilitySectionSchema,
} from "@/lib/admin/game-editor-section-validation";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "accessibilityJson",
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
    "multimedia"
  );

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const parsed = gameMediaAccessibilitySectionSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=multimedia`
    );
  }

  try {
    const result = await saveGameMediaAccessibilitySection(
      slug,
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        mediaAccessibility: parsed.data.accessibilityJson,
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
        `${target}?estado=conflicto&seccion=multimedia`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      gameEditorSuccessTarget(
        target,
        "multimedia",
        continuation
      )
    );
  } catch {
    console.error(
      "No se pudo guardar la accesibilidad multimedia del juego."
    );
    return adminUnavailableResponse();
  }
}
