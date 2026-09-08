import "server-only";

import {
  withAccountTransaction,
} from "./database";

type ExistingPreferenceRow = {
  favorite: boolean;
  library_state: "want_to_play" | "playing" | "completed" | null;
  follow_updates: boolean;
};

export async function setAccountGameFavorite(
  userId: string,
  gameSlug: string,
  favorite: boolean
) {
  await withAccountTransaction(async (client) => {
    if (favorite) {
      await client.query(
        `INSERT INTO deuna_accounts.game_preferences
           (
             user_id,
             game_slug,
             favorite,
             library_state,
             follow_updates,
             followed_at,
             updates_seen_through,
             updated_at
           )
         VALUES ($1, $2, true, NULL, false, NULL, NULL, now())
         ON CONFLICT (user_id, game_slug)
         DO UPDATE SET
           favorite = true,
           updated_at = now()`,
        [userId, gameSlug]
      );
      return;
    }

    // Quitar favorito sólo opera sobre una fila existente. La bloqueamos antes
    // de decidir entre UPDATE y DELETE para no intentar crear el estado vacío
    // que PostgreSQL rechaza mediante game_preferences_meaningful_check.
    const existing = await client.query<ExistingPreferenceRow>(
      `SELECT
         favorite,
         library_state,
         follow_updates
       FROM deuna_accounts.game_preferences
       WHERE user_id = $1
         AND game_slug = $2
       FOR UPDATE`,
      [userId, gameSlug]
    );
    const current = existing.rows[0];

    if (!current) return;

    if (
      current.library_state === null &&
      !current.follow_updates
    ) {
      // Si favorite era la última señal útil, la representación válida es que
      // no exista fila. Repetimos la condición en SQL para blindar biblioteca
      // y seguimiento ante cambios futuros del servicio.
      await client.query(
        `DELETE FROM deuna_accounts.game_preferences
         WHERE user_id = $1
           AND game_slug = $2
           AND library_state IS NULL
           AND follow_updates = false`,
        [userId, gameSlug]
      );
      return;
    }

    if (!current.favorite) return;

    await client.query(
      `UPDATE deuna_accounts.game_preferences
       SET favorite = false,
           updated_at = now()
       WHERE user_id = $1
         AND game_slug = $2`,
      [userId, gameSlug]
    );
  });
}
