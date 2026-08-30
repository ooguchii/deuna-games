import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameCoreDraft,
} from "@/lib/admin/content-service";
import {
  gameEditorSuccessTarget,
  requestedGameEditorContinuation,
} from "@/lib/admin/game-editor-flow";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "title",
  "description",
  "category",
  "version",
  "badge",
  "rating",
  "reviews",
  "imageAlt",
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
  const continuation = requestedGameEditorContinuation(
    request.nextUrl,
    "ficha"
  );

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=ficha`
    );
  }

  const parsed = editorialGameFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=ficha`
    );
  }

  try {
    const { expectedRevision, ...input } = parsed.data;
    const result = await saveGameCoreDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      input
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
      gameEditorSuccessTarget(
        target,
        "ficha",
        continuation
      )
    );
  } catch {
    console.error(
      "No se pudo guardar el borrador del juego."
    );
    return adminUnavailableResponse();
  }
}
