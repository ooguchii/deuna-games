import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  authenticateAdminOwner,
} from "@/lib/admin/auth-service";
import {
  getAdminOrigin,
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  readTrustedAdminForm,
} from "@/lib/admin/request-security";
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from "@/lib/admin/session";
import {
  adminLoginSchema,
} from "@/lib/admin/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectTo(
  adminOrigin: string,
  pathname: string
) {
  const response = NextResponse.redirect(
    new URL(pathname, adminOrigin),
    303
  );
  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0"
  );
  return response;
}

function unavailableResponse() {
  return new NextResponse(
    "Servicio administrativo no disponible.",
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let adminOrigin: string;
  let form: URLSearchParams | null;

  try {
    adminOrigin = getAdminOrigin();
    form = await readTrustedAdminForm(
      request,
      adminOrigin
    );
  } catch {
    console.error(
      "La configuración del origen administrativo no es válida."
    );
    return unavailableResponse();
  }

  if (!form) {
    return redirectTo(
      adminOrigin,
      "/admin/login?estado=solicitud"
    );
  }

  if (
    form.getAll("username").length !== 1 ||
    form.getAll("password").length !== 1
  ) {
    return redirectTo(
      adminOrigin,
      "/admin/login?estado=solicitud"
    );
  }

  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return redirectTo(
      adminOrigin,
      "/admin/login?estado=credenciales"
    );
  }

  try {
    const result = await authenticateAdminOwner(
      parsed.data.username,
      parsed.data.password
    );

    if (!result.authenticated) {
      return redirectTo(
        adminOrigin,
        "/admin/login?estado=credenciales"
      );
    }

    const response = redirectTo(
      adminOrigin,
      "/admin"
    );
    response.cookies.set(
      getAdminSessionCookieName(),
      result.token,
      getAdminSessionCookieOptions(
        result.expiresAt
      )
    );
    return response;
  } catch {
    console.error(
      "El servicio administrativo de autenticación no está disponible."
    );

    return unavailableResponse();
  }
}
