import {
  createHash,
  randomUUID,
} from "node:crypto";
import process from "node:process";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../src/lib/admin/database-config.ts";

const failures: string[] = [];

function assert(
  condition: unknown,
  message: string
) {
  if (!condition) failures.push(message);
}

function postgresCode(error: unknown) {
  return
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
}

async function expectPrivilegeDenied(
  pool: Pool,
  label: string,
  query: string,
  values: readonly unknown[] = []
) {
  try {
    await pool.query(query, values);
    failures.push(
      `${label}: el rol runtime pudo ejecutar una operación que debía estar denegada.`
    );
  } catch (error) {
    assert(
      postgresCode(error) === "42501",
      `${label}: PostgreSQL devolvió un error distinto de privilegios insuficientes.`
    );
  }
}

async function main() {
  const pool = new Pool(
    getAdminDatabaseConfig("runtime")
  );
  const userId = randomUUID();
  const sessionId = randomUUID();
  const recoveryId = randomUUID();
  const recoveryCascadeId = randomUUID();
  const username = `ci_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const sessionHash = createHash("sha256")
    .update(randomUUID(), "utf8")
    .digest("hex");
  const recoveryHash = createHash("sha256")
    .update(randomUUID(), "utf8")
    .digest("hex");
  const recoveryCascadeHash = createHash("sha256")
    .update(randomUUID(), "utf8")
    .digest("hex");

  try {
    await pool.query(
      `INSERT INTO deuna_accounts.users
         (id, username, username_key, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        username,
        username,
        "ci-password-hash-placeholder",
      ]
    );

    await pool.query(
      `INSERT INTO deuna_accounts.sessions
         (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [sessionId, userId, sessionHash]
    );

    await pool.query(
      `INSERT INTO deuna_accounts.recovery_codes
         (id, user_id, code_hash)
       VALUES ($1, $2, $3), ($4, $2, $5)`,
      [
        recoveryId,
        userId,
        recoveryHash,
        recoveryCascadeId,
        recoveryCascadeHash,
      ]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado directo de sesiones",
      `DELETE FROM deuna_accounts.sessions
       WHERE id = $1`,
      [sessionId]
    );

    await expectPrivilegeDenied(
      pool,
      "Cambio del estado activo de la cuenta",
      `UPDATE deuna_accounts.users
       SET active = false
       WHERE id = $1`,
      [userId]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado de cuentas administrativas",
      `DELETE FROM deuna_admin.admin_users
       WHERE id = $1`,
      [randomUUID()]
    );

    await expectPrivilegeDenied(
      pool,
      "Creación de tablas desde runtime",
      `CREATE TABLE deuna_accounts.ci_forbidden_table (
         id integer PRIMARY KEY
       )`
    );

    const rotated = await pool.query(
      `DELETE FROM deuna_accounts.recovery_codes
       WHERE id = $1`,
      [recoveryId]
    );

    assert(
      rotated.rowCount === 1,
      "El rol runtime no pudo eliminar un código de recuperación durante la rotación."
    );

    const deleted = await pool.query(
      `DELETE FROM deuna_accounts.users
       WHERE id = $1`,
      [userId]
    );

    assert(
      deleted.rowCount === 1,
      "El rol runtime no pudo eliminar físicamente la cuenta pública."
    );

    const remaining = await pool.query<{
      users: number;
      sessions: number;
      recovery_codes: number;
    }>(
      `SELECT
         (SELECT count(*)::integer
            FROM deuna_accounts.users
           WHERE id = $1) AS users,
         (SELECT count(*)::integer
            FROM deuna_accounts.sessions
           WHERE user_id = $1) AS sessions,
         (SELECT count(*)::integer
            FROM deuna_accounts.recovery_codes
           WHERE user_id = $1) AS recovery_codes`,
      [userId]
    );
    const counts = remaining.rows[0];

    assert(
      counts?.users === 0,
      "La cuenta pública continuó almacenada después de su eliminación."
    );
    assert(
      counts?.sessions === 0,
      "Las sesiones no fueron eliminadas por cascada."
    );
    assert(
      counts?.recovery_codes === 0,
      "Los códigos de recuperación no fueron eliminados por cascada."
    );
  } finally {
    await pool
      .query(
        `DELETE FROM deuna_accounts.users
         WHERE id = $1`,
        [userId]
      )
      .catch(() => {});
    await pool.end();
  }

  if (failures.length > 0) {
    console.error("\nPostgreSQL de cuentas: ERROR\n");

    for (const failure of failures) {
      console.error(`- ${failure}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    "PostgreSQL de cuentas: OK (permisos runtime reales, denegaciones sensibles, rotación y borrado por cascada verificados)."
  );
}

main().catch((error: unknown) => {
  const code = postgresCode(error);

  console.error(
    code
      ? `PostgreSQL de cuentas: ERROR (${code}).`
      : "PostgreSQL de cuentas: ERROR de conexión o ejecución."
  );
  process.exitCode = 1;
});
