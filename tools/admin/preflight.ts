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

import { games } from "../../src/data/games.ts";
import {
  gameUpdates,
} from "../../src/data/update-records.ts";
import {
  assertSafePostgresRole,
  getAdminDatabaseConfig,
  getAdminOrigin,
  getAdminRuntimeDatabaseRole,
  getAdminSessionHours,
} from "../../src/lib/admin/database-config.ts";

type PreflightPurpose =
  | "migration"
  | "runtime";

type RoleRow = {
  rolname: string;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  rolcanlogin: boolean;
};

type MigrationRow = {
  name: string;
  checksum: string;
};

type ContentCountRow = {
  item_type: string;
  count: number;
};

type PrivilegeRow = {
  object_name: string;
  can_delete: boolean;
  can_truncate: boolean;
  can_references: boolean;
  can_trigger: boolean;
};

type ColumnPrivilegeRow = {
  table_name: string;
  column_name: string;
  privilege_type: string;
};

type SequencePrivilegeRow = {
  object_name: string;
  can_usage: boolean;
  can_select: boolean;
  can_update: boolean;
};

const migrationsDirectory = path.join(
  process.cwd(),
  "database",
  "migrations"
);
const failures: string[] = [];

const expectedColumnPrivileges = new Set([
  "admin_users.id.SELECT",
  "admin_users.username.SELECT",
  "admin_users.username_key.SELECT",
  "admin_users.role.SELECT",
  "admin_users.password_hash.SELECT",
  "admin_users.active.SELECT",
  "admin_users.failed_login_count.SELECT",
  "admin_users.locked_until.SELECT",
  "admin_users.failed_login_count.UPDATE",
  "admin_users.locked_until.UPDATE",
  "admin_users.last_login_at.UPDATE",
  "admin_users.updated_at.UPDATE",
  "admin_sessions.id.SELECT",
  "admin_sessions.user_id.SELECT",
  "admin_sessions.token_hash.SELECT",
  "admin_sessions.expires_at.SELECT",
  "admin_sessions.revoked_at.SELECT",
  "admin_sessions.id.INSERT",
  "admin_sessions.user_id.INSERT",
  "admin_sessions.token_hash.INSERT",
  "admin_sessions.expires_at.INSERT",
  "admin_sessions.revoked_at.UPDATE",
  "admin_events.id.SELECT",
  "admin_events.user_id.SELECT",
  "admin_events.event_type.SELECT",
  "admin_events.occurred_at.SELECT",
  "admin_events.user_id.INSERT",
  "admin_events.event_type.INSERT",
  "editorial_items.id.SELECT",
  "editorial_items.item_type.SELECT",
  "editorial_items.item_key.SELECT",
  "editorial_items.source_payload.SELECT",
  "editorial_items.source_checksum.SELECT",
  "editorial_items.source_present.SELECT",
  "editorial_items.draft_payload.SELECT",
  "editorial_items.draft_status.SELECT",
  "editorial_items.revision.SELECT",
  "editorial_items.source_imported_at.SELECT",
  "editorial_items.updated_at.SELECT",
  "editorial_items.updated_by.SELECT",
  "editorial_items.draft_payload.UPDATE",
  "editorial_items.draft_status.UPDATE",
  "editorial_items.revision.UPDATE",
  "editorial_items.updated_at.UPDATE",
  "editorial_items.updated_by.UPDATE",
  "editorial_revisions.id.SELECT",
  "editorial_revisions.item_id.SELECT",
  "editorial_revisions.revision.SELECT",
  "editorial_revisions.payload.SELECT",
  "editorial_revisions.action.SELECT",
  "editorial_revisions.actor_user_id.SELECT",
  "editorial_revisions.created_at.SELECT",
  "editorial_revisions.item_id.INSERT",
  "editorial_revisions.revision.INSERT",
  "editorial_revisions.payload.INSERT",
  "editorial_revisions.action.INSERT",
  "editorial_revisions.actor_user_id.INSERT",
  "admin_audit_log.user_id.INSERT",
  "admin_audit_log.action.INSERT",
  "admin_audit_log.entity_type.INSERT",
  "admin_audit_log.entity_id.INSERT",
  "admin_audit_log.details.INSERT",
]);

