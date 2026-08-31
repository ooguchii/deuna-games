import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  authenticateAccount,
} from "@/lib/accounts/service";
import {
  getAccountSessionCookieName,
  getAccountSessionCookieOptions,
} from "@/lib/accounts/session";
import {
  accountLoginSchema,
} from "@/lib/accounts/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["username", "password"] as const;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const form = await readTrustedAccountForm(request);

  if (!form || !hasExactAccountFormFields(form, fields)) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  const parsed = accountLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "credenciales" }, 400);
  }

  try {
    const result = await authenticateAccount(
      parsed.data.username,
      parsed.data.password
    );

    if (!result.authenticated) {
      return json({ ok: false, error: "credenciales" }, 401);
    }

    const response = json({ ok: true });
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
