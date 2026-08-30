import {
  parseGameDate,
} from "@/lib/games/catalog";
import {
  resolveHomeCollectionGames,
} from "@/lib/home/ranking";
import type { Game } from "@/types/game";

import { games } from "./games";
import {
  resolveHomeConfig,
  sourceHomeConfig,
  type HomeConfig,
} from "./home-config";
import {
  resolvedGameUpdates,
} from "./updates";

export function buildHomeGameCollections(
  catalog: Game[],
  config: HomeConfig = sourceHomeConfig
) {
  const resolved = resolveHomeConfig(config);

  return {
    heroGames: resolveHomeCollectionGames(
      catalog,
      "hero",
      resolved.curation.hero.mode,
      resolved.heroSlugs,
      4
    ),
    popularGames: resolveHomeCollectionGames(
      catalog,
      "popular",
      resolved.curation.popular.mode,
      resolved.popularSlugs,
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
    lowSpecGames: resolveHomeCollectionGames(
      catalog,
      "lowSpec",
      resolved.curation.lowSpec.mode,
      resolved.lowSpecSlugs,
      7
    ),
    recommendedGames: resolveHomeCollectionGames(
      catalog,
      "recommended",
      resolved.curation.recommended.mode,
      resolved.recommendedSlugs,
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
