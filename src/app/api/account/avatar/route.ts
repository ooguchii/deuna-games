import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  readTrustedAccountAvatarForm,
} from "@/lib/accounts/avatar-request-security";
import {
  deleteAccountAvatar,
  getAccountAvatar,
  saveAccountAvatar,
} from "@/lib/accounts/avatar-service";
import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";
import {
  inspectSafeEditorialWebp,
  sanitizeEditorialWebp,
} from "@/lib/media/safe-webp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ACCOUNT_AVATAR_BYTES = 512 * 1024;
const MIN_ACCOUNT_AVATAR_DIMENSION = 64;
const MAX_ACCOUNT_AVATAR_DIMENSION = 1024;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readSession() {
  return resolveAccountSession(
    await readAccountSessionToken()
  );
}

export async function GET() {
  const session = await readSession();

  if (!session) {
    return new Response(null, {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const avatar = await getAccountAvatar(session.userId);

    if (!avatar) {
      return new Response(null, {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new Response(new Uint8Array(avatar.imageWebp), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "image/webp",
        "Content-Length": String(avatar.imageWebp.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const session = await readSession();

  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const image = await readTrustedAccountAvatarForm(request);

  if (
    !image ||
    image.size <= 0 ||
    image.size > MAX_ACCOUNT_AVATAR_BYTES ||
    image.type.toLowerCase() !== "image/webp"
  ) {
    return json({ ok: false, error: "imagen" }, 400);
  }

  try {
    const input = Buffer.from(await image.arrayBuffer());
    const sanitized = sanitizeEditorialWebp(input);
    const inspection = sanitized
      ? inspectSafeEditorialWebp(sanitized)
      : null;

    if (
      !sanitized ||
      !inspection ||
      inspection.bytes > MAX_ACCOUNT_AVATAR_BYTES ||
      inspection.width !== inspection.height ||
      inspection.width < MIN_ACCOUNT_AVATAR_DIMENSION ||
      inspection.width > MAX_ACCOUNT_AVATAR_DIMENSION
    ) {
      return json({ ok: false, error: "imagen" }, 400);
    }

    await saveAccountAvatar(session.userId, {
      digest: inspection.digest,
      imageWebp: sanitized,
      width: inspection.width,
      height: inspection.height,
    });

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await readSession();

  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const form = await readTrustedAccountForm(request);

  if (
    !form ||
    !hasExactAccountFormFields(form, ["intent"]) ||
    form.get("intent") !== "delete"
  ) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  try {
    await deleteAccountAvatar(session.userId);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
