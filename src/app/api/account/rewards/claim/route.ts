import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  claimDailyReward,
} from "@/lib/accounts/rewards-service";
import {
  accountRewardClaimSchema,
} from "@/lib/accounts/rewards-validation";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["intent"] as const;

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

  const parsed = accountRewardClaimSchema.safeParse({
    intent: form.get("intent"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const result = await claimDailyReward(session.userId);

    return json({
      ok: true,
      claimed: result.claimed,
      nextClaimAt: result.nextClaimAt.toISOString(),
      xp: result.xp,
      credits: result.credits,
      weeklyBonus: result.weeklyBonus,
    });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
