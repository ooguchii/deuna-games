import "server-only";

import { cache } from "react";

import {
  games as sourceGames,
} from "@/data/games";
import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";
import type { Game } from "@/types/game";

type PublicationTableRow = {
  publication_table: string | null;
};

type PublishedGameRow = {
  item_key: string;
  published_payload: unknown;
};

function sourceFallback() {
  return sourceGames.map((game) => ({
    ...game,
  }));
}

function mergePublishedGames(
  publishedGames: Game[]
) {
  const publishedBySlug = new Map(
    publishedGames.map((game) => [game.slug, game])
  );
  const sourceSlugs = new Set(
    sourceGames.map((game) => game.slug)
  );
  const merged = sourceGames.map(
    (game) => publishedBySlug.get(game.slug) ?? game
  );
  const additional = publishedGames
    .filter((game) => !sourceSlugs.has(game.slug))
    .sort((a, b) =>
      a.title.localeCompare(b.title, "es")
    );

  return [...merged, ...additional];
}

async function readPublishedGames() {
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

  const result = await adminQuery<PublishedGameRow>(
    `SELECT
       item_key,
       published_payload
     FROM deuna_admin.editorial_items
     WHERE item_type = 'game'
     ORDER BY lower(
       COALESCE(
         published_payload ->> 'title',
         item_key
       )
     ) ASC`
  );
  const games: Game[] = [];

  for (const row of result.rows) {
    try {
      const game = parseEditorialPayload(
        "game",
        row.published_payload
      );

      if (game.slug !== row.item_key) {
        continue;
      }

      games.push(game);
    } catch {
      // Un snapshot inválido nunca reemplaza el catálogo fuente.
    }
  }

  return games;
}

export const getPublicGames = cache(
  async (): Promise<Game[]> => {
    try {
      const published = await readPublishedGames();

      if (!published || published.length === 0) {
        return sourceFallback();
      }

      return mergePublishedGames(published);
    } catch {
      /*
       * El catálogo fuente sigue siendo un fallback deliberado:
       * una caída o una migración todavía no aplicada no debe dejar
       * la web pública sin juegos.
       */
      return sourceFallback();
    }
  }
);

export async function getPublicGameBySlug(
  slug: string
) {
  const games = await getPublicGames();
  return games.find((game) => game.slug === slug);
}
