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
  publishGameDraft,
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
    params: Promise<{ slug: string }>;
  }
) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  const { slug } = await context.params;
  const target =
    `/admin/juegos/${encodeURIComponent(slug)}/vista-previa`;

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
    const result = await publishGameDraft(
      slug,
      expected.data,
      authorized.session.userId
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
        `${target}?estado=conflicto`
      );
    }

    if (result.outcome === "published") {
      refreshPublishedGame(slug);
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
      "No se pudo publicar el borrador del juego."
    );
    return adminUnavailableResponse();
  }
}
