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
  revisionIdSchema,
} from "@/lib/admin/content-forms";
import {
  restoreUpdatePublication,
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
    params: Promise<{ publicationId: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { publicationId } = await context.params;
  const parsedPublicationId =
    revisionIdSchema.safeParse(publicationId);

  if (
    !parsedPublicationId.success ||
    !hasExactAdminFormFields(
      authorized.form,
      ["expectedPublicationNumber"]
    )
  ) {
    return new Response("Solicitud rechazada.", {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const expected = expectedRevisionSchema.safeParse(
    authorized.form.get("expectedPublicationNumber")
  );

  if (!expected.success) {
    return new Response("Solicitud rechazada.", {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  try {
    const result = await restoreUpdatePublication(
      parsedPublicationId.data,
      expected.data,
      authorized.session.userId
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/actualizaciones?estado=no-encontrado"
      );
    }

    const target =
      `/admin/actualizaciones/${encodeURIComponent(result.key)}`;

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto-publicacion&seccion=publicacion`
      );
    }

    if (result.outcome === "restored") {
      refreshPublishedUpdates();
    }

    const state =
      result.outcome === "restored"
        ? "publicacion-restaurada"
        : "sin-cambios";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}&seccion=publicacion`
    );
  } catch {
    console.error(
      "No se pudo restaurar la publicación de la actualización."
    );
    return adminUnavailableResponse();
  }
}
