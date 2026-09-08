import "server-only";

import {
  withAccountTransaction,
} from "./database";

type UpdatedPreferenceRow = {
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

    const updated = await client.query<UpdatedPreferenceRow>(
      `UPDATE deuna_accounts.game_preferences
       SET favorite = false,
           updated_at = now()
       WHERE user_id = $1
         AND game_slug = $2
       RETURNING
         library_state,
         follow_updates`,
      [userId, gameSlug]
    );
    const current = updated.rows[0];

    if (
      !current ||
      current.library_state !== null ||
      current.follow_updates
    ) {
      return;
    }

    // Sólo retiramos la fila si el favorito era su última señal útil. La
    // condición se repite en SQL para que un cambio futuro del contrato no
    // pueda borrar biblioteca o seguimiento por accidente.
    await client.query(
      `DELETE FROM deuna_accounts.game_preferences
       WHERE user_id = $1
         AND game_slug = $2
         AND favorite = false
         AND library_state IS NULL
         AND follow_updates = false`,
      [userId, gameSlug]
    );
  });
}
