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
import {
  getSiteBackgroundAssets,
} from "@/lib/site/backgrounds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "page",
  "assetId",
  "colorMode",
  "customColor",
  "tintOpacity",
  "imageOpacity",
  "brightness",
  "saturation",
  "contrast",
  "blur",
  "shadeOpacity",
] as const;

const assetIdPattern = /^[a-z0-9][a-z0-9._-]{0,159}$/;

const backgroundFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  page: z.enum([
    "home",
    "games",
    "updates",
    "finder",
    "about",
  ]),
  assetId: z
    .string()
    .trim()
    .max(160)
    .refine(
      (value) => value === "" || assetIdPattern.test(value),
      "Fondo inválido."
    ),
  colorMode: z.enum(["brand", "custom"]),
  customColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  tintOpacity: z.coerce.number().int().min(0).max(100),
  imageOpacity: z.coerce.number().int().min(20).max(100),
  brightness: z.coerce.number().int().min(40).max(220),
  saturation: z.coerce.number().int().min(0).max(200),
  contrast: z.coerce.number().int().min(70).max(160),
  blur: z.coerce.number().int().min(0).max(30),
  shadeOpacity: z.coerce.number().int().min(0).max(100),
});

function redirectPath(state: string) {
  return `/admin/configuracion?seccion=apariencia&panel=backgrounds&estado=${state}`;
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

  const parsed = backgroundFormSchema.safeParse(
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

    const assetId = parsed.data.assetId || null;
    const assets = getSiteBackgroundAssets(
      item.payload.backgroundLibrary ?? []
    );

    if (
      assetId &&
      !assets.some((asset) => asset.id === assetId)
    ) {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("datos")
      );
    }

    const sitePayload = { ...item.payload };
    delete sitePayload.heroImageEffect;
    delete sitePayload.heroImageTuning;

    const result = await saveSiteConfigDraft(
      parsed.data.expectedRevision,
      authorized.session.userId,
      {
        ...sitePayload,
        pageBackgrounds: {
          ...(sitePayload.pageBackgrounds ?? {}),
          [parsed.data.page]: {
            assetId,
            colorMode: parsed.data.colorMode,
            customColor: parsed.data.customColor,
            tintOpacity: parsed.data.tintOpacity,
            imageOpacity: parsed.data.imageOpacity,
            brightness: parsed.data.brightness,
            saturation: parsed.data.saturation,
            contrast: parsed.data.contrast,
            blur: parsed.data.blur,
            shadeOpacity: parsed.data.shadeOpacity,
          },
        },
      }
    );

    if (result.outcome === "not_found") {
      return adminRedirect(
        authorized.adminOrigin,
        redirectPath("no-encontrado")
      );
    }

    return adminRedirect(
      authorized.adminOrigin,
      redirectPath(
        result.outcome === "conflict"
          ? "conflicto"
          : "guardado"
      )
    );
  } catch {
    console.error(
      "No se pudo guardar el fondo de la página."
    );
    return adminUnavailableResponse();
  }
}
