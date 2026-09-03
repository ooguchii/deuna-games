import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  deleteAccount,
} from "@/lib/accounts/service";
import {
  getAccountSessionCookieName,
  getExpiredAccountCookieOptions,
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";
import {
  accountDeletionSchema,
} from "@/lib/accounts/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["password", "confirmation"] as const;

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
  const token = await readAccountSessionToken();
  const session = await resolveAccountSession(token);

  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const form = await readTrustedAccountForm(request);

  if (!form || !hasExactAccountFormFields(form, fields)) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  const parsed = accountDeletionSchema.safeParse({
    password: form.get("password"),
    confirmation: form.get("confirmation"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const result = await deleteAccount(
      session.userId,
      parsed.data.password
    );

    if (!result.deleted) {
      return json({ ok: false, error: "credenciales" }, 401);
    }

    const response = json({ ok: true });
    response.cookies.set(
      getAccountSessionCookieName(),
      "",
      getExpiredAccountCookieOptions()
    );

    return response;
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
