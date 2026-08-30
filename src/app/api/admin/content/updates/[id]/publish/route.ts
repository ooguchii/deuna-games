import {
  revalidatePath,
} from "next/cache";
import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  publishUpdateDraft,
} from "@/lib/admin/publication-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshPublishedUpdates() {
  revalidatePath("/");
  revalidatePath("/actualizaciones");
  revalidatePath("/juegos", "layout");
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { id } = await context.params;
  const target =
    `/admin/actualizaciones/${encodeURIComponent(id)}`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      ["expectedRevision"]
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud`
    );
  }

  const expected = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedRevision")
  );

  if (!expected.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos`
    );
  }

  try {
    const result = await publishUpdateDraft(
      id,
      expected.data,
      authorized.session.userId
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/actualizaciones?estado=no-encontrado"
      );
    }

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto`
      );
    }

    if (result.outcome === "published") {
      refreshPublishedUpdates();
    }

    const state =
      result.outcome === "published"
        ? "publicado"
        : "sin-cambios";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo publicar el borrador de la actualización."
    );
    return adminUnavailableResponse();
  }
}
