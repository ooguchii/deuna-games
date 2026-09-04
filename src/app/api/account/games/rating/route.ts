import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAccountGameRating,
  saveAccountGameRating,
} from "@/lib/accounts/game-rating-service";
import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["gameSlug", "rating"] as const;
const gameSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
const schema = z.object({
  gameSlug: gameSlugSchema,
  rating: z
    .string()
    .regex(/^[1-5]$/)
    .transform(Number),
});

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const session = await resolveAccountSession(
    await readAccountSessionToken()
  );
  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const parsed = gameSlugSchema.safeParse(
    request.nextUrl.searchParams.get("gameSlug")
  );
  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const rating = await getAccountGameRating(
      session.userId,
      parsed.data
    );
    return json({
      ok: true,
      rating: rating?.rating ?? null,
    });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}

export async function POST(request: NextRequest) {
  const session = await resolveAccountSession(
    await readAccountSessionToken()
  );

  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const form = await readTrustedAccountForm(request);
  if (!form || !hasExactAccountFormFields(form, fields)) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  const parsed = schema.safeParse({
    gameSlug: form.get("gameSlug"),
    rating: form.get("rating"),
  });
  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const games = await getPublicGames();
    if (!games.some((game) => game.slug === parsed.data.gameSlug)) {
      return json({ ok: false, error: "juego" }, 404);
    }

    await saveAccountGameRating(
      session.userId,
      parsed.data.gameSlug,
      parsed.data.rating
    );

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
