import {
  estimateGamePerformance,
} from "@/features/game-finder/performance-model";
import type {
  GameEstimate,
  HardwareProfile,
} from "@/features/game-finder/types";
import type {
  AccountGamePreference,
} from "@/lib/accounts/personalization-types";
import {
  scoreHomeGame,
} from "@/lib/home/ranking";
import type { Game } from "@/types/game";

export type PersonalizedGameRanking = {
  game: Game;
  score: number;
  reasons: string[];
  estimate: GameEstimate | null;
};

const preferenceStateWeight = {
  want_to_play: 2,
  playing: 2.6,
  completed: 1.5,
} as const;

function normalizedTerm(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("es");
}

function gameTerms(game: Game) {
  const entries = [
    ["category", game.category],
    ...(game.genres ?? []).map((value) => ["genre", value]),
    ...(game.tags ?? []).map((value) => ["tag", value]),
  ] as Array<[string, string]>;

  return [
    ...new Set(
      entries
        .map(([kind, value]) => `${kind}:${normalizedTerm(value)}`)
        .filter((value) => !value.endsWith(":"))
    ),
  ];
}

function preferenceStrength(preference: AccountGamePreference) {
  const favorite = preference.favorite ? 3 : 0;
  const library = preference.libraryState
    ? preferenceStateWeight[preference.libraryState]
    : 0;

  return favorite + library;
}

function buildAffinityWeights(
  catalog: readonly Game[],
  preferences: readonly AccountGamePreference[]
) {
  const games = new Map(
    catalog.map((game) => [game.slug, game])
  );
  const weights = new Map<string, number>();

  for (const preference of preferences) {
    const strength = preferenceStrength(preference);
    const game = games.get(preference.gameSlug);

    if (!game || strength <= 0) continue;

    for (const term of gameTerms(game)) {
      weights.set(term, (weights.get(term) ?? 0) + strength);
    }
  }

  return weights;
}

function rawAffinity(
  game: Game,
  weights: ReadonlyMap<string, number>
) {
  return gameTerms(game).reduce(
    (total, term) => total + (weights.get(term) ?? 0),
    0
  );
}

function displayTerm(term: string) {
  const separator = term.indexOf(":");
  return separator >= 0
    ? term.slice(separator + 1)
    : term;
}

function affinityReason(
  game: Game,
  weights: ReadonlyMap<string, number>
) {
  const strongest = gameTerms(game)
    .map((term) => ({
      term,
      weight: weights.get(term) ?? 0,
    }))
    .filter((entry) => entry.weight > 0)
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.term.localeCompare(b.term, "es")
    )[0];

  return strongest
    ? `Coincide con tus gustos: ${displayTerm(strongest.term)}`
    : null;
}

function estimateForGame(
  game: Game,
  hardware: HardwareProfile | null
) {
  if (!hardware) return null;

  return estimateGamePerformance(
    game.slug,
    hardware,
    {
      resolution: "1080p",
      quality: "medium",
    },
    game.performance
  );
}

function hardwareSignal(estimate: GameEstimate | null) {
  if (!estimate?.canEstimate) return 0;

  switch (estimate.tier) {
    case "excellent":
      return 1;
    case "good":
      return 0.82;
    case "acceptable":
      return 0.48;
    case "basic":
      return 0.12;
  }
}

function hardwareReason(estimate: GameEstimate | null) {
  if (!estimate?.canEstimate) return null;

  return `Tu PC: ${estimate.minFps}–${estimate.maxFps} FPS estimados en 1080p medio`;
}

function selectedGameSlugs(
  preferences: readonly AccountGamePreference[]
) {
  return new Set(
    preferences
      .filter(
        (preference) =>
          preference.favorite ||
          preference.libraryState !== null
      )
      .map((preference) => preference.gameSlug)
  );
}

export function hasRecommendationSignals(
  preferences: readonly AccountGamePreference[],
  hardware: HardwareProfile | null
) {
  return Boolean(
    hardware ||
    preferences.some(
      (preference) => preferenceStrength(preference) > 0
    )
  );
}

export function rankPersonalizedRecommendations(
  catalog: readonly Game[],
  preferences: readonly AccountGamePreference[],
  hardware: HardwareProfile | null,
  now = Date.now()
): PersonalizedGameRanking[] {
  const affinityWeights = buildAffinityWeights(
    catalog,
    preferences
  );
  const selected = selectedGameSlugs(preferences);
  const candidates = catalog.filter(
    (game) => !selected.has(game.slug)
  );
  const rawAffinities = new Map(
    candidates.map((game) => [
      game.slug,
      rawAffinity(game, affinityWeights),
    ])
  );
  const maxAffinity = Math.max(
    0,
    ...rawAffinities.values()
  );

  return candidates
    .map((game): PersonalizedGameRanking => {
      const base = scoreHomeGame(
        game,
        "recommended",
        now
      );
      const affinity = maxAffinity > 0
        ? (rawAffinities.get(game.slug) ?? 0) / maxAffinity
        : 0;
      const estimate = estimateForGame(game, hardware);
      const pcFit = hardwareSignal(estimate);
      const score =
        base.score * 0.65 +
        affinity * 20 +
        pcFit * 15;
      const reasons = [
        affinityReason(game, affinityWeights),
        hardwareReason(estimate),
        base.components[0]?.detail ?? null,
      ].filter((reason): reason is string => Boolean(reason));

      return {
        game,
        score: Math.round(score * 10) / 10,
        reasons: reasons.slice(0, 3),
        estimate,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.game.title.localeCompare(b.game.title, "es")
    );
}

export function rankGamesForSavedHardware(
  catalog: readonly Game[],
  hardware: HardwareProfile,
  now = Date.now()
): PersonalizedGameRanking[] {
  return catalog
    .map((game): PersonalizedGameRanking => {
      const estimate = estimateForGame(game, hardware);
      const base = scoreHomeGame(game, "recommended", now);
      const pcFit = hardwareSignal(estimate);

      return {
        game,
        score: Math.round(
          (pcFit * 75 + base.score * 0.25) * 10
        ) / 10,
        reasons: [
          hardwareReason(estimate),
          base.components[0]?.detail ?? null,
        ].filter((reason): reason is string => Boolean(reason)),
        estimate,
      };
    })
    .filter((entry) => entry.estimate?.canEstimate)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.estimate?.minFps ?? 0) -
          (a.estimate?.minFps ?? 0) ||
        a.game.title.localeCompare(b.game.title, "es")
    );
}
