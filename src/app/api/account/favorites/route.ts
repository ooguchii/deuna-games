import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  setAccountGameFavorite,
} from "@/lib/accounts/favorite-service";
import {
  getAccountGamePreferences,
} from "@/lib/accounts/personalization-service";
import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  syncRewardMilestones,
} from "@/lib/accounts/rewards-service";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["gameSlug", "favorite"] as const;
const favoriteRequestSchema = z.object({
  gameSlug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9._-]{0,159}$/),
  favorite: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
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

export async function GET() {
  const session = await resolveAccountSession(
    await readAccountSessionToken()
  );

  if (!session) {
    return json({
      ok: true,
      authenticated: false,
      favorites: [],
    });
  }

  try {
    const preferences = await getAccountGamePreferences(session.userId);

    return json({
      ok: true,
      authenticated: true,
      favorites: preferences
        .filter((preference) => preference.favorite)
        .map((preference) => preference.gameSlug),
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

  const parsed = favoriteRequestSchema.safeParse({
    gameSlug: form.get("gameSlug"),
    favorite: form.get("favorite"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const games = await getPublicGames();

    if (!games.some((game) => game.slug === parsed.data.gameSlug)) {
      return json({ ok: false, error: "juego" }, 404);
    }

    await setAccountGameFavorite(
      session.userId,
      parsed.data.gameSlug,
      parsed.data.favorite
    );
    await syncRewardMilestones(session.userId).catch(() => {});

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
