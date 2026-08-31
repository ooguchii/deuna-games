import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import {
  accountQuery,
  withAccountTransaction,
} from "./database";
import {
  consumeDummyAccountPasswordWork,
  hashAccountPassword,
  verifyAccountPassword,
} from "./password";
import {
  decryptOptionalAccountEmail,
  encryptOptionalAccountEmail,
} from "./private-data";
import {
  createRecoveryCodes,
  hashRecoveryCode,
} from "./recovery-codes";
import {
  createAccountSession,
} from "./session";
import {
  normalizeAccountUsername,
} from "./validation";

type AccountUserRow = {
  id: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
};

type AccountProfileRow = {
  username: string;
  display_name: string | null;
  email_encrypted: string | null;
  bio: string | null;
  created_at: Date;
};

export type AccountRegistrationInput = {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  bio?: string;
};

export type AccountProfileInput = {
  displayName?: string;
  email?: string;
  bio?: string;
};

export type AccountAuthenticationResult =
  | {
      authenticated: true;
      token: string;
      expiresAt: Date;
    }
  | {
      authenticated: false;
    };

export type AccountRegistrationResult =
  | {
      created: true;
      token: string;
      expiresAt: Date;
      recoveryCodes: string[];
    }
  | {
      created: false;
      reason: "username_taken";
    };

export type AccountRecoveryResult =
  | {
      recovered: true;
      token: string;
      expiresAt: Date;
      recoveryCodes: string[];
    }
  | {
      recovered: false;
    };

function lockDurationSeconds(failureCount: number) {
  if (failureCount < 5) return 0;
  return Math.min(15 * 60, 30 * 2 ** Math.min(failureCount - 5, 5));
}

async function recordFailedLogin(
  client: PoolClient,
  user: AccountUserRow
) {
  const failures = Math.min(user.failed_login_count + 1, 1000);
  const lockSeconds = lockDurationSeconds(failures);
  const lockedUntil = lockSeconds
    ? new Date(Date.now() + lockSeconds * 1000)
    : null;

  await client.query(
    `UPDATE deuna_accounts.users
     SET failed_login_count = $2,
         locked_until = $3,
         updated_at = now()
     WHERE id = $1`,
    [user.id, failures, lockedUntil]
  );
}

async function replaceRecoveryCodes(
  client: PoolClient,
  userId: string
) {
  const codes = createRecoveryCodes();

  await client.query(
    `DELETE FROM deuna_accounts.recovery_codes
     WHERE user_id = $1`,
    [userId]
  );

  for (const code of codes) {
    await client.query(
      `INSERT INTO deuna_accounts.recovery_codes
         (id, user_id, code_hash)
       VALUES ($1, $2, $3)`,
      [randomUUID(), userId, code.hash]
    );
  }

  return codes.map((code) => code.plain);
}

