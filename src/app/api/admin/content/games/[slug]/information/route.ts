import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  gameEditorSuccessTarget,
  requestedGameEditorContinuation,
} from "@/lib/admin/game-editor-flow";
import {
  saveGameInformationSection,
} from "@/lib/admin/game-editor-sections-service";
import {
  gameInformationSectionSchema,
} from "@/lib/admin/game-editor-section-validation";
import {
  getGamePublicationIdentity,
} from "@/lib/admin/publication-overview";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "title",
  "description",
  "shortTitle",
  "highlightedTitle",
  "developer",
  "publisher",
  "releaseDate",
  "version",
  "badge",
  "imageAlt",
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
    "ficha"
  );

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=ficha`
    );
  }

  const parsed = gameInformationSectionSchema.safeParse(
    Object.fromEntries(authorized.form)
  );
  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=ficha`
    );
  }

  try {
    const [item, publicationIdentity] = await Promise.all([
      getEditorialItem("game", slug),
      getGamePublicationIdentity(slug),
    ]);
    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const { expectedRevision, ...input } = parsed.data;
    const version = publicationIdentity?.everPublished
      ? item.payload.version
      : input.version;
    const result = await saveGameInformationSection(
      slug,
      expectedRevision,
      authorized.session.userId,
      { ...input, version }
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
        `${target}?estado=conflicto&seccion=ficha`
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      gameEditorSuccessTarget(target, "ficha", continuation)
    );
  } catch {
    console.error("No se pudo guardar Información del juego.");
    return adminUnavailableResponse();
  }
}
