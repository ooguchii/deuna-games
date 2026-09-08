import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  expectedRevisionSchema,
} from "@/lib/admin/content-forms";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  authorizeAdminMediaRequest,
} from "@/lib/admin/media-admin-route";
import {
  hasExactAdminMediaFormFields,
} from "@/lib/admin/media-request-security";
import {
  storeSiteBrandLogo,
} from "@/lib/media/taxonomy-icon-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "logo",
] as const;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: NextRequest) {
  const authorized =
    await authorizeAdminMediaRequest(request);

  if (!authorized.authorized) {
    return authorized.response;
  }

  if (
    !hasExactAdminMediaFormFields(
      authorized.form,
      fields
    )
  ) {
    return json(
      { error: "Solicitud de logo inválida." },
      400
    );
  }

  const revisionValue = authorized.form.get(
    "expectedRevision"
  );
  const logoValue = authorized.form.get("logo");
  const revision = expectedRevisionSchema.safeParse(
    typeof revisionValue === "string"
      ? revisionValue
      : null
  );
  const logo = logoValue instanceof File
    ? logoValue
    : null;

  if (
    !revision.success ||
    !logo ||
    logo.size <= 0
  ) {
    return json(
      { error: "Selecciona un SVG válido." },
      400
    );
  }

  try {
    const item = await getEditorialItem(
      "site_config",
      "site"
    );

    if (!item) {
      return json(
        { error: "La identidad del sitio no está disponible." },
        404
      );
    }

    if (item.revision !== revision.data) {
      return json(
        {
          error:
            "La identidad cambió en otra ventana. Recarga antes de subir el logo.",
        },
        409
      );
    }

    const upload = await storeSiteBrandLogo(logo);

    return json({
      publicPath: upload.publicPath,
      bytes: upload.bytes,
      reused: upload.reused,
    });
  } catch {
    return json(
      {
        error:
          "No se pudo cargar el logo. Usa un SVG monocromático de hasta 256 KB con viewBox y trazados simples. No se admiten degradados, filtros, referencias use, estilos, scripts ni recursos externos.",
      },
      400
    );
  }
}
