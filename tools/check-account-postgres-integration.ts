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
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : ""
  );
}

async function expectPrivilegeDenied(
  pool: Pool,
  label: string,
  query: string,
  values: unknown[] = []
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

async function insertPersonalization(
  pool: Pool,
  userId: string
) {
  await pool.query(
    `INSERT INTO deuna_accounts.game_preferences
       (
         user_id,
         game_slug,
         favorite,
         library_state,
         follow_updates,
         followed_at,
         updated_at
       )
     VALUES ($1, 'elden-ring', true, 'playing', true, now(), now())`,
    [userId]
  );

  await pool.query(
    `INSERT INTO deuna_accounts.hardware_profiles
       (user_id, cpu_id, gpu_id, ram_gb, memory_mode, updated_at)
     VALUES ($1, 'ryzen-5-5600x', 'rtx-3060', 16, 'dual', now())`,
    [userId]
  );
}

async function insertRewards(
  pool: Pool,
  userId: string,
  eventId: string
) {
  await pool.query(
    `INSERT INTO deuna_accounts.reward_profiles (user_id)
     VALUES ($1)`,
    [userId]
  );

  await pool.query(
    `UPDATE deuna_accounts.reward_profiles
        SET xp_total = 10,
            credits_balance = 5,
            streak_days = 1,
            best_streak = 1,
            last_claim_at = now(),
            updated_at = now()
      WHERE user_id = $1`,
    [userId]
  );

  await pool.query(
    `INSERT INTO deuna_accounts.reward_events
       (id, user_id, event_type, event_key, xp_delta, credits_delta, created_at)
     VALUES ($1, $2, 'daily_claim', 'ci:claim:1', 10, 5, now())`,
    [eventId, userId]
  );
}

async function main() {
  const pool = new Pool(
    getAdminDatabaseConfig("runtime")
  );
  const userId = randomUUID();
  const sessionId = randomUUID();
  const recoveryId = randomUUID();
  const recoveryCascadeId = randomUUID();
  const rewardEventId = randomUUID();
  const insightSlug = `ci-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
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
    const administrator = await pool.query<{ id: string }>(
      `SELECT id
         FROM deuna_admin.admin_users
        WHERE active = true
          AND role IN ('owner', 'admin')
        ORDER BY (role = 'owner') DESC, created_at
        LIMIT 1`
    );
    const administratorId = administrator.rows[0]?.id;

    if (!administratorId) {
      throw new Error("No existe una cuenta administrativa activa para probar la autoría del Índice DeUna.");
    }

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

    await insertPersonalization(pool, userId);
    await insertRewards(pool, userId, rewardEventId);

    await pool.query(
      `INSERT INTO deuna_accounts.game_ratings
         (user_id, game_slug, rating, updated_at)
       VALUES ($1, 'elden-ring', 4, now())`,
      [userId]
    );

    await pool.query(
      `UPDATE deuna_accounts.game_ratings
          SET rating = 5,
              updated_at = now()
        WHERE user_id = $1
          AND game_slug = 'elden-ring'`,
      [userId]
    );

    const rating = await pool.query<{ rating: number }>(
      `SELECT rating
         FROM deuna_accounts.game_ratings
        WHERE user_id = $1
          AND game_slug = 'elden-ring'`,
      [userId]
    );
    assert(
      rating.rows[0]?.rating === 5,
      "El rol runtime no pudo crear, actualizar y leer una valoración de juego."
    );

    await pool.query(
      `INSERT INTO deuna_admin.game_insight_scores
         (
           game_slug,
           score,
           confidence,
           evidence_count,
           breakdown,
           calculated_by,
           calculated_at
         )
       VALUES (
         $1,
         64.5,
         'medium',
         30,
         '{"interest":70,"engagement":60,"satisfaction":63}'::jsonb,
         $2,
         now()
       )`,
      [insightSlug, administratorId]
    );

    await pool.query(
      `UPDATE deuna_admin.game_insight_scores
          SET score = 68.5,
              evidence_count = 31,
              calculated_at = now()
        WHERE game_slug = $1`,
      [insightSlug]
    );

    const insight = await pool.query<{
      score: string;
      evidence_count: string;
    }>(
      `SELECT score::text, evidence_count::text
         FROM deuna_admin.game_insight_scores
        WHERE game_slug = $1`,
      [insightSlug]
    );
    assert(
      Number(insight.rows[0]?.score) === 68.5 &&
        Number(insight.rows[0]?.evidence_count) === 31,
      "El rol runtime no pudo crear, actualizar y leer un snapshot del Índice DeUna."
    );

    await pool.query(
      `UPDATE deuna_accounts.game_preferences
       SET updates_seen_through = now(),
           updated_at = now()
       WHERE user_id = $1
         AND game_slug = 'elden-ring'`,
      [userId]
    );

    await expectPrivilegeDenied(
      pool,
      "Cambio de identidad de una preferencia",
      `UPDATE deuna_accounts.game_preferences
       SET game_slug = 'portal-2'
       WHERE user_id = $1
         AND game_slug = 'elden-ring'`,
      [userId]
    );

    await expectPrivilegeDenied(
      pool,
      "Cambio de identidad de una valoración",
      `UPDATE deuna_accounts.game_ratings
       SET game_slug = 'portal-2'
       WHERE user_id = $1
         AND game_slug = 'elden-ring'`,
      [userId]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado directo de una valoración",
      `DELETE FROM deuna_accounts.game_ratings
       WHERE user_id = $1
         AND game_slug = 'elden-ring'`,
      [userId]
    );

    await expectPrivilegeDenied(
      pool,
      "Cambio de identidad de un Índice DeUna",
      `UPDATE deuna_admin.game_insight_scores
       SET game_slug = 'ci-forbidden-insight'
       WHERE game_slug = $1`,
      [insightSlug]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado directo de un Índice DeUna",
      `DELETE FROM deuna_admin.game_insight_scores
       WHERE game_slug = $1`,
      [insightSlug]
    );

    await expectPrivilegeDenied(
      pool,
      "Reescritura del ledger de Rewards",
      `UPDATE deuna_accounts.reward_events
       SET credits_delta = 500
       WHERE id = $1`,
      [rewardEventId]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado del ledger de Rewards",
      `DELETE FROM deuna_accounts.reward_events
       WHERE id = $1`,
      [rewardEventId]
    );

    await expectPrivilegeDenied(
      pool,
      "Borrado directo del perfil de Rewards",
      `DELETE FROM deuna_accounts.reward_profiles
       WHERE user_id = $1`,
      [userId]
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

    const removedHardware = await pool.query(
      `DELETE FROM deuna_accounts.hardware_profiles
       WHERE user_id = $1`,
      [userId]
    );
    const removedPreference = await pool.query(
      `DELETE FROM deuna_accounts.game_preferences
       WHERE user_id = $1
         AND game_slug = 'elden-ring'`,
      [userId]
    );

    assert(
      removedHardware.rowCount === 1 && removedPreference.rowCount === 1,
      "El rol runtime no pudo retirar datos de personalización elegidos por el usuario."
    );

    await insertPersonalization(pool, userId);

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
      game_preferences: number;
      game_ratings: number;
      hardware_profiles: number;
      reward_profiles: number;
      reward_events: number;
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
           WHERE user_id = $1) AS recovery_codes,
         (SELECT count(*)::integer
            FROM deuna_accounts.game_preferences
           WHERE user_id = $1) AS game_preferences,
         (SELECT count(*)::integer
            FROM deuna_accounts.game_ratings
           WHERE user_id = $1) AS game_ratings,
         (SELECT count(*)::integer
            FROM deuna_accounts.hardware_profiles
           WHERE user_id = $1) AS hardware_profiles,
         (SELECT count(*)::integer
            FROM deuna_accounts.reward_profiles
           WHERE user_id = $1) AS reward_profiles,
         (SELECT count(*)::integer
            FROM deuna_accounts.reward_events
           WHERE user_id = $1) AS reward_events`,
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
    assert(
      counts?.game_preferences === 0,
      "Mis juegos no fue eliminado por cascada."
    );
    assert(
      counts?.game_ratings === 0,
      "Las valoraciones no fueron eliminadas por cascada junto con la cuenta."
    );
    assert(
      counts?.hardware_profiles === 0,
      "Mi PC no fue eliminada por cascada."
    );
    assert(
      counts?.reward_profiles === 0 && counts?.reward_events === 0,
      "Rewards no fue eliminado por cascada junto con la cuenta."
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
    "PostgreSQL de cuentas: OK (permisos runtime reales, valoraciones e Índice DeUna, personalización y Rewards explícitos, denegaciones sensibles, rotación y borrado por cascada verificados)."
  );
}

main().catch((error: unknown) => {
  const code = postgresCode(error);
  const constraint = typeof error === "object" && error !== null && "constraint" in error
    ? String(error.constraint ?? "")
    : "";

  console.error(
    code
      ? `PostgreSQL de cuentas: ERROR (${code}${constraint ? ` · ${constraint}` : ""}).`
      : "PostgreSQL de cuentas: ERROR de conexión o ejecución."
  );
  if (!code && error instanceof Error) {
    console.error(error.message.slice(0, 240));
  }
  process.exitCode = 1;
});
