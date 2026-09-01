import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  if (!isAdminEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const token = request.cookies.get(
      getAdminSessionCookieName()
    )?.value;
    const session = await resolveAdminSession(token);

    if (!session) {
      return json(
        { error: "Sesión administrativa no válida." },
        401
      );
    }

    const { slug } = await context.params;
    const item = await getEditorialItem("game", slug);

    if (!item) {
      return json(
        { error: "El juego ya no está disponible." },
        404
      );
    }

    return json({
      revision: item.revision,
      previewMode: item.payload.previewMode ?? null,
      previewClip: item.payload.previewClip ?? null,
      youtubePreview: item.payload.youtubePreview ?? null,
      directPreview: item.payload.directPreview ?? null,
    });
  } catch {
    return json(
      { error: "No se pudo leer el estado del preview." },
      503
    );
  }
}
