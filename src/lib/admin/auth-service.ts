import "server-only";

import type { PoolClient } from "pg";

import {
  withAdminTransaction,
} from "./database";
import {
  consumeDummyPasswordWork,
  verifyAdminPassword,
} from "./password";
import {
  createAdminSession,
} from "./session";
import {
  normalizeAdminUsername,
} from "./validation";

type OwnerRow = {
  id: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
};

export type AdminAuthenticationResult =
  | {
      authenticated: true;
      token: string;
      expiresAt: Date;
    }
  | {
      authenticated: false;
    };

function lockDurationSeconds(
  failureCount: number
) {
  if (failureCount < 5) return 0;

  return Math.min(
    15 * 60,
    30 * 2 ** Math.min(failureCount - 5, 5)
  );
}

async function recordFailedLogin(
  client: PoolClient,
  owner: OwnerRow
) {
  const failures = Math.min(
    owner.failed_login_count + 1,
    1000
  );
  const lockSeconds =
    lockDurationSeconds(failures);
  const lockedUntil = lockSeconds
    ? new Date(Date.now() + lockSeconds * 1000)
    : null;

  await client.query(
    `UPDATE deuna_admin.admin_users
     SET failed_login_count = $2,
         locked_until = $3,
         updated_at = now()
     WHERE id = $1`,
    [owner.id, failures, lockedUntil]
  );
  await client.query(
    `INSERT INTO deuna_admin.admin_events
       (user_id, event_type)
     VALUES ($1, 'login_failed')`,
    [owner.id]
  );
}

export async function authenticateAdminOwner(
  username: string,
  password: string
): Promise<AdminAuthenticationResult> {
  const usernameKey =
    normalizeAdminUsername(username);

  return withAdminTransaction(
    async (client) => {
      const locked = await client.query<OwnerRow>(
        `SELECT
           id,
           password_hash,
           failed_login_count,
           locked_until
         FROM deuna_admin.admin_users
         WHERE username_key = $1
           AND active = true
           AND role = 'owner'
         LIMIT 1
         FOR UPDATE`,
        [usernameKey]
      );
      const owner = locked.rows[0];

      if (!owner) {
        await consumeDummyPasswordWork(password);
        return { authenticated: false };
      }

      const passwordMatches =
        await verifyAdminPassword(
          password,
          owner.password_hash
        );
      const currentlyLocked = Boolean(
        owner.locked_until &&
          owner.locked_until.getTime() > Date.now()
      );

      if (!passwordMatches || currentlyLocked) {
        if (!currentlyLocked) {
          await recordFailedLogin(client, owner);
        } else {
          await client.query(
            `INSERT INTO deuna_admin.admin_events
               (user_id, event_type)
             VALUES ($1, 'login_blocked')`,
            [owner.id]
          );
        }

        return { authenticated: false };
      }

      await client.query(
        `UPDATE deuna_admin.admin_users
         SET failed_login_count = 0,
             locked_until = NULL,
             last_login_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [owner.id]
      );
      await client.query(
        `UPDATE deuna_admin.admin_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE user_id = $1
           AND expires_at <= now()`,
        [owner.id]
      );

      const session = await createAdminSession(
        client,
        owner.id
      );

      await client.query(
        `INSERT INTO deuna_admin.admin_events
           (user_id, event_type)
         VALUES ($1, 'login_succeeded')`,
        [owner.id]
      );

      return {
        authenticated: true,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    }
  );
}
