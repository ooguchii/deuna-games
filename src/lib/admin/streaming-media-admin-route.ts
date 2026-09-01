import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  adminRedirect,
  adminUnavailableResponse,
} from "./admin-route";
import {
  getAdminOrigin,
  isAdminEnabled,
} from "./database-config";
import {
  hasTrustedAdminOrigin,
} from "./request-security";
import {
  getAdminSessionCookieName,
  resolveAdminSession,
} from "./session";

export type AuthorizedAdminStreamingMedia = {
  authorized: true;
  adminOrigin: string;
  session: NonNullable<
    Awaited<ReturnType<typeof resolveAdminSession>>
  >;
};

export type RejectedAdminStreamingMedia = {
  authorized: false;
  response: NextResponse;
};

function rejected(status = 403) {
  return new NextResponse("Solicitud rechazada.", {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function authorizeAdminStreamingMediaRequest(
  request: NextRequest
): Promise<
  AuthorizedAdminStreamingMedia |
  RejectedAdminStreamingMedia
> {
  if (!isAdminEnabled()) {
    return {
      authorized: false,
      response: new NextResponse(null, { status: 404 }),
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

    if (!hasTrustedAdminOrigin(request, adminOrigin)) {
      return {
        authorized: false,
        response: rejected(),
      };
    }

    return {
      authorized: true,
      adminOrigin,
      session,
    };
  } catch {
    return {
      authorized: false,
      response: adminUnavailableResponse(),
    };
  }
}
