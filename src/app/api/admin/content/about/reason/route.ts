import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  aboutReasonFormSchema,
} from "@/lib/admin/about-forms";
import {
  saveAboutReasonDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target = "/admin/paginas/quienes-somos";
const fields = [
  "expectedRevision",
  "reasonTitle",
  "reasonHighlight",
  "reasonParagraph1",
  "reasonParagraph2",
  "ecosystem1Title",
  "ecosystem1Text",
  "ecosystem2Title",
  "ecosystem2Text",
  "ecosystem3Title",
  "ecosystem3Text",
] as const;

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (!hasExactAdminFormFields(authorized.form, fields)) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=solicitud`
    );
  }

  const parsed = aboutReasonFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=datos`
    );
  }

  try {
    const data = parsed.data;
    const result = await saveAboutReasonDraft(
      data.expectedRevision,
      authorized.session.userId,
      {
        reason: {
          title: data.reasonTitle,
          highlight: data.reasonHighlight,
          paragraphs: [
            data.reasonParagraph1,
            data.reasonParagraph2,
          ],
        },
        ecosystem: [
          {
            title: data.ecosystem1Title,
            text: data.ecosystem1Text,
          },
          {
            title: data.ecosystem2Title,
            text: data.ecosystem2Text,
          },
          {
            title: data.ecosystem3Title,
            text: data.ecosystem3Text,
          },
        ],
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        "/admin/paginas?estado=no-encontrado"
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      `${target}?estado=${
        result.outcome === "conflict"
          ? "conflicto"
          : "guardado"
      }`
    );
  } catch {
    console.error(
      "No se pudo guardar el contenido central de Quiénes somos."
    );
    return adminUnavailableResponse();
  }
}
