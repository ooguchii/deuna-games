import "server-only";

import {
  connection,
} from "next/server";
import { cache } from "react";

import {
  gameUpdates as sourceUpdates,
} from "@/data/update-records";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";
import {
  resolveGameDownload,
} from "@/lib/games/download";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import type { Game } from "@/types/game";
import type {
  GameUpdate,
  ResolvedGameUpdate,
} from "@/types/update";

type PublicationTableRow = {
  publication_table: string | null;
};

type PublishedUpdateRow = {
  item_key: string;
  published_payload: unknown;
};

function mergePublishedUpdates(
  publishedUpdates: GameUpdate[]
) {
  const publishedById = new Map(
    publishedUpdates.map((update) => [update.id, update])
  );
  const sourceIds = new Set(
    sourceUpdates.map((update) => update.id)
  );
  const merged = sourceUpdates.map(
    (update) => publishedById.get(update.id) ?? update
  );
  const additional = publishedUpdates.filter(
    (update) => !sourceIds.has(update.id)
  );

  return [...merged, ...additional];
}

function resolveUpdates(
  updates: readonly GameUpdate[],
  games: readonly Game[]
) {
  const gamesBySlug = new Map(
    games.map((game) => [game.slug, game])
  );
  const resolved: ResolvedGameUpdate[] = [];

  for (const update of updates) {
    const game = gamesBySlug.get(update.gameSlug);

    if (!game) continue;

    resolved.push({
      ...update,
      game,
      downloadable:
        resolveGameDownload(game) !== null,
    });
  }

  return resolved.sort(
    (a, b) =>
      Date.parse(b.publishedAt) -
      Date.parse(a.publishedAt)
  );
}

async function readPublishedUpdates() {
  const workspace =
    await adminQuery<PublicationTableRow>(
      `SELECT
         to_regclass(
           'deuna_admin.editorial_publications'
         )::text AS publication_table`
    );

  if (!workspace.rows[0]?.publication_table) {
    return null;
  }

  const result = await adminQuery<PublishedUpdateRow>(
    `SELECT
       item_key,
       published_payload
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game_update'
     ORDER BY item_key ASC`
  );
  const updates: GameUpdate[] = [];

  for (const row of result.rows) {
    try {
      const update = parseEditorialPayload(
        "game_update",
        row.published_payload
      );

      if (update.id !== row.item_key) {
        continue;
      }

      updates.push(update);
    } catch {
      // Un snapshot inválido no reemplaza la actualización fuente.
    }
  }

  return updates;
}

export const getPublicResolvedUpdates = cache(
  async (): Promise<ResolvedGameUpdate[]> => {
    await connection();
    const games = await getPublicGames();

    try {
      const published = await readPublishedUpdates();

      if (!published || published.length === 0) {
        return resolveUpdates(sourceUpdates, games);
      }

      return resolveUpdates(
        mergePublishedUpdates(published),
        games
      );
    } catch {
      return resolveUpdates(sourceUpdates, games);
    }
  }
);

export async function getPublicUpdatesForGame(
  slug: string
) {
  const updates = await getPublicResolvedUpdates();
  return updates.filter(
    (update) => update.game.slug === slug
  );
}
