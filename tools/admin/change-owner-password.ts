import process from "node:process";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../../src/lib/admin/database-config.ts";
import {
  hashAdminPassword,
  validateAdminPassword,
} from "../../src/lib/admin/password.ts";
import {
  readConfirmedAdminPassword,
} from "./interactive-password.ts";

type OwnerRow = {
  id: string;
  username: string;
};

async function main() {
  console.log(
    "La nueva contraseña debe tener entre 16 y 128 caracteres, una letra, un número y un símbolo."
  );
  console.log(
    "No aparecerán letras, puntos ni asteriscos mientras la escribes. Es normal."
  );

  let password =
    await readConfirmedAdminPassword(
      "Nueva contraseña del propietario: ",
      "Repite la nueva contraseña: "
    );
  const issues = validateAdminPassword(password);

  if (issues.length > 0) {
    password = "";
    throw new Error(issues.join(" "));
  }

  const passwordHash =
    await hashAdminPassword(password);
  password = "";

  const pool = new Pool(
    getAdminDatabaseConfig("migration")
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const owners = await client.query<OwnerRow>(
      `SELECT id, username
       FROM deuna_admin.admin_users
       WHERE active = true
         AND role = 'owner'
       ORDER BY created_at
       LIMIT 2
       FOR UPDATE`
    );

    if (owners.rowCount !== 1) {
      throw new Error(
        "Debe existir exactamente una cuenta propietaria activa."
      );
    }

    const owner = owners.rows[0]!;

    await client.query(
      `UPDATE deuna_admin.admin_users
       SET password_hash = $2,
           failed_login_count = 0,
           locked_until = NULL,
           password_changed_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [owner.id, passwordHash]
    );

    await client.query(
      `UPDATE deuna_admin.admin_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [owner.id]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_events
         (user_id, event_type)
       VALUES ($1, 'owner_password_changed')`,
      [owner.id]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id)
       VALUES ($1::uuid, 'owner_password_changed', 'admin_user', $2::text)`,
      [owner.id, owner.id]
    );

    await client.query("COMMIT");
    console.log(
      `Contraseña de ${owner.username} actualizada. Las sesiones anteriores fueron revocadas.`
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo cambiar la contraseña propietaria.";

  console.error(message);
  process.exitCode = 1;
});
