import {
  createHash,
  randomUUID,
} from "node:crypto";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../src/lib/admin/database-config.ts";
import {
  getAccountAvatar,
  saveAccountAvatar,
} from "../src/lib/accounts/avatar-service.ts";
import {
  setAccountGameFavorite,
} from "../src/lib/accounts/favorite-service.ts";

const failures: string[] = [];

function assert(condition: unknown, message: string) {
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

async function main() {
  const pool = new Pool(getAdminDatabaseConfig("runtime"));
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const username = `fav_avatar_${suffix}`;
  const otherUsername = `fav_avatar_other_${suffix}`;

  try {
    await pool.query(
      `INSERT INTO deuna_accounts.users
         (id, username, username_key, password_hash)
       VALUES
         ($1, $2, $2, 'ci-password-hash-placeholder'),
         ($3, $4, $4, 'ci-password-hash-placeholder')`,
      [userId, username, otherUserId, otherUsername]
    );

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
       VALUES ($1, 'elden-ring', false, 'playing', true, now(), now())`,
      [userId]
    );

    await Promise.all(
      Array.from({ length: 6 }, () =>
        setAccountGameFavorite(userId, "elden-ring", true)
      )
    );

    let preference = await pool.query<{
      favorite: boolean;
      library_state: string | null;
      follow_updates: boolean;
    }>(
      `SELECT favorite, library_state, follow_updates
         FROM deuna_accounts.game_preferences
        WHERE user_id = $1
          AND game_slug = 'elden-ring'`,
      [userId]
    );

    assert(
      preference.rows.length === 1 &&
        preference.rows[0]?.favorite === true &&
        preference.rows[0]?.library_state === "playing" &&
        preference.rows[0]?.follow_updates === true,
      "Activar favorito concurrentemente alteró biblioteca o seguimiento."
    );

    await Promise.all(
      Array.from({ length: 6 }, () =>
        setAccountGameFavorite(userId, "elden-ring", false)
      )
    );

    preference = await pool.query(
      `SELECT favorite, library_state, follow_updates
         FROM deuna_accounts.game_preferences
        WHERE user_id = $1
          AND game_slug = 'elden-ring'`,
      [userId]
    );

    assert(
      preference.rows.length === 1 &&
        preference.rows[0]?.favorite === false &&
        preference.rows[0]?.library_state === "playing" &&
        preference.rows[0]?.follow_updates === true,
      "Quitar favorito eliminó o reescribió señales de biblioteca/seguimiento."
    );

    await Promise.all(
      Array.from({ length: 8 }, () =>
        setAccountGameFavorite(userId, "portal-2", true)
      )
    );

    const firstFavorite = await pool.query<{
      count: number;
      favorite: boolean;
    }>(
      `SELECT count(*)::integer AS count,
              bool_and(favorite) AS favorite
         FROM deuna_accounts.game_preferences
        WHERE user_id = $1
          AND game_slug = 'portal-2'`,
      [userId]
    );

    assert(
      firstFavorite.rows[0]?.count === 1 &&
        firstFavorite.rows[0]?.favorite === true,
      "El primer favorito concurrente no fue idempotente."
    );

    await setAccountGameFavorite(userId, "portal-2", false);
    const removedFavorite = await pool.query<{ count: number }>(
      `SELECT count(*)::integer AS count
         FROM deuna_accounts.game_preferences
        WHERE user_id = $1
          AND game_slug = 'portal-2'`,
      [userId]
    );

    assert(
      removedFavorite.rows[0]?.count === 0,
      "Una preferencia cuyo único dato era favorite=false no se limpió."
    );

    const avatarBytes = Buffer.alloc(64, 0x5a);
    const avatarDigest = createHash("sha256")
      .update(avatarBytes)
      .digest("hex");

    await saveAccountAvatar(userId, {
      digest: avatarDigest,
      imageWebp: avatarBytes,
      width: 64,
      height: 64,
    });

    const avatar = await getAccountAvatar(userId);
    assert(
      avatar?.digest === avatarDigest &&
        avatar.imageWebp.equals(avatarBytes) &&
        avatar.width === 64 &&
        avatar.height === 64,
      "El rol runtime no pudo guardar y leer el avatar asociado a su usuario."
    );

    try {
      await pool.query(
        `UPDATE deuna_accounts.avatars
            SET user_id = $2
          WHERE user_id = $1`,
        [userId, otherUserId]
      );
      failures.push(
        "El rol runtime pudo reasignar un avatar a otra identidad."
      );
    } catch (error) {
      assert(
        postgresCode(error) === "42501",
        "La reasignación prohibida de avatar falló con un error inesperado."
      );
    }

    await pool.query(
      `DELETE FROM deuna_accounts.users
        WHERE id = $1`,
      [userId]
    );

    const remaining = await pool.query<{
      avatars: number;
      preferences: number;
    }>(
      `SELECT
         (SELECT count(*)::integer
            FROM deuna_accounts.avatars
           WHERE user_id = $1) AS avatars,
         (SELECT count(*)::integer
            FROM deuna_accounts.game_preferences
           WHERE user_id = $1) AS preferences`,
      [userId]
    );

    assert(
      remaining.rows[0]?.avatars === 0,
      "El avatar no fue eliminado por cascada junto con la cuenta."
    );
    assert(
      remaining.rows[0]?.preferences === 0,
      "Las preferencias de favoritos no fueron eliminadas por cascada."
    );
  } finally {
    await pool
      .query(
        `DELETE FROM deuna_accounts.users
          WHERE id = ANY($1::uuid[])`,
        [[userId, otherUserId]]
      )
      .catch(() => {});
    await pool.end();
  }

  if (failures.length > 0) {
    console.error("\nAvatar/favoritos PostgreSQL: ERROR\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "Avatar/favoritos PostgreSQL: OK (concurrencia idempotente, señales preservadas, avatar privado, identidad inmutable y cascade verificados)."
  );
}

main().catch((error: unknown) => {
  const code = postgresCode(error);
  console.error(
    code
      ? `Avatar/favoritos PostgreSQL: ERROR (${code}).`
      : "Avatar/favoritos PostgreSQL: ERROR de conexión o ejecución."
  );
  process.exitCode = 1;
});
