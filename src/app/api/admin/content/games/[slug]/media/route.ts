import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialGameMediaFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveGameMediaDraft,
} from "@/lib/admin/content-service";
import {
  gameEditorSuccessTarget,
  requestedGameEditorContinuation,
} from "@/lib/admin/game-editor-flow";
import {
  inspectLocalImageReferences,
} from "@/lib/admin/game-media-integrity";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "coverImage",
  "heroImage",
  "screenshotsText",
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
    "multimedia"
  );

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=multimedia`
    );
  }

  const parsed = editorialGameMediaFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=multimedia`
    );
  }

  try {
    const {
      expectedRevision,
      screenshotsText,
      ...input
    } = parsed.data;
    const mediaPaths = [
      input.coverImage,
      input.heroImage,
      ...(screenshotsText ?? []),
    ].filter(
      (value): value is string => Boolean(value)
    );
    const mediaIntegrity =
      await inspectLocalImageReferences(mediaPaths);

    if (!mediaIntegrity.ok) {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=asset&seccion=multimedia`
      );
    }

    const result = await saveGameMediaDraft(
      slug,
      expectedRevision,
      authorized.session.userId,
      {
        ...input,
        screenshots: screenshotsText,
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
      "No se pudo guardar la multimedia del juego."
    );
    return adminUnavailableResponse();
  }
}
