import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  registerAccount,
} from "@/lib/accounts/service";
import {
  getAccountSessionCookieName,
  getAccountSessionCookieOptions,
} from "@/lib/accounts/session";
import {
  accountRegistrationSchema,
} from "@/lib/accounts/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "username",
  "password",
  "displayName",
  "email",
  "bio",
] as const;

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

  const parsed = accountRegistrationSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
    displayName: form.get("displayName"),
    email: form.get("email"),
    bio: form.get("bio"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    const result = await registerAccount(parsed.data);

    if (!result.created) {
      return json({ ok: false, error: "usuario_ocupado" }, 409);
    }

    const response = json({
      ok: true,
      recoveryCodes: result.recoveryCodes,
    }, 201);
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
