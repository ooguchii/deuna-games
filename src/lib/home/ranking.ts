import {
  parseGameDate,
  reviewScore,
} from "@/lib/games/catalog";
import type {
  HomeCurationCollectionId,
  HomeCurationMode,
} from "@/data/home-config";
import type { Game } from "@/types/game";

export type HomeRankingTarget =
  HomeCurationCollectionId;

export type HomeRankingSignalKey =
  | "popularity"
  | "rating"
  | "releaseRecency"
  | "addedRecency"
  | "completeness"
  | "heroAsset"
  | "lowSpec";

export type HomeRankingComponent = {
  key: HomeRankingSignalKey;
  points: number;
  detail: string;
};

export type HomeGameRanking = {
  game: Game;
  score: number;
  reasons: string[];
  components: HomeRankingComponent[];
};

type HomeRankingProfile = {
  weights: Partial<
    Record<HomeRankingSignalKey, number>
  >;
};

const DAY_MS = 86_400_000;
export const HOME_LOW_SPEC_MAX_RAM_GB = 12;

const signalLabels: Record<
  HomeRankingSignalKey,
  string
> = {
  popularity: "Popularidad (reseñas)",
  rating: "Rating",
  releaseRecency: "Lanzamiento",
  addedRecency: "Incorporación",
  completeness: "Ficha completa",
  heroAsset: "Arte Hero",
  lowSpec: "RAM mínima",
};

export const homeRankingProfiles = {
  hero: {
    weights: {
      popularity: 38,
      rating: 24,
      releaseRecency: 18,
      addedRecency: 8,
      heroAsset: 12,
    },
  },
  popular: {
    weights: {
      popularity: 58,
      rating: 24,
      releaseRecency: 10,
      addedRecency: 8,
    },
  },
  lowSpec: {
    weights: {
      lowSpec: 60,
      rating: 18,
      popularity: 10,
      completeness: 12,
    },
  },
  recommended: {
    weights: {
      rating: 34,
      popularity: 28,
      releaseRecency: 16,
      completeness: 12,
      addedRecency: 10,
    },
  },
} satisfies Record<
  HomeRankingTarget,
  HomeRankingProfile
>;

function profileEntries(
  target: HomeRankingTarget
) {
  return Object.entries(
    homeRankingProfiles[target].weights
  ) as Array<[HomeRankingSignalKey, number]>;
}

