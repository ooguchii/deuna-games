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
  restorePublicPagesConfigPublication,
} from "@/lib/admin/publication-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target =
  "/admin/paginas/presentacion?seccion=publicacion";

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
    const result = await restorePublicPagesConfigPublication(
      parsedPublicationId.data,
      expected.data,
      authorized.session.userId
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}&estado=no-encontrado`
      );
    }

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}&estado=conflicto-publicacion`
      );
    }

    if (result.outcome === "restored") {
      revalidatePath("/juegos");
      revalidatePath("/actualizaciones");
      revalidatePath("/requisitos");
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=${
        result.outcome === "restored"
          ? "publicacion-restaurada"
          : "sin-cambios"
      }`
    );
  } catch {
    console.error(
      "No se pudo restaurar una publicación de superficies públicas."
    );
    return adminUnavailableResponse();
  }
}
