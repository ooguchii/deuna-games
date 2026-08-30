import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
} from "@/lib/admin/admin-route";
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
  getExpiredAdminCookieOptions,
  revokeAdminSession,
} from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["intent"] as const;

function rejectedResponse() {
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
    !hasExactAdminFormFields(form, fields) ||
    form.get("intent") !== "logout"
  ) {
    return rejectedResponse();
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

  const response = adminRedirect(
    adminOrigin,
    "/admin/login"
  );
  response.cookies.set(
    cookieName,
    "",
    getExpiredAdminCookieOptions()
  );
  return response;
}
