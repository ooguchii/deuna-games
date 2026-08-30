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
  restoreGamePublication,
} from "@/lib/admin/publication-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function refreshPublishedGame(slug: string) {
  revalidatePath("/");
  revalidatePath("/juegos");
  revalidatePath("/requisitos");
  revalidatePath(`/juegos/${slug}`);
  revalidatePath(`/juegos/${slug}/descargar`);
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
    const result = await restoreGamePublication(
      parsedPublicationId.data,
      expected.data,
      authorized.session.userId
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/juegos?estado=no-encontrado"
      );
    }

    const target =
      `/admin/juegos/${encodeURIComponent(result.key)}/vista-previa`;

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto-publicacion`
      );
    }

    if (result.outcome === "restored") {
      refreshPublishedGame(result.key);
    }

    const state =
      result.outcome === "restored"
        ? "publicacion-restaurada"
        : "sin-cambios";

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${state}`
    );
  } catch {
    console.error(
      "No se pudo restaurar la publicación del juego."
    );
    return adminUnavailableResponse();
  }
}
