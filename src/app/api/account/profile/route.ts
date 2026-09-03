import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  updateAccountProfile,
} from "@/lib/accounts/service";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";
import {
  accountProfileSchema,
} from "@/lib/accounts/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["displayName", "email", "bio"] as const;

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

  const parsed = accountProfileSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    bio: form.get("bio"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    await updateAccountProfile(session.userId, parsed.data);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
