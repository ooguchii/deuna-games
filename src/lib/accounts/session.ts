import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import type { PoolClient } from "pg";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { siteUrl } from "@/lib/site";

import {
  accountQuery,
  withAccountTransaction,
} from "./database";
import {
  createAccountSessionToken,
  hashAccountSessionToken,
  isValidAccountSessionToken,
} from "./token";

type SessionRow = {
  session_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  expires_at: Date;
};

export type AccountSession = {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string | null;
  expiresAt: Date;
};

function getAccountSessionDays() {
  const raw = process.env.DEUNA_ACCOUNT_SESSION_DAYS?.trim() || "30";
  const days = Number(raw);

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error(
      "DEUNA_ACCOUNT_SESSION_DAYS debe estar entre 1 y 90."
    );
  }

  return days;
}

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

export async function createAccountSession(
  client: PoolClient,
  userId: string
) {
  const token = createAccountSessionToken();
  const expiresAt = new Date(
    Date.now() + getAccountSessionDays() * 24 * 60 * 60 * 1000
  );

  await client.query(
    `INSERT INTO deuna_accounts.sessions
       (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [
      randomUUID(),
      userId,
      hashAccountSessionToken(token),
      expiresAt,
    ]
  );

  return { token, expiresAt };
}

export async function resolveAccountSession(
  token: string | undefined
): Promise<AccountSession | null> {
  if (!token || !isValidAccountSessionToken(token)) {
    return null;
  }

  const result = await accountQuery<SessionRow>(
    `SELECT
       session.id AS session_id,
       account.id AS user_id,
       account.username,
       account.display_name,
       session.expires_at
     FROM deuna_accounts.sessions AS session
     INNER JOIN deuna_accounts.users AS account
       ON account.id = session.user_id
     WHERE session.token_hash = $1
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND account.active = true
     LIMIT 1`,
    [hashAccountSessionToken(token)]
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    expiresAt: row.expires_at,
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

export async function revokeAccountSession(token: string | undefined) {
  if (!token || !isValidAccountSessionToken(token)) {
    return;
  }

  await withAccountTransaction(async (client) => {
    await client.query(
      `UPDATE deuna_accounts.sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_hash = $1
         AND revoked_at IS NULL`,
      [hashAccountSessionToken(token)]
    );
  });
}
