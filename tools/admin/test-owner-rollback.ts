import {
  randomBytes,
  randomUUID,
} from "node:crypto";
import process from "node:process";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../../src/lib/admin/database-config.ts";
import {
  hashAdminPassword,
  verifyAdminPassword,
} from "../../src/lib/admin/password.ts";
import {
  normalizeAdminUsername,
} from "../../src/lib/admin/validation.ts";

type OwnerRow = {
  id: string;
  username: string;
};

function assertLocalDatabase() {
  const host =
    process.env.DEUNA_DATABASE_HOST?.trim();

  if (
    host !== "127.0.0.1" &&
    host !== "localhost" &&
    host !== "::1"
  ) {
    throw new Error(
      "El usuario de prueba sólo puede ejecutarse contra PostgreSQL local."
    );
  }
}

async function main() {
  assertLocalDatabase();

  const testId = randomUUID();
  const testUsername =
    `diag_${randomBytes(8).toString("hex")}`;
  let testPassword =
    `Diag9!${randomBytes(18).toString("hex")}`;
  const testHash =
    await hashAdminPassword(testPassword);

  const pool = new Pool(
    getAdminDatabaseConfig("migration")
  );
  const client = await pool.connect();
  let originalOwnerId = "";

  try {
    await client.query("BEGIN");

    const owners = await client.query<OwnerRow>(
      `SELECT id, username
       FROM deuna_admin.admin_users
       WHERE active = true
         AND role = 'owner'
       LIMIT 2
       FOR UPDATE`
    );

    if (owners.rowCount !== 1) {
      throw new Error(
        "Para ejecutar la prueba debe existir exactamente una cuenta propietaria activa."
      );
    }

    originalOwnerId = owners.rows[0]!.id;

    await client.query(
      `UPDATE deuna_admin.admin_users
       SET active = false,
           updated_at = now()
       WHERE id = $1`,
      [originalOwnerId]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_users
         (id, username, username_key, password_hash, role, active)
       VALUES ($1, $2, $3, $4, 'owner', true)`,
      [
        testId,
        testUsername,
        normalizeAdminUsername(testUsername),
        testHash,
      ]
    );

    const selected = await client.query<{
      id: string;
      password_hash: string;
    }>(
      `SELECT id, password_hash
       FROM deuna_admin.admin_users
       WHERE username_key = $1
         AND active = true
         AND role = 'owner'
       LIMIT 1
       FOR UPDATE`,
      [normalizeAdminUsername(testUsername)]
    );
    const testOwner = selected.rows[0];

    if (!testOwner || testOwner.id !== testId) {
      throw new Error(
        "La consulta de autenticación no pudo recuperar al usuario temporal."
      );
    }

    const acceptsCorrectPassword =
      await verifyAdminPassword(
        testPassword,
        testOwner.password_hash
      );
    const rejectsWrongPassword =
      await verifyAdminPassword(
        `${testPassword}X`,
        testOwner.password_hash
      );
    testPassword = "";

    if (
      !acceptsCorrectPassword ||
      rejectsWrongPassword
    ) {
      throw new Error(
        "La capa de hash/verificación no superó la prueba temporal."
      );
    }

    const activeOwners = await client.query<{
      id: string;
    }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE active = true
         AND role = 'owner'`
    );

    if (
      activeOwners.rowCount !== 1 ||
      activeOwners.rows[0]?.id !== testId
    ) {
      throw new Error(
        "La restricción de propietario único no se comportó como se esperaba."
      );
    }

    await client.query("ROLLBACK");

    const restored = await client.query<{
      id: string;
    }>(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE active = true
         AND role = 'owner'`
    );

    if (
      restored.rowCount !== 1 ||
      restored.rows[0]?.id !== originalOwnerId
    ) {
      throw new Error(
        "La transacción se revirtió, pero no se pudo confirmar la restauración del propietario original."
      );
    }

    console.log(
      "[OK] Usuario temporal creado dentro de una transacción."
    );
    console.log(
      "[OK] Hash correcto aceptado y contraseña incorrecta rechazada."
    );
    console.log(
      "[OK] Restricción de único propietario validada."
    );
    console.log(
      "[OK] ROLLBACK confirmado: el usuario temporal fue eliminado y la cuenta original quedó activa."
    );
  } catch (error) {
    testPassword = "";
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    testPassword = "";
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo completar la prueba de usuario temporal.";

  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
});
