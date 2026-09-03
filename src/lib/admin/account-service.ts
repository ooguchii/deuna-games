import "server-only";

import { randomUUID } from "node:crypto";

import {
  adminQuery,
  withAdminTransaction,
} from "./database";
import {
  hashAdminPassword,
} from "./password";
import type { AdminRole } from "./roles";
import {
  normalizeAdminUsername,
} from "./validation";

type AdminAccountRow = {
  id: string;
  username: string;
  display_name: string | null;
  role: AdminRole;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
};

export type AdminAccount = {
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type CreateAdministratorResult =
  | { created: true; id: string }
  | { created: false; reason: "username_taken" };

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const result = await adminQuery<AdminAccountRow>(
    `SELECT
       id,
       username,
       display_name,
       role,
       active,
       last_login_at,
       created_at
     FROM deuna_admin.admin_users
     WHERE role IN ('owner', 'admin')
     ORDER BY
       CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
       active DESC,
       username_key ASC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }));
}

export async function createAdministrator(
  actorUserId: string,
  input: {
    username: string;
    password: string;
    displayName?: string;
  }
): Promise<CreateAdministratorResult> {
  const passwordHash = await hashAdminPassword(input.password);
  const userId = randomUUID();

  try {
    return await withAdminTransaction(async (client) => {
      const actor = await client.query<{ id: string }>(
        `SELECT id
         FROM deuna_admin.admin_users
         WHERE id = $1
           AND role = 'owner'
           AND active = true
         LIMIT 1
         FOR UPDATE`,
        [actorUserId]
      );

      if (!actor.rows[0]) {
        throw new Error("La cuenta no tiene permiso para administrar accesos.");
      }

      await client.query(
        `INSERT INTO deuna_admin.admin_users
           (id, username, username_key, role, password_hash, display_name, active, created_by_user_id)
         VALUES ($1, $2, $3, 'admin', $4, $5, true, $6)`,
        [
          userId,
          input.username.trim(),
          normalizeAdminUsername(input.username),
          passwordHash,
          input.displayName ?? null,
          actorUserId,
        ]
      );

      await client.query(
        `INSERT INTO deuna_admin.admin_events
           (user_id, event_type)
         VALUES ($1, 'administrator_created')`,
        [userId]
      );
      await client.query(
        `INSERT INTO deuna_admin.admin_audit_log
           (user_id, action, entity_type, entity_id)
         VALUES ($1, 'admin_account.create', 'admin_account', $2)`,
        [actorUserId, userId]
      );

      return { created: true as const, id: userId };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { created: false, reason: "username_taken" };
    }

    throw error;
  }
}

export async function setAdministratorActive(
  actorUserId: string,
  targetUserId: string,
  active: boolean
) {
  return withAdminTransaction(async (client) => {
    const actor = await client.query<{ id: string }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE id = $1
         AND role = 'owner'
         AND active = true
       LIMIT 1
       FOR UPDATE`,
      [actorUserId]
    );

    if (!actor.rows[0]) {
      throw new Error("La cuenta no tiene permiso para administrar accesos.");
    }

    const target = await client.query<{ id: string }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE id = $1
         AND role = 'admin'
       LIMIT 1
       FOR UPDATE`,
      [targetUserId]
    );

    if (!target.rows[0]) {
      return false;
    }

    await client.query(
      `UPDATE deuna_admin.admin_users
       SET active = $2,
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()
       WHERE id = $1`,
      [targetUserId, active]
    );

    if (!active) {
      await client.query(
        `UPDATE deuna_admin.admin_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [targetUserId]
      );
    }

    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'admin_account', $3)`,
      [
        actorUserId,
        active ? "admin_account.activate" : "admin_account.deactivate",
        targetUserId,
      ]
    );

    return true;
  });
}

export async function resetAdministratorPassword(
  actorUserId: string,
  targetUserId: string,
  password: string
) {
  const passwordHash = await hashAdminPassword(password);

  return withAdminTransaction(async (client) => {
    const actor = await client.query<{ id: string }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE id = $1
         AND role = 'owner'
         AND active = true
       LIMIT 1
       FOR UPDATE`,
      [actorUserId]
    );

    if (!actor.rows[0]) {
      throw new Error("La cuenta no tiene permiso para administrar accesos.");
    }

    const target = await client.query<{ id: string }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE id = $1
         AND role = 'admin'
       LIMIT 1
       FOR UPDATE`,
      [targetUserId]
    );

    if (!target.rows[0]) {
      return false;
    }

    await client.query(
      `UPDATE deuna_admin.admin_users
       SET password_hash = $2,
           password_changed_at = now(),
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()
       WHERE id = $1`,
      [targetUserId, passwordHash]
    );
    await client.query(
      `UPDATE deuna_admin.admin_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [targetUserId]
    );
    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id)
       VALUES ($1, 'admin_account.password_reset', 'admin_account', $2)`,
      [actorUserId, targetUserId]
    );

    return true;
  });
}
