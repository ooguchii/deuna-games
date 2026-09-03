import type { NextRequest } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  getEditorialItem,
  saveSiteConfigDraft,
} from "@/lib/admin/content-service";
import {
  frontendSiteConfigFormSchema,
} from "@/lib/admin/frontend-content-forms";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "name",
  "shortName",
  "description",
  "language",
  "themeColor",
  "brandColor",
  "footerTagline",
] as const;

export async function POST(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("seccion") === "apariencia"
    ? "apariencia"
    : "identidad";
  const panel = section === "apariencia"
    ? "&panel=palette"
    : "";
  const redirectPath = (state: string) =>
    `/admin/configuracion?seccion=${section}${panel}&estado=${state}`;
  const authorized =
    await authorizeAdminFormRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (
    !hasExactAdminFormFields(
      authorized.form,
      fields
    )
  ) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath("solicitud")
    );
  }

  const parsed = frontendSiteConfigFormSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath("datos")
    );
  }

  try {
    const current = await getEditorialItem(
      "site_config",
      "site"
    );

    if (!current) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("no-encontrado")
      );
    }

    const { expectedRevision, ...input } = parsed.data;
    const result = await saveSiteConfigDraft(
      expectedRevision,
      authorized.session.userId,
      {
        ...input,
        backgroundLibrary:
          current.payload.backgroundLibrary,
        pageBackgrounds:
          current.payload.pageBackgrounds,
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("no-encontrado")
      );
    }

    const state =
      result.outcome === "conflict"
        ? "conflicto"
        : "guardado";

    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(state)
    );
  } catch {
    console.error(
      "No se pudo guardar la configuración editorial."
    );
    return adminUnavailableResponse();
  }
}
