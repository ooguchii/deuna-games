import {
  parseGameDate,
  reviewScore,
} from "@/lib/games/catalog";
import type { Game } from "@/types/game";

import { games } from "./games";
import {
  resolvedGameUpdates,
} from "./updates";

const heroSlugs = [
  "dragon-ball-sparking-zero",
  "god-of-war-ragnarok",
  "forza-horizon-5",
  "resident-evil-4",
];

const popularSlugs = [
  "god-of-war-ragnarok",
  "elden-ring",
  "forza-horizon-5",
  "resident-evil-4",
  "hogwarts-legacy",
  "cyberpunk-2077",
  "baldurs-gate-3",
];

const lowSpecSlugs = [
  "minecraft-java-edition",
  "left-4-dead-2",
  "gta-san-andreas",
  "terraria",
  "half-life-2",
  "portal-2",
  "stardew-valley",
];

const recommendedSlugs = [
  "cyberpunk-2077",
  "baldurs-gate-3",
  "red-dead-redemption-2",
  "lies-of-p",
  "armored-core-vi",
  "god-of-war-ragnarok",
  "elden-ring",
];

function rankGames(catalog: Game[]) {
  return [...catalog].sort(
    (a, b) =>
      reviewScore(b.reviews) -
        reviewScore(a.reviews) ||
      (b.rating ?? 0) -
        (a.rating ?? 0) ||
      a.title.localeCompare(b.title, "es")
  );
}

function pickPreferredGames(
  catalog: Game[],
  slugs: readonly string[],
  limit: number,
  fill: boolean
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
      return selected;
    }
  }

  if (!fill) {
    return selected;
  }

  for (const game of rankGames(catalog)) {
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
  catalog: Game[]
) {
  return {
    heroGames: pickPreferredGames(
      catalog,
      heroSlugs,
      4,
      true
    ),
    popularGames: pickPreferredGames(
      catalog,
      popularSlugs,
      7,
      true
    ),
    recentGames: [
      ...catalog.filter((game) => Boolean(game.addedAt)),
    ].sort(
      (a, b) =>
        parseGameDate(b.addedAt) -
          parseGameDate(a.addedAt) ||
        a.title.localeCompare(b.title, "es")
    ),
    lowSpecGames: pickPreferredGames(
      catalog,
      lowSpecSlugs,
      7,
      false
    ),
    recommendedGames: pickPreferredGames(
      catalog,
      recommendedSlugs,
      7,
      true
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
