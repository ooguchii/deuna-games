import "server-only";

import {
  randomUUID,
} from "node:crypto";
import { cache } from "react";
import type { PoolClient } from "pg";
import { cookies } from "next/headers";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  adminQuery,
  withAdminTransaction,
} from "./database";
import {
  getAdminSessionHours,
  isAdminEnabled,
} from "./database-config";
import type { AdminRole } from "./roles";
import {
  createAdminSessionToken,
  hashAdminSessionToken,
  isValidAdminSessionToken,
} from "./session-token";

type SessionRow = {
  session_id: string;
  user_id: string;
  username: string;
  role: AdminRole;
  expires_at: Date;
};

export type AdminSession = {
  sessionId: string;
  userId: string;
  username: string;
  role: AdminRole;
  expiresAt: Date;
};

export function getAdminSessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-deuna_admin_session"
    : "deuna_admin_session";
}

function adminSessionUsesSecureTransport() {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const configured =
    process.env.DEUNA_ADMIN_ORIGIN?.trim();

  if (!configured) return false;

  try {
    return new URL(configured).protocol === "https:";
  } catch {
    return false;
  }
}

export function getAdminSessionCookieOptions(
  expires: Date
) {
  return {
    httpOnly: true,
    secure: adminSessionUsesSecureTransport(),
    sameSite: "strict" as const,
    path: "/",
    expires,
    priority: "high" as const,
  };
}

export function getExpiredAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: adminSessionUsesSecureTransport(),
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}

export async function createAdminSession(
  client: PoolClient,
  userId: string
) {
  const token = createAdminSessionToken();
  const expiresAt = new Date(
    Date.now() +
      getAdminSessionHours() *
        60 *
        60 *
        1000
  );

  await client.query(
    `INSERT INTO deuna_admin.admin_sessions
       (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [
      randomUUID(),
      userId,
      hashAdminSessionToken(token),
      expiresAt,
    ]
  );

  return { token, expiresAt };
}

export async function resolveAdminSession(
  token: string | undefined
): Promise<AdminSession | null> {
  if (
    !token ||
    !isValidAdminSessionToken(token)
  ) {
    return null;
  }

  const result = await adminQuery<SessionRow>(
    `SELECT
       session.id AS session_id,
       account.id AS user_id,
       account.username,
       account.role,
       session.expires_at
     FROM deuna_admin.admin_sessions AS session
     INNER JOIN deuna_admin.admin_users AS account
       ON account.id = session.user_id
     WHERE session.token_hash = $1
       AND session.revoked_at IS NULL
       AND session.expires_at > now()
       AND account.active = true
       AND account.role IN ('owner', 'admin')
     LIMIT 1`,
    [hashAdminSessionToken(token)]
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

export async function readAdminSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    getAdminSessionCookieName()
  )?.value;
}

export const verifyAdminSession = cache(
  async () => {
    if (!isAdminEnabled()) {
      notFound();
    }

    const session = await resolveAdminSession(
      await readAdminSessionToken()
    );

    if (!session) {
      redirect("/admin/login");
    }

    return session;
  }
);

export const verifyAdminOwnerSession = cache(
  async () => {
    const session = await verifyAdminSession();

    if (session.role !== "owner") {
      notFound();
    }

    return session;
  }
);

export async function revokeAdminSession(
  token: string | undefined
) {
  if (
    !token ||
    !isValidAdminSessionToken(token)
  ) {
    return;
  }

  const tokenHash =
    hashAdminSessionToken(token);

  await withAdminTransaction(
    async (client) => {
      const session = await client.query<{
        id: string;
        user_id: string;
      }>(
        `SELECT id, user_id
         FROM deuna_admin.admin_sessions
         WHERE token_hash = $1
           AND revoked_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [tokenHash]
      );
      const active = session.rows[0];

      if (!active) return;

      await client.query(
        `UPDATE deuna_admin.admin_sessions
         SET revoked_at = now()
         WHERE id = $1`,
        [active.id]
      );
      await client.query(
        `INSERT INTO deuna_admin.admin_events
           (user_id, event_type)
         VALUES ($1, 'logout')`,
        [active.user_id]
      );
    }
  );
}
