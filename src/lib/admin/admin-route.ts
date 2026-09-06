import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getAdminOrigin,
  isAdminEnabled,
} from "./database-config";
import {
  readTrustedAdminForm,
} from "./request-security";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "./session";

/*
 * Login y lectores genéricos conservan el límite defensivo de 8 KiB definido
 * en request-security. Después de validar una sesión Admin real, los formularios
 * editoriales necesitan un techo mayor porque application/x-www-form-urlencoded
 * puede expandir texto/JSON válido varias veces. Los dominios que superan este
 * techo (Hero, Inicio y Catálogos) deben declarar un maxFormBytes explícito.
 */
const MAX_AUTHORIZED_ADMIN_FORM_BYTES = 64 * 1024;

export type AuthorizedAdminForm = {
  authorized: true;
  adminOrigin: string;
  form: URLSearchParams;
  session: NonNullable<
    Awaited<ReturnType<typeof resolveAdminSession>>
  >;
};

export type RejectedAdminForm = {
  authorized: false;
  response: NextResponse;
};

export function adminRedirect(
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

export function adminUnavailableResponse() {
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

export async function authorizeAdminFormRequest(
  request: NextRequest,
  options?: { maxFormBytes: number }
): Promise<AuthorizedAdminForm | RejectedAdminForm> {
  if (!isAdminEnabled()) {
    return {
      authorized: false,
      response: new NextResponse(null, {
        status: 404,
      }),
    };
  }

  try {
    const adminOrigin = getAdminOrigin();
    const token = request.cookies.get(
      getAdminSessionCookieName()
    )?.value;
    const session = await resolveAdminSession(token);

    if (!session) {
      return {
        authorized: false,
        response: adminRedirect(
          adminOrigin,
          "/admin/login"
        ),
      };
    }

    const maxFormBytes =
      options?.maxFormBytes ??
      MAX_AUTHORIZED_ADMIN_FORM_BYTES;
    const form = await readTrustedAdminForm(
      request,
      adminOrigin,
      maxFormBytes
    );

    if (!form) {
      return {
        authorized: false,
        response: new NextResponse(
          "Solicitud rechazada.",
          {
            status: 403,
            headers: {
              "Cache-Control": "no-store, max-age=0",
              "Content-Type":
                "text/plain; charset=utf-8",
            },
          }
        ),
      };
    }

    return {
      authorized: true,
      adminOrigin,
      form,
      session,
    };
  } catch {
    console.error(
      "No se pudo autorizar la operación administrativa."
    );

    return {
      authorized: false,
      response: adminUnavailableResponse(),
    };
  }
}