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
  "brightness",
  "saturation",
  "contrast",
  "ambientBlur",
  "ambientOpacity",
  "overlayStrength",
] as const;

const formSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  effect: z.enum(["off", "on"]),
  brightness: z.coerce.number().int().min(50).max(220),
  saturation: z.coerce.number().int().min(0).max(200),
  contrast: z.coerce.number().int().min(70).max(160),
  ambientBlur: z.coerce.number().int().min(0).max(90),
  ambientOpacity: z.coerce.number().int().min(0).max(100),
  overlayStrength: z.coerce.number().int().min(0).max(100),
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
        heroImageTuning: {
          brightness: parsed.data.brightness,
          saturation: parsed.data.saturation,
          contrast: parsed.data.contrast,
          ambientBlur: parsed.data.ambientBlur,
          ambientOpacity: parsed.data.ambientOpacity,
          overlayStrength: parsed.data.overlayStrength,
        },
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
      "No se pudo guardar el ajuste visual del Hero."
    );
    return adminUnavailableResponse();
  }
}
