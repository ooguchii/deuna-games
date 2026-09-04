import "server-only";

import {
  accountQuery,
} from "./database";

export type AccountGameRating = {
  gameSlug: string;
  rating: number;
  updatedAt: Date;
};

type GameRatingRow = {
  game_slug: string;
  rating: number;
  updated_at: Date;
};

export async function getAccountGameRating(
  userId: string,
  gameSlug: string
): Promise<AccountGameRating | null> {
  const result = await accountQuery<GameRatingRow>(
    `SELECT
       game_slug,
       rating,
       updated_at
     FROM deuna_accounts.game_ratings
     WHERE user_id = $1
       AND game_slug = $2
     LIMIT 1`,
    [userId, gameSlug]
  );
  const row = result.rows[0];

  return row
    ? {
        gameSlug: row.game_slug,
        rating: row.rating,
        updatedAt: row.updated_at,
      }
    : null;
}

export async function saveAccountGameRating(
  userId: string,
  gameSlug: string,
  rating: number
) {
  await accountQuery(
    `INSERT INTO deuna_accounts.game_ratings (
       user_id,
       game_slug,
       rating,
       updated_at
     )
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, game_slug)
     DO UPDATE SET
       rating = EXCLUDED.rating,
       updated_at = now()`,
    [userId, gameSlug, rating]
  );
}