const expectedSequencePrivileges = new Set([
  "admin_events_id_seq",
  "editorial_revisions_id_seq",
  "admin_audit_log_id_seq",
]);

function assert(
  condition: unknown,
  message: string
) {
  if (!condition) failures.push(message);
}

function parsePurpose(): PreflightPurpose {
  const argument = process.argv.find(
    (value) =>
      value.startsWith("--purpose=")
  );
  const purpose = argument?.slice(
    "--purpose=".length
  );

  if (
    purpose !== "migration" &&
    purpose !== "runtime"
  ) {
    throw new Error(
      "Usa --purpose=migration o --purpose=runtime."
    );
  }

  return purpose;
}

function requiredEnvironment(
  name: string
) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta configurar ${name}.`
    );
  }

  return value;
}

function isLoopbackHost(host: string) {
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "localhost" ||
    host.startsWith("/")
  );
}

function checksum(content: string) {
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

async function getLocalMigrations() {
  const names = (
    await readdir(migrationsDirectory)
  )
    .filter((name) =>
      /^\d{3}_[a-z0-9_]+\.sql$/.test(name)
    )
    .sort();

  const entries = await Promise.all(
    names.map(async (name) => ({
      name,
      checksum: checksum(
        await readFile(
          path.join(
            migrationsDirectory,
            name
          ),
          "utf8"
        )
      ),
    }))
  );

  return entries;
}

function validateRuntimeEnvironment() {
  assert(
    process.env.NODE_ENV === "production",
    "NODE_ENV debe ser production en el preflight del runtime."
  );
  assert(
    process.env.DEUNA_ADMIN_ENABLED ===
      "false" ||
      process.env.DEUNA_ADMIN_ENABLED ===
        "true",
    "DEUNA_ADMIN_ENABLED debe usar exactamente true o false."
  );

  const siteUrl = new URL(
    requiredEnvironment(
      "NEXT_PUBLIC_SITE_URL"
    )
  );

  assert(
    siteUrl.protocol === "https:",
    "NEXT_PUBLIC_SITE_URL debe usar HTTPS en producción."
  );
  assert(
    !siteUrl.username &&
      !siteUrl.password &&
      !siteUrl.search &&
      !siteUrl.hash &&
      (siteUrl.pathname === "/" ||
        siteUrl.pathname === ""),
    "NEXT_PUBLIC_SITE_URL debe contener sólo el origen HTTPS."
  );

  getAdminOrigin();
  getAdminSessionHours();
}

async function checkRoles(
  pool: Pool,
  purpose: PreflightPurpose,
  runtimeRole: string,
  migrationRole: string
) {
  const current = await pool.query<{
    database_name: string;
    user_name: string;
  }>(
    `SELECT current_database() AS database_name,
            current_user AS user_name`
  );
  const expectedCurrentRole =
    purpose === "migration"
      ? migrationRole
      : runtimeRole;

  assert(
    current.rows[0]?.database_name ===
      requiredEnvironment(
        "DEUNA_DATABASE_NAME"
      ),
    "La conexión no apunta a la base configurada."
  );
  assert(
    current.rows[0]?.user_name ===
      expectedCurrentRole,
    `La conexión ${purpose} no usa el rol esperado.`
  );
  assert(
    runtimeRole !== migrationRole,
    "Los roles runtime y migrador deben ser diferentes."
  );

  const result = await pool.query<RoleRow>(
    `SELECT rolname,
            rolsuper,
            rolcreatedb,
            rolcreaterole,
            rolreplication,
            rolbypassrls,
            rolcanlogin
       FROM pg_roles
      WHERE rolname = ANY($1::text[])`,
    [[runtimeRole, migrationRole]]
  );

  assert(
    result.rows.length === 2,
    "Deben existir los roles runtime y migrador."
  );

  for (const role of result.rows) {
    assert(
      role.rolcanlogin,
      `El rol ${role.rolname} debe permitir conexión.`
    );
    assert(
      !role.rolsuper &&
        !role.rolcreatedb &&
        !role.rolcreaterole &&
        !role.rolreplication &&
        !role.rolbypassrls,
      `El rol ${role.rolname} tiene privilegios globales peligrosos.`
    );
  }

  const databaseOwner = await pool.query<{
    owner_name: string;
  }>(
    `SELECT pg_get_userbyid(datdba) AS owner_name
       FROM pg_database
      WHERE datname = current_database()`
  );

  assert(
    databaseOwner.rows[0]?.owner_name ===
      migrationRole,
    "El rol migrador debe ser propietario de la base administrativa."
  );
}

async function checkPublicBoundary(
  pool: Pool,
  runtimeRole: string
) {
  const result = await pool.query<{
    runtime_database_create: boolean;
    runtime_database_temp: boolean;
    runtime_schema_create: boolean;
    runtime_schema_usage: boolean;
    public_database_access: boolean;
    public_schema_access: boolean;
    public_table_access: boolean;
  }>(
    `SELECT
       has_database_privilege(
         $1,
         current_database(),
         'CREATE'
       ) AS runtime_database_create,
       has_database_privilege(
         $1,
         current_database(),
         'TEMP'
       ) AS runtime_database_temp,
       has_schema_privilege(
         $1,
         'deuna_admin',
         'CREATE'
       ) AS runtime_schema_create,
       has_schema_privilege(
         $1,
         'deuna_admin',
         'USAGE'
       ) AS runtime_schema_usage,
       EXISTS (
         SELECT 1
           FROM pg_database database,
                LATERAL aclexplode(
                  COALESCE(
                    database.datacl,
                    acldefault(
                      'd',
                      database.datdba
                    )
                  )
                ) acl
          WHERE database.datname =
                current_database()
            AND acl.grantee = 0
       ) AS public_database_access,
       EXISTS (
         SELECT 1
           FROM pg_namespace namespace,
                LATERAL aclexplode(
                  COALESCE(
                    namespace.nspacl,
                    acldefault(
                      'n',
                      namespace.nspowner
                    )
                  )
                ) acl
          WHERE namespace.nspname =
                'deuna_admin'
            AND acl.grantee = 0
       ) AS public_schema_access,
       EXISTS (
         SELECT 1
           FROM pg_class object
           JOIN pg_namespace namespace
             ON namespace.oid =
                object.relnamespace
           CROSS JOIN LATERAL aclexplode(
             COALESCE(
               object.relacl,
               acldefault(
                 CASE
                   WHEN object.relkind = 'S'
                     THEN 's'::"char"
                   ELSE 'r'::"char"
                 END,
                 object.relowner
               )
             )
           ) acl
          WHERE namespace.nspname =
                'deuna_admin'
            AND object.relkind IN (
              'r',
              'p',
              'S'
            )
            AND acl.grantee = 0
       ) AS public_table_access`,
    [runtimeRole]
  );
  const boundary = result.rows[0];

  assert(
    boundary?.runtime_schema_usage,
    "El rol runtime necesita USAGE sobre el esquema administrativo."
  );
  assert(
    !boundary?.runtime_database_create &&
      !boundary?.runtime_database_temp &&
      !boundary?.runtime_schema_create,
    "El rol runtime puede crear objetos fuera de sus permisos mínimos."
  );
  assert(
    !boundary?.public_database_access &&
      !boundary?.public_schema_access &&
      !boundary?.public_table_access,
    "PUBLIC conserva acceso a la base o al esquema administrativo."
  );
}

async function checkRuntimePrivileges(
  pool: Pool,
  runtimeRole: string
) {
  const tablePrivileges =
    await pool.query<PrivilegeRow>(
      `SELECT object.relname AS object_name,
              has_table_privilege(
                $1,
                object.oid,
                'DELETE'
              ) AS can_delete,
              has_table_privilege(
                $1,
                object.oid,
                'TRUNCATE'
              ) AS can_truncate,
              has_table_privilege(
                $1,
                object.oid,
                'REFERENCES'
              ) AS can_references,
              has_table_privilege(
                $1,
                object.oid,
                'TRIGGER'
              ) AS can_trigger
         FROM pg_class object
         JOIN pg_namespace namespace
           ON namespace.oid =
              object.relnamespace
        WHERE namespace.nspname =
              'deuna_admin'
          AND object.relkind IN ('r', 'p')
        ORDER BY object.relname`,
      [runtimeRole]
    );

  for (const privilege of tablePrivileges.rows) {
    assert(
      !privilege.can_delete &&
        !privilege.can_truncate &&
        !privilege.can_references &&
        !privilege.can_trigger,
      `El rol runtime tiene un permiso peligroso sobre ${privilege.object_name}.`
    );
  }

  const columns =
    await pool.query<ColumnPrivilegeRow>(
      `SELECT table_name,
              column_name,
              privilege_type
         FROM information_schema.column_privileges
        WHERE grantee = $1
          AND table_schema = 'deuna_admin'
        ORDER BY table_name,
                 column_name,
                 privilege_type`,
      [runtimeRole]
    );
  const actualColumns = new Set(
    columns.rows.map(
      (row) =>
        `${row.table_name}.${row.column_name}.${row.privilege_type}`
    )
  );

  for (const expected of expectedColumnPrivileges) {
    assert(
      actualColumns.has(expected),
      `Falta el permiso runtime mínimo ${expected}.`
    );
  }

  for (const actual of actualColumns) {
    assert(
      expectedColumnPrivileges.has(actual),
      `El rol runtime tiene un permiso de columna no previsto: ${actual}.`
    );
  }

  const sequences =
    await pool.query<SequencePrivilegeRow>(
      `SELECT object.relname AS object_name,
              has_sequence_privilege(
                $1,
                object.oid,
                'USAGE'
              ) AS can_usage,
              has_sequence_privilege(
                $1,
                object.oid,
                'SELECT'
              ) AS can_select,
              has_sequence_privilege(
                $1,
                object.oid,
                'UPDATE'
              ) AS can_update
         FROM pg_class object
         JOIN pg_namespace namespace
           ON namespace.oid =
              object.relnamespace
        WHERE namespace.nspname =
              'deuna_admin'
          AND object.relkind = 'S'
        ORDER BY object.relname`,
      [runtimeRole]
    );

  for (const sequence of sequences.rows) {
    const expected =
      expectedSequencePrivileges.has(
        sequence.object_name
      );

    assert(
      expected ===
        (sequence.can_usage &&
          sequence.can_select) &&
        !sequence.can_update,
      `Los permisos de la secuencia ${sequence.object_name} no son mínimos.`
    );
  }
}

async function checkMigrations(
  pool: Pool
) {
  const local =
    await getLocalMigrations();
  const applied = await pool.query<MigrationRow>(
    `SELECT name, checksum
       FROM deuna_admin.schema_migrations
      ORDER BY name`
  );

  assert(
    local.length > 0,
    "No se encontraron migraciones locales."
  );
  assert(
    applied.rows.length === local.length,
    "La cantidad de migraciones aplicadas no coincide con el código."
  );

  for (const migration of local) {
    const databaseMigration =
      applied.rows.find(
        (row) =>
          row.name === migration.name
      );

    assert(
      databaseMigration?.checksum ===
        migration.checksum,
      `La migración ${migration.name} falta o tiene un checksum diferente.`
    );
  }
}

async function checkApplicationState(
  pool: Pool
) {
  const owner = await pool.query<{
    active_count: number;
  }>(
    `SELECT count(id)::integer AS active_count
       FROM deuna_admin.admin_users
      WHERE active = true`
  );

  assert(
    owner.rows[0]?.active_count === 1,
    "Debe existir exactamente una cuenta propietaria activa."
  );

  const content =
    await pool.query<ContentCountRow>(
      `SELECT item_type,
              count(id)::integer AS count
         FROM deuna_admin.editorial_items
        WHERE source_present = true
        GROUP BY item_type`
    );
  const counts = new Map(
    content.rows.map((row) => [
      row.item_type,
      row.count,
    ])
  );

  assert(
    counts.get("game") === games.length,
    `La base debe contener ${games.length} juegos activos importados.`
  );
  assert(
    counts.get("game_update") ===
      gameUpdates.length,
    `La base debe contener ${gameUpdates.length} actualizaciones activas importadas.`
  );
  assert(
    counts.get("site_config") === 1,
    "La base debe contener una configuración pública importada."
  );
}

function safeDatabaseError(
  error: unknown
) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  switch (code) {
    case "28P01":
      return "PostgreSQL rechazó la contraseña del rol configurado.";
    case "3D000":
      return "La base PostgreSQL configurada todavía no existe.";
    case "42501":
      return "El rol configurado no tiene los permisos necesarios para completar la verificación.";
    case "ECONNREFUSED":
      return "PostgreSQL no está aceptando conexiones en la dirección local configurada.";
    default:
      return "No se pudo completar la verificación privada de PostgreSQL. Revisa el servicio, el archivo de entorno y los pasos de instalación.";
  }
}

async function main() {
  const purpose = parsePurpose();
  const runtimeRole =
    assertSafePostgresRole(
      getAdminRuntimeDatabaseRole()
    );
  const migrationRole =
    assertSafePostgresRole(
      purpose === "migration"
        ? requiredEnvironment(
            "DEUNA_DATABASE_MIGRATION_USER"
          )
        : process.env.DEUNA_DATABASE_MIGRATION_USER?.trim() ||
            "deuna_migrator"
    );
  const databaseHost =
    requiredEnvironment(
      "DEUNA_DATABASE_HOST"
    );

  assert(
    isLoopbackHost(databaseHost),
    "PostgreSQL debe usar loopback o un socket local en este despliegue."
  );

  if (purpose === "runtime") {
    validateRuntimeEnvironment();
  }

  if (failures.length > 0) {
    throw new Error(
      "La configuración local previa no es segura."
    );
  }

  const pool = new Pool(
    getAdminDatabaseConfig(purpose)
  );

  try {
    await checkRoles(
      pool,
      purpose,
      runtimeRole,
      migrationRole
    );
    await checkPublicBoundary(
      pool,
      runtimeRole
    );
    await checkRuntimePrivileges(
      pool,
      runtimeRole
    );
    if (purpose === "migration") {
      await checkMigrations(pool);
    }
    await checkApplicationState(pool);
  } finally {
    await pool.end();
  }

  if (failures.length > 0) {
    console.error(
      "\nPreflight administrativo: BLOQUEADO\n"
    );

    for (const failure of failures) {
      console.error(`- ${failure}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `Preflight ${purpose}: OK (PostgreSQL local, roles mínimos, migraciones, propietario y contenido verificados sin modificar datos).`
  );
}

main().catch((error: unknown) => {
  if (failures.length > 0) {
    console.error(
      "\nPreflight administrativo: BLOQUEADO\n"
    );

    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
  } else if (
    error instanceof Error &&
    !(
      typeof error === "object" &&
      "code" in error
    )
  ) {
    console.error(error.message);
  } else {
    console.error(safeDatabaseError(error));
  }

  process.exitCode = 1;
});
