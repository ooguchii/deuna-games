import type { PoolConfig } from "pg";

export type AdminDatabasePurpose =
  | "runtime"
  | "migration";

const DEFAULT_DATABASE_PORT = 5432;

function required(
  value: string | undefined,
  variable: string
) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `Falta configurar la variable privada ${variable}.`
    );
  }

  return normalized;
}

function readPort(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_DATABASE_PORT;

  const port = Number(value);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "DEUNA_DATABASE_PORT debe ser un puerto válido."
    );
  }

  return port;
}

function readBoolean(
  value: string | undefined,
  fallback: boolean
) {
  if (!value?.trim()) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(
    "Las variables booleanas administrativas deben usar true o false."
  );
}

function isLoopbackHost(host: string) {
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "localhost" ||
    host.startsWith("/")
  );
}

export function isAdminEnabled() {
  return process.env.DEUNA_ADMIN_ENABLED === "true";
}

export function getAdminOrigin() {
  const configured = required(
    process.env.DEUNA_ADMIN_ORIGIN,
    "DEUNA_ADMIN_ORIGIN"
  );
  let url: URL;

  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      "DEUNA_ADMIN_ORIGIN debe ser un origen absoluto válido."
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" &&
      url.pathname !== "")
  ) {
    throw new Error(
      "DEUNA_ADMIN_ORIGIN sólo puede contener protocolo, host y puerto."
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "DEUNA_ADMIN_ORIGIN sólo admite http:// o https://."
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "DEUNA_ADMIN_ORIGIN debe usar HTTPS en producción."
    );
  }

  return url.origin;
}

export function getAdminSessionHours() {
  const raw =
    process.env.DEUNA_ADMIN_SESSION_HOURS?.trim() ||
    "8";
  const hours = Number(raw);

  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 24
  ) {
    throw new Error(
      "DEUNA_ADMIN_SESSION_HOURS debe estar entre 1 y 24."
    );
  }

  return hours;
}

export function getAdminRuntimeDatabaseRole() {
  return required(
    process.env.DEUNA_DATABASE_USER,
    "DEUNA_DATABASE_USER"
  );
}

export function getAdminDatabaseConfig(
  purpose: AdminDatabasePurpose
): PoolConfig {
  const host = required(
    process.env.DEUNA_DATABASE_HOST,
    "DEUNA_DATABASE_HOST"
  );
  const database = required(
    process.env.DEUNA_DATABASE_NAME,
    "DEUNA_DATABASE_NAME"
  );
  const user =
    purpose === "migration"
      ? required(
          process.env.DEUNA_DATABASE_MIGRATION_USER,
          "DEUNA_DATABASE_MIGRATION_USER"
        )
      : getAdminRuntimeDatabaseRole();
  const password =
    purpose === "migration"
      ? required(
          process.env.DEUNA_DATABASE_MIGRATION_PASSWORD,
          "DEUNA_DATABASE_MIGRATION_PASSWORD"
        )
      : required(
          process.env.DEUNA_DATABASE_PASSWORD,
          "DEUNA_DATABASE_PASSWORD"
        );
  const useSsl = readBoolean(
    process.env.DEUNA_DATABASE_SSL,
    false
  );

  if (
    process.env.NODE_ENV === "production" &&
    !isLoopbackHost(host) &&
    !useSsl
  ) {
    throw new Error(
      "Una base PostgreSQL no local exige DEUNA_DATABASE_SSL=true en producción."
    );
  }

  return {
    host,
    port: readPort(
      process.env.DEUNA_DATABASE_PORT
    ),
    database,
    user,
    password,
    ssl: useSsl
      ? { rejectUnauthorized: true }
      : false,
    application_name:
      purpose === "migration"
        ? "deuna_admin_migration"
        : "deuna_admin_runtime",
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5_000,
    query_timeout: 6_000,
    max: purpose === "migration" ? 1 : 5,
    allowExitOnIdle: true,
  };
}

export function assertSafePostgresRole(
  value: string
) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(value)) {
    throw new Error(
      "El nombre del rol PostgreSQL no cumple el formato seguro."
    );
  }

  return value;
}
