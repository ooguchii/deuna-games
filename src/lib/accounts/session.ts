import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { siteUrl } from "@/lib/site";

import {
  createAccountSession,
  resolveAccountSession,
  revokeAccountSession,
  type AccountSession,
} from "./session-store";

export {
  createAccountSession,
  resolveAccountSession,
  revokeAccountSession,
};
export type { AccountSession };

export function getAccountSessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-deuna_account_session"
    : "deuna_account_session";
}

function accountSessionUsesSecureTransport() {
  return process.env.NODE_ENV === "production" || siteUrl.startsWith("https://");
}

export function getAccountSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: accountSessionUsesSecureTransport(),
    sameSite: "lax" as const,
    path: "/",
    expires,
    priority: "high" as const,
  };
}

export function getExpiredAccountCookieOptions() {
  return {
    httpOnly: true,
    secure: accountSessionUsesSecureTransport(),
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}

export async function readAccountSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(getAccountSessionCookieName())?.value;
}

export const readAccountSession = cache(async () =>
  resolveAccountSession(await readAccountSessionToken())
);

export const requireAccountSession = cache(async () => {
  const session = await readAccountSession();

  if (!session) {
    redirect("/cuenta?modo=entrar");
  }

  return session;
});
