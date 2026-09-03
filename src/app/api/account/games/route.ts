import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  saveAccountGamePreference,
} from "@/lib/accounts/personalization-service";
import {
  accountGamePreferenceSchema,
} from "@/lib/accounts/personalization-validation";
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

const fields = [
  "gameSlug",
  "favorite",
  "libraryState",
  "followUpdates",
] as const;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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

  const parsed = accountGamePreferenceSchema.safeParse({
    gameSlug: form.get("gameSlug"),
    favorite: form.get("favorite"),
    libraryState: form.get("libraryState"),
    followUpdates: form.get("followUpdates"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const games = await getPublicGames();

    if (!games.some((game) => game.slug === parsed.data.gameSlug)) {
      return json({ ok: false, error: "juego" }, 404);
    }

    await saveAccountGamePreference(session.userId, parsed.data);

    // Rewards es una consecuencia idempotente del dato ya guardado.
    // Un fallo temporal de Rewards no debe convertir un guardado exitoso
    // de Mi DeUna en un falso error para el usuario; el dashboard vuelve
    // a sincronizar los hitos al cargar.
    await syncRewardMilestones(session.userId).catch(() => {});

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
