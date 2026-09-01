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
  storeTaxonomyIcon,
} from "@/lib/media/taxonomy-icon-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "expectedRevision",
  "icon",
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

function singleString(
  form: FormData,
  field: string
) {
  const value = form.get(field);
  return typeof value === "string"
    ? value
    : null;
}

function singleFile(
  form: FormData,
  field: string
) {
  const value = form.get(field);
  return value instanceof File
    ? value
    : null;
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
      { error: "Solicitud de icono inválida." },
      400
    );
  }

  const revision = expectedRevisionSchema.safeParse(
    singleString(
      authorized.form,
      "expectedRevision"
    )
  );
  const icon = singleFile(
    authorized.form,
    "icon"
  );

  if (
    !revision.success ||
    !icon ||
    icon.size <= 0
  ) {
    return json(
      { error: "Selecciona un SVG o WebP válido." },
      400
    );
  }

  try {
    const item = await getEditorialItem(
      "game_taxonomy",
      "games"
    );

    if (!item) {
      return json(
        { error: "El catálogo no está disponible." },
        404
      );
    }

    if (item.revision !== revision.data) {
      return json(
        {
          error:
            "El catálogo cambió en otra ventana. Recarga antes de subir el icono.",
        },
        409
      );
    }

    const upload = await storeTaxonomyIcon(icon);

    return json({
      publicPath: upload.publicPath,
      format: upload.format,
      bytes: upload.bytes,
      reused: upload.reused,
    });
  } catch {
    return json(
      {
        error:
          "El icono no pudo validarse. Usa un SVG simple y seguro o un WebP transparente.",
      },
      400
    );
  }
}
