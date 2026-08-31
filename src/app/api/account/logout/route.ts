import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  getAccountSessionCookieName,
  getExpiredAccountCookieOptions,
  readAccountSessionToken,
  revokeAccountSession,
} from "@/lib/accounts/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["intent"] as const;

export async function POST(request: NextRequest) {
  const form = await readTrustedAccountForm(request);

  if (
    !form ||
    !hasExactAccountFormFields(form, fields) ||
    form.get("intent") !== "logout"
  ) {
    return NextResponse.json(
      { ok: false },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const token = await readAccountSessionToken();

  try {
    await revokeAccountSession(token);
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set(
    getAccountSessionCookieName(),
    "",
    getExpiredAccountCookieOptions()
  );

  return response;
}
