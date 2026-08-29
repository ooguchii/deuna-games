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
  request: NextRequest
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

    const form = await readTrustedAdminForm(
      request,
      adminOrigin
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
