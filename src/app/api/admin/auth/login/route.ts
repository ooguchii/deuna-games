import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
} from "@/lib/admin/admin-route";
import {
  authenticateAdmin,
} from "@/lib/admin/auth-service";
import {
  getAdminOrigin,
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  hasExactAdminFormFields,
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

const fields = [
  "username",
  "password",
] as const;

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
    return adminUnavailableResponse();
  }

  if (
    !form ||
    !hasExactAdminFormFields(form, fields)
  ) {
    return adminRedirect(
      adminOrigin,
      "/admin/login?estado=solicitud"
    );
  }

  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return adminRedirect(
      adminOrigin,
      "/admin/login?estado=credenciales"
    );
  }

  try {
    const result = await authenticateAdmin(
      parsed.data.username,
      parsed.data.password
    );

    if (!result.authenticated) {
      return adminRedirect(
        adminOrigin,
        "/admin/login?estado=credenciales"
      );
    }

    const response = adminRedirect(
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

    return adminUnavailableResponse();
  }
}
