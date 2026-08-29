import {
  createHash,
} from "node:crypto";
import {
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { Pool } from "pg";

import {
  assertSafePostgresRole,
  getAdminDatabaseConfig,
  getAdminRuntimeDatabaseRole,
} from "../../src/lib/admin/database-config.ts";

const migrationsDirectory = path.join(
  process.cwd(),
  "database",
  "migrations"
);
const migrationLockKey = 1_926_042_786;

function checksum(content: string) {
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function ensureMigrationRegistry(
  pool: Pool
) {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS deuna_admin;
    REVOKE ALL ON SCHEMA deuna_admin FROM PUBLIC;

    CREATE TABLE IF NOT EXISTS deuna_admin.schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT schema_migrations_checksum_check CHECK (
        checksum ~ '^[0-9a-f]{64}$'
      )
    );
  `);
}

async function grantRuntimePrivileges(
  pool: Pool
) {
  const runtimeRole = assertSafePostgresRole(
    getAdminRuntimeDatabaseRole()
  );
  const role = quoteIdentifier(runtimeRole);

  await pool.query(`
    REVOKE ALL ON SCHEMA deuna_admin FROM PUBLIC;
    REVOKE ALL ON SCHEMA deuna_admin FROM ${role};
    REVOKE ALL ON ALL TABLES IN SCHEMA deuna_admin FROM ${role};
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA deuna_admin FROM ${role};
    GRANT USAGE ON SCHEMA deuna_admin TO ${role};

    GRANT SELECT (
        id,
        username,
        username_key,
        role,
        password_hash,
        active,
        failed_login_count,
        locked_until
      )
      ON deuna_admin.admin_users
      TO ${role};

    GRANT UPDATE (
        failed_login_count,
        locked_until,
        last_login_at,
        updated_at
      )
      ON deuna_admin.admin_users
      TO ${role};

    GRANT SELECT (
        id,
        user_id,
        token_hash,
        expires_at,
        revoked_at
      )
      ON deuna_admin.admin_sessions
      TO ${role};

    GRANT INSERT (
        id,
        user_id,
        token_hash,
        expires_at
      )
      ON deuna_admin.admin_sessions
      TO ${role};

    GRANT UPDATE (revoked_at)
      ON deuna_admin.admin_sessions
      TO ${role};

    GRANT SELECT (
        id,
        user_id,
        event_type,
        occurred_at
      )
      ON deuna_admin.admin_events
      TO ${role};

    GRANT INSERT (user_id, event_type)
      ON deuna_admin.admin_events
      TO ${role};

    GRANT SELECT (
        id,
        item_type,
        item_key,
        source_payload,
        source_checksum,
        source_present,
        draft_payload,
        draft_status,
        revision,
        source_imported_at,
        updated_at,
        updated_by
      )
      ON deuna_admin.editorial_items
      TO ${role};

    GRANT UPDATE (
        draft_payload,
        draft_status,
        revision,
        updated_at,
        updated_by
      )
      ON deuna_admin.editorial_items
      TO ${role};

    GRANT SELECT (
        id,
        item_id,
        revision,
        payload,
        action,
        actor_user_id,
        created_at
      )
      ON deuna_admin.editorial_revisions
      TO ${role};

    GRANT INSERT (
        item_id,
        revision,
        payload,
        action,
        actor_user_id
      )
      ON deuna_admin.editorial_revisions
      TO ${role};

    GRANT INSERT (
        user_id,
        action,
        entity_type,
        entity_id,
        details
      )
      ON deuna_admin.admin_audit_log
      TO ${role};

    GRANT USAGE, SELECT
      ON SEQUENCE deuna_admin.admin_events_id_seq,
                  deuna_admin.editorial_revisions_id_seq,
                  deuna_admin.admin_audit_log_id_seq
      TO ${role};

    REVOKE ALL
      ON deuna_admin.schema_migrations
      FROM ${role};
  `);
}

async function main() {
  const pool = new Pool(
    getAdminDatabaseConfig("migration")
  );

  try {
    await ensureMigrationRegistry(pool);
    await pool.query(
      "SELECT pg_advisory_lock($1)",
      [migrationLockKey]
    );

    const names = (
      await readdir(migrationsDirectory)
    )
      .filter((name) =>
        /^\d{3}_[a-z0-9_]+\.sql$/.test(name)
      )
      .sort();

    if (names.length === 0) {
      throw new Error(
        "No se encontraron migraciones administrativas."
      );
    }

    for (const name of names) {
      const sql = await readFile(
        path.join(migrationsDirectory, name),
        "utf8"
      );
      const digest = checksum(sql);
      const applied = await pool.query<{
        checksum: string;
      }>(
        `SELECT checksum
         FROM deuna_admin.schema_migrations
         WHERE name = $1`,
        [name]
      );

      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== digest) {
          throw new Error(
            `La migración aplicada ${name} fue modificada. Crea una migración nueva.`
          );
        }

        console.log(`Sin cambios: ${name}`);
        continue;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO deuna_admin.schema_migrations
             (name, checksum)
           VALUES ($1, $2)`,
          [name, digest]
        );
        await client.query("COMMIT");
        console.log(`Aplicada: ${name}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }

    await grantRuntimePrivileges(pool);
    console.log(
      "Migraciones administrativas completas y permisos mínimos actualizados."
    );
  } finally {
    await pool
      .query("SELECT pg_advisory_unlock($1)", [
        migrationLockKey,
      ])
      .catch(() => {});
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    "No se pudieron aplicar las migraciones administrativas. Revisa la conexión privada y los permisos del rol migrador."
  );
  process.exitCode = 1;
});
