import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  homePresentationFormSchema,
} from "@/lib/admin/frontend-content-forms";
import {
  editorialHomeConfigFormSchema,
} from "@/lib/admin/home-config-forms";
import {
  saveHomeContentDraft,
} from "@/lib/admin/home-content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "curationJson",
  "presentationJson",
] as const;
const target = "/admin/portada?seccion=contenido";

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=solicitud`
    );
  }

  const raw = Object.fromEntries(authorized.form);
  const curation = editorialHomeConfigFormSchema.safeParse({
    expectedRevision: raw.expectedRevision,
    curationJson: raw.curationJson,
  });
  const presentation = homePresentationFormSchema.safeParse({
    expectedRevision: raw.expectedRevision,
    presentationJson: raw.presentationJson,
  });

  if (!curation.success || !presentation.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=datos`
    );
  }

  if (
    curation.data.expectedRevision !==
    presentation.data.expectedRevision
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=solicitud`
    );
  }

  try {
    const result = await saveHomeContentDraft(
      curation.data.expectedRevision,
      authorized.session.userId,
      curation.data.curationJson,
      presentation.data.presentationJson
    );

    return adminRedirect(
      authorized.adminOrigin,
      `${target}&estado=${
        result.outcome === "conflict"
          ? "conflicto"
          : result.outcome === "not_found"
            ? "no-encontrado"
            : "guardado"
      }`
    );
  } catch {
    console.error(
      "No se pudo guardar Resto de Inicio como una revisión atómica."
    );
    return adminUnavailableResponse();
  }
}
