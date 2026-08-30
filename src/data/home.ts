import {
  parseGameDate,
} from "@/lib/games/catalog";
import {
  rankHomeGames,
} from "@/lib/home/ranking";
import type { Game } from "@/types/game";

import { games } from "./games";
import {
  resolveHomeConfig,
  sourceHomeConfig,
  type HomeConfig,
  type HomeCurationCollectionId,
  type HomeCurationMode,
} from "./home-config";
import {
  resolvedGameUpdates,
} from "./updates";

function pickConfiguredGames(
  catalog: Game[],
  slugs: readonly string[],
  limit: number
) {
  const bySlug = new Map(
    catalog.map((game) => [game.slug, game])
  );
  const selected: Game[] = [];
  const selectedSlugs = new Set<string>();

  for (const slug of slugs) {
    const game = bySlug.get(slug);

    if (!game || selectedSlugs.has(game.slug)) {
      continue;
    }

    selected.push(game);
    selectedSlugs.add(game.slug);

    if (selected.length === limit) {
      break;
    }
  }

  return selected;
}

function selectCuratedGames(
  catalog: Game[],
  slugs: readonly string[],
  target: HomeCurationCollectionId,
  mode: HomeCurationMode,
  limit: number
) {
  const configured = pickConfiguredGames(
    catalog,
    slugs,
    limit
  );

  if (mode === "manual") {
    return configured;
  }

  const ranked = rankHomeGames(
    catalog,
    target
  ).map((entry) => entry.game);

  if (mode === "automatic") {
    return ranked.slice(0, limit);
  }

  const selected = [...configured];
  const selectedSlugs = new Set(
    selected.map((game) => game.slug)
  );

  for (const game of ranked) {
    if (selectedSlugs.has(game.slug)) {
      continue;
    }

    selected.push(game);
    selectedSlugs.add(game.slug);

    if (selected.length === limit) {
      break;
    }
  }

  return selected;
}

export function buildHomeGameCollections(
  catalog: Game[],
  config: HomeConfig = sourceHomeConfig
) {
  const resolved = resolveHomeConfig(config);

  return {
    heroGames: selectCuratedGames(
      catalog,
      resolved.heroSlugs,
      "hero",
      resolved.curation.hero.mode,
      4
    ),
    popularGames: selectCuratedGames(
      catalog,
      resolved.popularSlugs,
      "popular",
      resolved.curation.popular.mode,
      7
    ),
    recentGames: [
      ...catalog.filter((game) => Boolean(game.addedAt)),
    ].sort(
      (a, b) =>
        parseGameDate(b.addedAt) -
          parseGameDate(a.addedAt) ||
        a.title.localeCompare(b.title, "es")
    ),
    lowSpecGames: selectCuratedGames(
      catalog,
      resolved.lowSpecSlugs,
      "lowSpec",
      resolved.curation.lowSpec.mode,
      7
    ),
    recommendedGames: selectCuratedGames(
      catalog,
      resolved.recommendedSlugs,
      "recommended",
      resolved.curation.recommended.mode,
      7
    ),
  };
}

const sourceCollections =
  buildHomeGameCollections(games);

/*
 * Exportaciones estáticas conservadas durante la migración.
 * La Home pública usa buildHomeGameCollections con el catálogo publicado.
 */
export const heroGames = sourceCollections.heroGames;
export const popularGames = sourceCollections.popularGames;
export const recentGames = sourceCollections.recentGames;
export const lowSpecGames = sourceCollections.lowSpecGames;
export const recommendedGames =
  sourceCollections.recommendedGames;

export const latestUpdates =
  resolvedGameUpdates.slice(
    0,
    3
  );

export { games };
