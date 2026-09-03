import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  recoverAccount,
} from "@/lib/accounts/service";
import {
  getAccountSessionCookieName,
  getAccountSessionCookieOptions,
} from "@/lib/accounts/session";
import {
  accountRecoverySchema,
} from "@/lib/accounts/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "username",
  "recoveryCode",
  "newPassword",
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
  const form = await readTrustedAccountForm(request);

  if (!form || !hasExactAccountFormFields(form, fields)) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  const parsed = accountRecoverySchema.safeParse({
    username: form.get("username"),
    recoveryCode: form.get("recoveryCode"),
    newPassword: form.get("newPassword"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const result = await recoverAccount(
      parsed.data.username,
      parsed.data.recoveryCode,
      parsed.data.newPassword
    );

    if (!result.recovered) {
      return json({ ok: false, error: "recuperacion" }, 401);
    }

    const response = json({
      ok: true,
      recoveryCodes: result.recoveryCodes,
    });
    response.cookies.set(
      getAccountSessionCookieName(),
      result.token,
      getAccountSessionCookieOptions(result.expiresAt)
    );

    return response;
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
