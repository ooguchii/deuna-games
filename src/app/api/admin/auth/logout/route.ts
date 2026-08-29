import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getAdminOrigin,
  isAdminEnabled,
} from "@/lib/admin/database-config";
import {
  readTrustedAdminForm,
} from "@/lib/admin/request-security";
import {
  getAdminSessionCookieName,
  getExpiredAdminCookieOptions,
  revokeAdminSession,
} from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (
    !form ||
    form.getAll("intent").length !== 1 ||
    form.get("intent") !== "logout"
  ) {
    return new NextResponse(
      "Solicitud rechazada.",
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }

  const cookieName =
    getAdminSessionCookieName();
  const token =
    request.cookies.get(cookieName)?.value;

  try {
    await revokeAdminSession(token);
  } catch {
    console.error(
      "No se pudo revocar la sesión administrativa."
    );

    return new NextResponse(
      "No se pudo cerrar la sesión de forma segura. Inténtalo otra vez.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }

  const response = NextResponse.redirect(
    new URL("/admin/login", adminOrigin),
    303
  );
  response.cookies.set(
    cookieName,
    "",
    getExpiredAdminCookieOptions()
  );
  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0"
  );
  return response;
}
