import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getAdminOrigin,
  isAdminEnabled,
} from "./database-config";
import {
  readTrustedAdminMediaForm,
} from "./media-request-security";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "./session";

export type AuthorizedAdminMediaForm = {
  authorized: true;
  adminOrigin: string;
  form: FormData;
  session: NonNullable<
    Awaited<ReturnType<typeof resolveAdminSession>>
  >;
};

export type RejectedAdminMediaForm = {
  authorized: false;
  response: NextResponse;
};

function mediaAdminRedirect(
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

function mediaUnavailableResponse() {
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

export async function authorizeAdminMediaRequest(
  request: NextRequest,
  options?: {
    maximumBytes?: number;
  }
): Promise<
  AuthorizedAdminMediaForm |
  RejectedAdminMediaForm
> {
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
        response: mediaAdminRedirect(
          adminOrigin,
          "/admin/login"
        ),
      };
    }

    const form = await readTrustedAdminMediaForm(
      request,
      adminOrigin,
      options?.maximumBytes
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
      "No se pudo autorizar la carga multimedia administrativa."
    );

    return {
      authorized: false,
      response: mediaUnavailableResponse(),
    };
  }
}
