import "server-only";

import {
  withAccountTransaction,
} from "./database";

type ExistingPreferenceRow = {
  library_state: "want_to_play" | "playing" | "completed" | null;
  follow_updates: boolean;
};

export async function setAccountGameFavorite(
  userId: string,
  gameSlug: string,
  favorite: boolean
) {
  await withAccountTransaction(async (client) => {
    const existing = await client.query<ExistingPreferenceRow>(
      `SELECT
         library_state,
         follow_updates
       FROM deuna_accounts.game_preferences
       WHERE user_id = $1
         AND game_slug = $2
       FOR UPDATE`,
      [userId, gameSlug]
    );
    const current = existing.rows[0];

    if (!current) {
      if (!favorite) return;

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
         VALUES ($1, $2, true, NULL, false, NULL, NULL, now())`,
        [userId, gameSlug]
      );
      return;
    }

    const meaningfulAfterChange =
      favorite ||
      current.library_state !== null ||
      current.follow_updates;

    if (!meaningfulAfterChange) {
      await client.query(
        `DELETE FROM deuna_accounts.game_preferences
         WHERE user_id = $1
           AND game_slug = $2`,
        [userId, gameSlug]
      );
      return;
    }

    await client.query(
      `UPDATE deuna_accounts.game_preferences
       SET favorite = $3,
           updated_at = now()
       WHERE user_id = $1
         AND game_slug = $2`,
      [userId, gameSlug, favorite]
    );
  });
}
