import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  aboutHeroFormSchema,
} from "@/lib/admin/about-forms";
import {
  saveAboutHeroDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const target = "/admin/paginas/quienes-somos";
const fields = [
  "expectedRevision",
  "heroTitle",
  "heroHighlight",
  "heroText",
  "signal1Title",
  "signal1Text",
  "signal2Title",
  "signal2Text",
  "signal3Title",
  "signal3Text",
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

  const parsed = aboutHeroFormSchema.safeParse(
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
    const result = await saveAboutHeroDraft(
      data.expectedRevision,
      authorized.session.userId,
      {
        title: data.heroTitle,
        highlight: data.heroHighlight,
        text: data.heroText,
        signals: [
          {
            title: data.signal1Title,
            text: data.signal1Text,
          },
          {
            title: data.signal2Title,
            text: data.signal2Text,
          },
          {
            title: data.signal3Title,
            text: data.signal3Text,
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
      "No se pudo guardar el hero de Quiénes somos."
    );
    return adminUnavailableResponse();
  }
}