export function homeRankingDescription(
  target: HomeRankingTarget
) {
  const parts = profileEntries(target).map(
    ([key, weight]) =>
      `${signalLabels[key]} ${weight}%`
  );

  if (target === "lowSpec") {
    parts.push(
      `Automático: RAM mínima conocida de hasta ${HOME_LOW_SPEC_MAX_RAM_GB} GB`
    );
  }

  return parts.join(" · ");
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function homeRankingDay(
  now = Date.now()
) {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function ageSignal(
  value: string | undefined,
  horizonDays: number,
  now: number
) {
  const timestamp = parseGameDate(value);
  if (!timestamp) return 0;

  const referenceDay = homeRankingDay(now);
  const eventDay = homeRankingDay(timestamp);

  /*
   * Una fecha futura no debe otorgar actualidad máxima por un error de carga.
   * Los eventos del día actual sí reciben la señal completa.
   */
  if (eventDay > referenceDay) return 0;

  const ageDays =
    (referenceDay - eventDay) / DAY_MS;

  return clamp01(1 - ageDays / horizonDays);
}

function popularitySignal(game: Game) {
  const reviews = reviewScore(game.reviews);
  if (reviews <= 0) return 0;

  /*
   * Escala logarítmica: evita que un título gigantesco aplaste por completo
   * al resto del catálogo. 1 M de reseñas alcanza el techo de esta señal.
   */
  return clamp01(
    Math.log10(reviews + 1) / 6
  );
}

function ratingSignal(game: Game) {
  return clamp01((game.rating ?? 0) / 5);
}

function hasRequirements(game: Game) {
  const requirements = game.requirements;
  if (!requirements) return false;

  const groups = [
    requirements,
    requirements.minimum,
    requirements.recommended,
  ];

  return groups.some((group) =>
    Boolean(
      group &&
        [
          group.ram,
          group.graphics,
          group.processor,
          group.storage,
          group.system,
        ].some((value) => value?.trim())
    )
  );
}

function completenessSignal(game: Game) {
  const signals = [
    Boolean(game.coverImage),
    Boolean(game.heroImage),
    Boolean(game.version),
    hasRequirements(game),
    game.description.trim().length >= 120,
  ];
  const present = signals.filter(Boolean).length;
  return present / signals.length;
}

function parseRamGb(value: string | undefined) {
  if (!value) return null;

  const normalized = value
    .replace(",", ".")
    .toLowerCase();
  const match = normalized.match(
    /(\d+(?:\.\d+)?)\s*(gb|gib|mb|mib)\b/
  );

  if (!match) return null;

  const number = Number.parseFloat(match[1]);
  if (!Number.isFinite(number)) return null;

  const unit = match[2];
  return unit === "mb" || unit === "mib"
    ? number / 1024
    : number;
}

export function minimumRamGb(game: Game) {
  return parseRamGb(
    game.requirements?.minimum?.ram ??
      game.requirements?.ram
  );
}

function lowSpecSignal(game: Game) {
  const ram = minimumRamGb(game);
  if (ram === null) return 0;
  if (ram <= 4) return 1;
  if (ram <= 6) return 0.92;
  if (ram <= 8) return 0.82;
  if (ram <= HOME_LOW_SPEC_MAX_RAM_GB) return 0.55;
  return 0;
}

export function isHomeRankingEligible(
  game: Game,
  target: HomeRankingTarget
) {
  if (target === "hero") {
    return Boolean(game.heroImage || game.coverImage);
  }

  if (target !== "lowSpec") return true;

  const ram = minimumRamGb(game);
  return (
    ram !== null &&
    ram <= HOME_LOW_SPEC_MAX_RAM_GB
  );
}

function formatReviewReason(game: Game) {
  const reviews = reviewScore(game.reviews);
  if (reviews <= 0) return null;

  if (reviews >= 1_000_000) {
    return `${(reviews / 1_000_000).toFixed(1)} M reseñas`;
  }
  if (reviews >= 1_000) {
    return `${Math.round(reviews / 1_000)} K reseñas`;
  }
  return `${Math.round(reviews)} reseñas`;
}

function signalDetail(
  key: HomeRankingSignalKey,
  game: Game,
  value: number
) {
  if (key === "popularity") {
    return formatReviewReason(game) ?? "sin reseñas";
  }

  if (key === "rating") {
    return game.rating === undefined
      ? "sin rating"
      : `rating ${game.rating.toFixed(1)}/5`;
  }

  if (key === "releaseRecency") {
    return "actualidad de lanzamiento";
  }

  if (key === "addedRecency") {
    return "incorporación reciente";
  }

  if (key === "completeness") {
    return value >= 0.8
      ? "ficha muy completa"
      : "completitud de ficha";
  }

  if (key === "heroAsset") {
    return "arte Hero disponible";
  }

  const ram = minimumRamGb(game);
  return ram === null
    ? "RAM mínima desconocida"
    : `mínimo ${Math.round(ram * 10) / 10} GB RAM`;
}

function rankingSignals(
  game: Game,
  referenceDay: number
): Record<HomeRankingSignalKey, number> {
  return {
    popularity: popularitySignal(game),
    rating: ratingSignal(game),
    releaseRecency: ageSignal(
      game.releaseDate,
      1_095,
      referenceDay
    ),
    addedRecency: ageSignal(
      game.addedAt,
      365,
      referenceDay
    ),
    completeness: completenessSignal(game),
    heroAsset: game.heroImage ? 1 : 0,
    lowSpec: lowSpecSignal(game),
  };
}

export function scoreHomeGame(
  game: Game,
  target: HomeRankingTarget,
  now = Date.now()
): HomeGameRanking {
  const referenceDay = homeRankingDay(now);
  const signals = rankingSignals(
    game,
    referenceDay
  );
  const components = profileEntries(target)
    .map(([key, weight]) => ({
      key,
      points: signals[key] * weight,
      detail: signalDetail(
        key,
        game,
        signals[key]
      ),
    }))
    .filter((component) =>
      component.points > 0
    )
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.key.localeCompare(b.key, "es")
    );
  const weighted = components.reduce(
    (total, component) =>
      total + component.points,
    0
  );

  return {
    game,
    score: Math.round(weighted * 10) / 10,
    reasons: components
      .slice(0, 3)
      .map(
        (component) =>
          `${component.detail} (+${component.points.toFixed(1)})`
      ),
    components,
  };
}

export function rankHomeGames(
  catalog: Game[],
  target: HomeRankingTarget,
  now = Date.now()
) {
  const referenceDay = homeRankingDay(now);

  return catalog
    .filter((game) =>
      isHomeRankingEligible(game, target)
    )
    .map((game) =>
      scoreHomeGame(game, target, referenceDay)
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        reviewScore(b.game.reviews) -
          reviewScore(a.game.reviews) ||
        (b.game.rating ?? 0) -
          (a.game.rating ?? 0) ||
        a.game.title.localeCompare(
          b.game.title,
          "es"
        )
    );
}

function configuredGames(
  catalog: Game[],
  slugs: readonly string[],
  limit: number
) {
  const bySlug = new Map(
    catalog.map((game) => [game.slug, game])
  );
  const selected: Game[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    const game = bySlug.get(slug);
    if (!game || seen.has(slug)) continue;

    selected.push(game);
    seen.add(slug);

    if (selected.length === limit) break;
  }

  return selected;
}

export function resolveHomeCollectionGames(
  catalog: Game[],
  target: HomeRankingTarget,
  mode: HomeCurationMode,
  slugs: readonly string[],
  limit: number,
  now = Date.now()
) {
  const referenceDay = homeRankingDay(now);
  const configured = configuredGames(
    catalog,
    slugs,
    limit
  );

  if (mode === "manual") {
    return configured;
  }

  const ranked = rankHomeGames(
    catalog,
    target,
    referenceDay
  ).map((entry) => entry.game);

  if (mode === "automatic") {
    return ranked.slice(0, limit);
  }

  const selected = [...configured];
  if (selected.length >= limit) return selected.slice(0, limit);
  const seen = new Set(
    selected.map((game) => game.slug)
  );

  for (const game of ranked) {
    if (seen.has(game.slug)) continue;

    selected.push(game);
    seen.add(game.slug);

    if (selected.length === limit) break;
  }

  return selected;
}
