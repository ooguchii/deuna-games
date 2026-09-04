import {
  parseGameDate,
} from "@/lib/games/catalog";
import type {
  AccountGamePreference,
} from "@/lib/accounts/personalization-types";
import type {
  HardwareProfile,
} from "@/features/game-finder/types";
import {
  hasRecommendationSignals,
  rankGamesForSavedHardware,
  rankPersonalizedRecommendations,
} from "@/lib/home/account-personalization";
import {
  HOME_HERO_MAX_SLIDES,
} from "@/lib/home/hero-contract";
import {
  resolveHomeCollectionGames,
} from "@/lib/home/ranking";
import type { Game } from "@/types/game";

import {
  resolveHomeConfig,
  sourceHomeConfig,
  type HomeConfig,
} from "./home-config";

export type HomeAccountPersonalization = {
  preferences: AccountGamePreference[];
  hardware: HardwareProfile | null;
};

function fillUniqueGames(
  preferred: readonly Game[],
  fallback: readonly Game[],
  limit: number
) {
  const selected: Game[] = [];
  const seen = new Set<string>();

  for (const game of [...preferred, ...fallback]) {
    if (seen.has(game.slug)) continue;

    selected.push(game);
    seen.add(game.slug);

    if (selected.length === limit) break;
  }

  return selected;
}

export function buildHomeGameCollections(
  catalog: Game[],
  config: HomeConfig = sourceHomeConfig,
  personalization?: HomeAccountPersonalization
) {
  const resolved = resolveHomeConfig(config);
  const genericLowSpec = resolveHomeCollectionGames(
    catalog,
    "lowSpec",
    resolved.curation.lowSpec.mode,
    resolved.lowSpecSlugs,
    7
  );
  const genericRecommended = resolveHomeCollectionGames(
    catalog,
    "recommended",
    resolved.curation.recommended.mode,
    resolved.recommendedSlugs,
    7
  );
  const personalizedRecommendations =
    personalization &&
    hasRecommendationSignals(
      personalization.preferences,
      personalization.hardware
    )
      ? rankPersonalizedRecommendations(
          catalog,
          personalization.preferences,
          personalization.hardware
        )
      : [];
  const personalizedPc = personalization?.hardware
    ? rankGamesForSavedHardware(
        catalog,
        personalization.hardware
      )
    : [];
  const recommendationReasons = Object.fromEntries(
    personalizedRecommendations.map((entry) => [
      entry.game.slug,
      entry.reasons,
    ])
  );
  const pcReasons = Object.fromEntries(
    personalizedPc.map((entry) => [
      entry.game.slug,
      entry.reasons,
    ])
  );

  return {
    heroGames: resolveHomeCollectionGames(
      catalog,
      "hero",
      resolved.curation.hero.mode,
      resolved.heroSlugs,
      HOME_HERO_MAX_SLIDES
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
    lowSpecGames: fillUniqueGames(
      personalizedPc.map((entry) => entry.game),
      genericLowSpec,
      7
    ),
    recommendedGames: fillUniqueGames(
      personalizedRecommendations.map((entry) => entry.game),
      genericRecommended,
      7
    ),
    recommendedPersonalized:
      personalizedRecommendations.length > 0,
    pcPersonalized: personalizedPc.length > 0,
    recommendationReasons,
    pcReasons,
  };
}
