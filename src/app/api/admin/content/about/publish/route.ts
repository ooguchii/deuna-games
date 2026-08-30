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
  publishAboutConfigDraft,
} from "@/lib/admin/publication-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target = "/admin/paginas/quienes-somos";

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

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
    const result = await publishAboutConfigDraft(
      expected.data,
      authorized.session.userId
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/paginas?estado=no-encontrado"
      );
    }

    if (result.outcome === "conflict") {
      return adminRedirect(
        authorized.adminOrigin,
        `${target}?estado=conflicto`
      );
    }

    if (result.outcome === "published") {
      revalidatePath("/quienes-somos");
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${
        result.outcome === "published"
          ? "publicado"
          : "sin-cambios"
      }`
    );
  } catch {
    console.error(
      "No se pudo publicar la página Quiénes somos."
    );
    return adminUnavailableResponse();
  }
}
