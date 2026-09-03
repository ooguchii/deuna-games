import {
  getPublicGameBySlug,
} from "@/lib/games/public-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const slugPattern = /^[a-z0-9][a-z0-9._-]{0,159}$/;

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ slug: string }>;
  }
) {
  const { slug } = await context.params;

  if (!slugPattern.test(slug)) {
    return Response.json(
      { calibration: null },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const game = await getPublicGameBySlug(slug);

  if (!game) {
    return Response.json(
      { calibration: null },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  return Response.json(
    {
      calibration: game.performance ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
