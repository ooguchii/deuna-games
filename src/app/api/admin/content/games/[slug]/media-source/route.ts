import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  adminUnavailableResponse,
  authorizeAdminFormRequest,
} from "@/lib/admin/admin-route";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  hasExactAdminFormFields,
} from "@/lib/admin/request-security";
import {
  fetchRemoteEditorialImage,
} from "@/lib/media/remote-image-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["url"] as const;

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
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
    return new NextResponse(
      "Solicitud inválida.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }

  const { slug } = await context.params;
  const sourceUrl =
    authorized.form.get("url")?.trim() ?? "";

  if (
    sourceUrl.length < 8 ||
    sourceUrl.length > 2_048
  ) {
    return new NextResponse(
      "La URL de imagen no es válida.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }

  try {
    const item = await getEditorialItem(
      "game",
      slug
    );

    if (!item) {
      return new NextResponse(
        "El juego ya no está disponible.",
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        }
      );
    }

    const image =
      await fetchRemoteEditorialImage(sourceUrl);

    return new NextResponse(
      new Uint8Array(image.bytes),
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Length": String(
            image.bytes.length
          ),
          "Content-Type": image.contentType,
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, {
        status: 400,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      });
    }

    console.error(
      "No se pudo importar la imagen remota."
    );
    return adminUnavailableResponse();
  }
}
