import { parseGameDate } from "@/lib/games/catalog";
import type { Game } from "@/types/game";

import {
  games,
  getGameBySlug,
} from "./games";

import {
  resolvedGameUpdates,
} from "./updates";

function getRequiredGame(
  slug: string
): Game {
  const game =
    getGameBySlug(slug);

  if (!game) {
    throw new Error(
      `No se encontró el juego "${slug}" en src/data/games.ts`
    );
  }

  return game;
}

function getGames(
  slugs: string[]
) {
  return slugs.map(
    getRequiredGame
  );
}

export const heroGames =
  getGames([
    "dragon-ball-sparking-zero",
    "god-of-war-ragnarok",
    "forza-horizon-5",
    "resident-evil-4",
  ]);

export const popularGames =
  getGames([
    "god-of-war-ragnarok",
    "elden-ring",
    "forza-horizon-5",
    "resident-evil-4",
    "hogwarts-legacy",
    "cyberpunk-2077",
    "baldurs-gate-3",
  ]);

export const recentGames = [
  ...games.filter((game) => Boolean(game.addedAt)),
].sort(
  (a, b) =>
    parseGameDate(b.addedAt) -
      parseGameDate(a.addedAt) ||
    a.title.localeCompare(b.title, "es")
);

export const lowSpecGames =
  getGames([
    "minecraft-java-edition",
    "left-4-dead-2",
    "gta-san-andreas",
    "terraria",
    "half-life-2",
    "portal-2",
    "stardew-valley",
  ]);

export const recommendedGames =
  getGames([
    "cyberpunk-2077",
    "baldurs-gate-3",
    "red-dead-redemption-2",
    "lies-of-p",
    "armored-core-vi",
    "god-of-war-ragnarok",
    "elden-ring",
  ]);

export const latestUpdates =
  resolvedGameUpdates.slice(
    0,
    3
  );

export { games };
