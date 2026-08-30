import { parseGameDate } from "@/lib/games/catalog";
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

function getRequiredGame(
  catalog: Game[],
  slug: string
): Game {
  const game = catalog.find(
    (candidate) => candidate.slug === slug
  );

  if (!game) {
    throw new Error(
      `No se encontró el juego editorial requerido "${slug}".`
    );
  }

  return game;
}

function getGames(
  catalog: Game[],
  slugs: string[]
) {
  return slugs.map((slug) =>
    getRequiredGame(catalog, slug)
  );
}

export function buildHomeGameCollections(
  catalog: Game[]
) {
  return {
    heroGames: getGames(catalog, heroSlugs),
    popularGames: getGames(catalog, popularSlugs),
    recentGames: [
      ...catalog.filter((game) => Boolean(game.addedAt)),
    ].sort(
      (a, b) =>
        parseGameDate(b.addedAt) -
          parseGameDate(a.addedAt) ||
        a.title.localeCompare(b.title, "es")
    ),
    lowSpecGames: getGames(catalog, lowSpecSlugs),
    recommendedGames: getGames(
      catalog,
      recommendedSlugs
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
