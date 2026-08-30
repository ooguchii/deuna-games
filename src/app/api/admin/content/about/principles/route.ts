import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  aboutPrinciplesFormSchema,
} from "@/lib/admin/about-forms";
import {
  saveAboutPrinciplesDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target = "/admin/paginas/quienes-somos";
const fields = [
  "expectedRevision",
  "introTitle",
  "introHighlight",
  "introParagraph1",
  "introParagraph2",
  "principle1Eyebrow",
  "principle1Title",
  "principle1Text",
  "principle2Eyebrow",
  "principle2Title",
  "principle2Text",
  "principle3Eyebrow",
  "principle3Title",
  "principle3Text",
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

  const parsed = aboutPrinciplesFormSchema.safeParse(
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
    const result = await saveAboutPrinciplesDraft(
      data.expectedRevision,
      authorized.session.userId,
      {
        intro: {
          title: data.introTitle,
          highlight: data.introHighlight,
          paragraphs: [
            data.introParagraph1,
            data.introParagraph2,
          ],
        },
        principles: [
          {
            eyebrow: data.principle1Eyebrow,
            title: data.principle1Title,
            text: data.principle1Text,
          },
          {
            eyebrow: data.principle2Eyebrow,
            title: data.principle2Title,
            text: data.principle2Text,
          },
          {
            eyebrow: data.principle3Eyebrow,
            title: data.principle3Title,
            text: data.principle3Text,
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
      "No se pudieron guardar los principios de Quiénes somos."
    );
    return adminUnavailableResponse();
  }
}
