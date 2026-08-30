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

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud#multimedia`
    );
  }

  const parsed = editorialGameMediaFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos#multimedia`
    );
  }

  try {
    const {
      expectedRevision,
      screenshotsText,
      ...input
    } = parsed.data;
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

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}#multimedia`
    );
  } catch {
    console.error(
      "No se pudo guardar la multimedia del juego."
    );
    return adminUnavailableResponse();
  }
}