export async function registerAccount(
  input: AccountRegistrationInput
): Promise<AccountRegistrationResult> {
  const usernameKey = normalizeAccountUsername(input.username);
  const passwordHash = await hashAccountPassword(input.password);
  const encryptedEmail = encryptOptionalAccountEmail(input.email);
  const userId = randomUUID();

  try {
    return await withAccountTransaction(async (client) => {
      await client.query(
        `INSERT INTO deuna_accounts.users
           (id, username, username_key, password_hash, display_name, email_encrypted, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          input.username.trim(),
          usernameKey,
          passwordHash,
          input.displayName ?? null,
          encryptedEmail,
          input.bio ?? null,
        ]
      );

      const recoveryCodes = await replaceRecoveryCodes(client, userId);
      const session = await createAccountSession(client, userId);

      return {
        created: true as const,
        token: session.token,
        expiresAt: session.expiresAt,
        recoveryCodes,
      };
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

export async function authenticateAccount(
  username: string,
  password: string
): Promise<AccountAuthenticationResult> {
  const usernameKey = normalizeAccountUsername(username);

  return withAccountTransaction(async (client) => {
    const result = await client.query<AccountUserRow>(
      `SELECT
         id,
         password_hash,
         failed_login_count,
         locked_until
       FROM deuna_accounts.users
       WHERE username_key = $1
         AND active = true
       LIMIT 1
       FOR UPDATE`,
      [usernameKey]
    );
    const user = result.rows[0];

    if (!user) {
      await consumeDummyAccountPasswordWork(password);
      return { authenticated: false };
    }

    const passwordMatches = await verifyAccountPassword(
      password,
      user.password_hash
    );
    const currentlyLocked = Boolean(
      user.locked_until && user.locked_until.getTime() > Date.now()
    );

    if (!passwordMatches || currentlyLocked) {
      if (!currentlyLocked) {
        await recordFailedLogin(client, user);
      }
      return { authenticated: false };
    }

    await client.query(
      `UPDATE deuna_accounts.users
       SET failed_login_count = 0,
           locked_until = NULL,
           last_login_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [user.id]
    );
    await client.query(
      `UPDATE deuna_accounts.sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND expires_at <= now()`,
      [user.id]
    );

    const session = await createAccountSession(client, user.id);
    return {
      authenticated: true,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  });
}

export async function recoverAccount(
  username: string,
  recoveryCode: string,
  newPassword: string
): Promise<AccountRecoveryResult> {
  const usernameKey = normalizeAccountUsername(username);
  const newPasswordHash = await hashAccountPassword(newPassword);
  const recoveryCodeHash = hashRecoveryCode(recoveryCode);

  return withAccountTransaction(async (client) => {
    const result = await client.query<AccountUserRow>(
      `SELECT
         id,
         password_hash,
         failed_login_count,
         locked_until
       FROM deuna_accounts.users
       WHERE username_key = $1
         AND active = true
       LIMIT 1
       FOR UPDATE`,
      [usernameKey]
    );
    const user = result.rows[0];

    if (!user) {
      return { recovered: false };
    }

    const recovery = await client.query<{ id: string }>(
      `SELECT id
       FROM deuna_accounts.recovery_codes
       WHERE user_id = $1
         AND code_hash = $2
         AND used_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [user.id, recoveryCodeHash]
    );

    if (!recovery.rows[0]) {
      return { recovered: false };
    }

    await client.query(
      `UPDATE deuna_accounts.recovery_codes
       SET used_at = now()
       WHERE id = $1`,
      [recovery.rows[0].id]
    );
    await client.query(
      `UPDATE deuna_accounts.users
       SET password_hash = $2,
           password_changed_at = now(),
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()
       WHERE id = $1`,
      [user.id, newPasswordHash]
    );
    await client.query(
      `UPDATE deuna_accounts.sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [user.id]
    );

    const recoveryCodes = await replaceRecoveryCodes(client, user.id);
    const session = await createAccountSession(client, user.id);

    return {
      recovered: true,
      token: session.token,
      expiresAt: session.expiresAt,
      recoveryCodes,
    };
  });
}

export async function getAccountProfile(userId: string) {
  const result = await accountQuery<AccountProfileRow>(
    `SELECT
       username,
       display_name,
       email_encrypted,
       bio,
       created_at
     FROM deuna_accounts.users
     WHERE id = $1
       AND active = true
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    username: row.username,
    displayName: row.display_name,
    email: decryptOptionalAccountEmail(row.email_encrypted),
    bio: row.bio,
    createdAt: row.created_at,
  };
}

export async function updateAccountProfile(
  userId: string,
  input: AccountProfileInput
) {
  const encryptedEmail = encryptOptionalAccountEmail(input.email);

  await accountQuery(
    `UPDATE deuna_accounts.users
     SET display_name = $2,
         email_encrypted = $3,
         bio = $4,
         updated_at = now()
     WHERE id = $1
       AND active = true`,
    [
      userId,
      input.displayName ?? null,
      encryptedEmail,
      input.bio ?? null,
    ]
  );
}
