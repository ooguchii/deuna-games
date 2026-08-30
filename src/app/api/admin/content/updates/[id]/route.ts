import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  editorialUpdateFormSchema,
} from "@/lib/admin/content-forms";
import {
  saveUpdateDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "version",
  "publishedAt",
  "type",
  "summary",
  "featured",
] as const;

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
  const target = `/admin/actualizaciones/${encodeURIComponent(id)}`;

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=editar`
    );
  }

  const parsed = editorialUpdateFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=editar`
    );
  }

  try {
    const { expectedRevision, ...input } = parsed.data;
    const result = await saveUpdateDraft(
      id,
      expectedRevision,
      authorized.session.userId,
      input
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/actualizaciones?estado=no-encontrado"
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}&seccion=editar`
    );
  } catch {
    console.error(
      "No se pudo guardar el borrador de actualización."
    );
    return adminUnavailableResponse();
  }
}
