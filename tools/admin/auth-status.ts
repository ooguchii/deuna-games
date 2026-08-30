import process from "node:process";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../../src/lib/admin/database-config.ts";

type OwnerRow = {
  id: string;
  username: string;
  failed_login_count: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  password_changed_at: Date;
};

type EventRow = {
  event_type: string;
  occurred_at: Date;
};

type SessionCountRow = {
  active_sessions: string;
};

function formatDate(value: Date | null) {
  return value ? value.toISOString() : "nunca";
}

async function main() {
  const pool = new Pool(
    getAdminDatabaseConfig("runtime")
  );

  try {
    const ownerResult = await pool.query<OwnerRow>(
      `SELECT
         id,
         username,
         failed_login_count,
         locked_until,
         last_login_at,
         password_changed_at
       FROM deuna_admin.admin_users
       WHERE active = true
         AND role = 'owner'
       ORDER BY created_at
       LIMIT 2`
    );

    if (ownerResult.rowCount !== 1) {
      throw new Error(
        "Debe existir exactamente una cuenta propietaria activa."
      );
    }

    const owner = ownerResult.rows[0]!;

    const [eventsResult, sessionsResult] =
      await Promise.all([
        pool.query<EventRow>(
          `SELECT event_type, occurred_at
           FROM deuna_admin.admin_events
           WHERE user_id = $1
           ORDER BY occurred_at DESC, id DESC
           LIMIT 12`,
          [owner.id]
        ),
        pool.query<SessionCountRow>(
          `SELECT count(*)::text AS active_sessions
           FROM deuna_admin.admin_sessions
           WHERE user_id = $1
             AND revoked_at IS NULL
             AND expires_at > now()`,
          [owner.id]
        ),
      ]);

    console.log("Estado de autenticación administrativa (solo lectura):");
    console.log(`[OK] Usuario activo: ${owner.username}`);
    console.log(
      `[INFO] Intentos fallidos acumulados: ${owner.failed_login_count}`
    );
    console.log(
      `[INFO] Bloqueada hasta: ${formatDate(owner.locked_until)}`
    );
    console.log(
      `[INFO] Último login correcto: ${formatDate(owner.last_login_at)}`
    );
    console.log(
      `[INFO] Contraseña cambiada: ${formatDate(owner.password_changed_at)}`
    );
    console.log(
      `[INFO] Sesiones activas en PostgreSQL: ${sessionsResult.rows[0]?.active_sessions ?? "0"}`
    );
    console.log("[INFO] Últimos eventos:");

    if (eventsResult.rows.length === 0) {
      console.log("  (sin eventos)");
    } else {
      for (const event of eventsResult.rows) {
        console.log(
          `  ${event.occurred_at.toISOString()}  ${event.event_type}`
        );
      }
    }

    console.log("");
    console.log("Interpretación rápida:");
    console.log("- login_failed: el navegador llegó a autenticación pero envió credenciales que no coincidieron.");
    console.log("- login_blocked: la cuenta estaba temporalmente bloqueada.");
    console.log("- login_succeeded: la contraseña fue aceptada y se creó una sesión; si vuelve al login, el problema es cookie/sesión del navegador.");
    console.log("- ningún evento nuevo: la solicitud fue rechazada antes de autenticarse (origen/formulario). ");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo leer el estado de autenticación.";

  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
});
