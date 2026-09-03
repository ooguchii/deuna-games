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
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  hideUpdatePublication,
} from "@/lib/admin/visibility-service";

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
      ["expectedPublicationNumber"]
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud&seccion=publicacion`
    );
  }

  const expected = expectedRevisionSchema.safeParse(
    authorized.form.get(
      "expectedPublicationNumber"
    )
  );

  if (!expected.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos&seccion=publicacion`
    );
  }

  try {
    const result = await hideUpdatePublication(
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
        `${target}?estado=conflicto-publicacion&seccion=publicacion`
      );
    }

    if (result.outcome === "hidden") {
      refreshPublishedUpdates();
    }

    const state =
      result.outcome === "hidden"
        ? "oculto"
        : "sin-cambios";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}&seccion=publicacion`
    );
  } catch {
    console.error(
      "No se pudo ocultar la publicación de la actualización."
    );
    return adminUnavailableResponse();
  }
}
