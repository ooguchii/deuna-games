import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  adminRedirect,
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
  saveSiteConfigDraft,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "effect",
] as const;

const formSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  effect: z.enum(["off", "on"]),
});

function redirectPath(state: string) {
  return `/admin/configuracion?seccion=apariencia&estado=${state}`;
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminFormRequest(request);

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

  const parsed = formSchema.safeParse(
    Object.fromEntries(authorized.form)
  );

  if (!parsed.success) {
    return adminRedirect(
      authorized.adminOrigin,
      redirectPath("datos")
    );
  }

  try {
    const item = await getEditorialItem(
      "site_config",
      "site"
    );

    if (!item) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("no-encontrado")
      );
    }

    if (item.revision !== parsed.data.expectedRevision) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("conflicto")
      );
    }

    const result = await saveSiteConfigDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        ...item.payload,
        heroImageEffect: parsed.data.effect === "on",
      }
    );

    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(
        result.outcome === "conflict"
          ? "conflicto"
          : result.outcome === "not_found"
            ? "no-encontrado"
            : "guardado"
      )
    );
  } catch {
    console.error(
      "No se pudo guardar el efecto visual del Hero."
    );
    return adminUnavailableResponse();
  }
}
