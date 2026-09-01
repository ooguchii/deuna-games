import type { NextRequest } from "next/server";

import {
  getEditorialItem,
} from "@/lib/admin/content-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const { slug } = await context.params;
  const item = await getEditorialItem("game", slug);

  if (!item) {
    return Response.json(
      { error: "Juego no encontrado." },
      {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }

  const game = item.payload;
  const mode =
    game.previewMode ??
    (game.previewClip
      ? "webm"
      : game.youtubePreview
        ? "youtube"
        : null);

  return Response.json(
    {
      revision: item.revision,
      mode,
      previewClip: game.previewClip ?? null,
      youtubePreview: game.youtubePreview ?? null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
