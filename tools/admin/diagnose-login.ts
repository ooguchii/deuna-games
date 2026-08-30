import process from "node:process";
import { randomUUID } from "node:crypto";
import {
  createInterface,
} from "node:readline/promises";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
  getAdminOrigin,
  getAdminSessionHours,
  isAdminEnabled,
} from "../../src/lib/admin/database-config.ts";
import {
  verifyAdminPassword,
} from "../../src/lib/admin/password.ts";
import {
  createAdminSessionToken,
  hashAdminSessionToken,
} from "../../src/lib/admin/session-token.ts";
import {
  adminUsernameSchema,
  normalizeAdminUsername,
} from "../../src/lib/admin/validation.ts";
import {
  readAdminPassword,
} from "./interactive-password.ts";

type OwnerRow = {
  id: string;
  username: string;
  username_key: string;
  role: string;
  password_hash: string;
  active: boolean;
  failed_login_count: number;
  locked_until: Date | null;
};

async function readUsername() {
  if (!process.stdin.isTTY) {
    throw new Error(
      "El diagnóstico necesita una terminal interactiva."
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (
      await prompt.question(
        "Nombre de acceso que estás usando: "
      )
    ).trim();
  } finally {
    prompt.close();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "error desconocido";
}

async function main() {
  console.log(
    "Diagnóstico de acceso administrativo (no cambia tu contraseña ni deja una sesión abierta)."
  );

  if (!isAdminEnabled()) {
    throw new Error(
      "DEUNA_ADMIN_ENABLED no está en true dentro de .env.local."
    );
  }

  const adminOrigin = getAdminOrigin();
  console.log(
    `[OK] Panel habilitado. Origen esperado: ${adminOrigin}`
  );

  const username = await readUsername();
  const parsedUsername =
    adminUsernameSchema.safeParse(username);

  if (!parsedUsername.success) {
    throw new Error(
      "El nombre de acceso no cumple el formato permitido."
    );
  }

  let password = await readAdminPassword(
    "Contraseña a comprobar: "
  );

  const pool = new Pool(
    getAdminDatabaseConfig("runtime")
  );
  const client = await pool.connect();

  try {
    console.log(
      "[OK] El rol runtime pudo conectarse a PostgreSQL."
    );

    const ownerResult = await client.query<OwnerRow>(
      `SELECT
         id,
         username,
         username_key,
         role,
         password_hash,
         active,
         failed_login_count,
         locked_until
       FROM deuna_admin.admin_users
       WHERE username_key = $1
       LIMIT 1`,
      [normalizeAdminUsername(parsedUsername.data)]
    );
    const owner = ownerResult.rows[0];

    if (!owner) {
      password = "";

      const activeOwner = await client.query<{
        username: string;
      }>(
        `SELECT username
         FROM deuna_admin.admin_users
         WHERE active = true
           AND role = 'owner'
         LIMIT 1`
      );

      const actual = activeOwner.rows[0]?.username;

      throw new Error(
        actual
          ? `Ese usuario no existe. La cuenta propietaria activa se llama "${actual}".`
          : "No existe una cuenta propietaria activa."
      );
    }

    console.log(
      `[OK] Usuario encontrado: ${owner.username}.`
    );

    if (
      !owner.active ||
      owner.role !== "owner"
    ) {
      password = "";
      throw new Error(
        "La cuenta existe, pero no está activa como propietaria."
      );
    }

    if (!owner.password_hash.startsWith("scrypt-v1$")) {
      password = "";
      throw new Error(
        "El hash guardado tiene un formato inesperado."
      );
    }

    const passwordMatches =
      await verifyAdminPassword(
        password,
        owner.password_hash
      );
    password = "";

    if (!passwordMatches) {
      throw new Error(
        "La contraseña escrita NO coincide con el hash guardado. El diagnóstico no sumó un intento fallido."
      );
    }

    console.log(
      "[OK] La contraseña coincide exactamente con el hash guardado."
    );

    const lockedUntil = owner.locked_until;
    const currentlyLocked = Boolean(
      lockedUntil &&
        lockedUntil.getTime() > Date.now()
    );

    if (currentlyLocked) {
      throw new Error(
        `La contraseña es correcta, pero la cuenta sigue bloqueada hasta ${lockedUntil!.toISOString()}.`
      );
    }

    console.log(
      "[OK] La cuenta no está bloqueada."
    );

    await client.query("BEGIN");

    try {
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
          owner.id,
          hashAdminSessionToken(token),
          expiresAt,
        ]
      );

      await client.query(
        `INSERT INTO deuna_admin.admin_events
           (user_id, event_type)
         VALUES ($1, 'login_succeeded')`,
        [owner.id]
      );

      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(
        `La contraseña es correcta, pero el rol runtime no puede completar el flujo de login: ${errorMessage(error)}`
      );
    }

    console.log(
      "[OK] El rol runtime puede actualizar la cuenta, gestionar sesiones e insertar el evento de login. Todo se revirtió."
    );
    console.log(
      `[OK] La capa de base de datos y contraseña funciona. Abre el panel exactamente en ${adminOrigin}/admin/login.`
    );
    console.log(
      "Si el navegador todavía rechaza el acceso, el problema queda aislado en el POST/origen/cookie del navegador y no en la contraseña ni en PostgreSQL."
    );
  } finally {
    password = "";
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`[ERROR] ${errorMessage(error)}`);
  process.exitCode = 1;
});
