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

export type HomeGameRanking = {
  game: Game;
  score: number;
  reasons: string[];
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function ageSignal(
  value: string | undefined,
  horizonDays: number,
  now: number
) {
  const timestamp = parseGameDate(value);
  if (!timestamp) return 0;

  const ageDays = Math.max(
    0,
    (now - timestamp) / 86_400_000
  );
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

function completenessSignal(game: Game) {
  const signals = [
    Boolean(game.coverImage),
    Boolean(game.heroImage),
    Boolean(game.version),
    Boolean(game.requirements),
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
    /(\d+(?:\.\d+)?)\s*(?:gb|gib)\b/
  );

  if (!match) return null;
  const number = Number.parseFloat(match[1]);
  return Number.isFinite(number) ? number : null;
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
  if (ram <= 12) return 0.55;
  return 0;
}

export function isHomeRankingEligible(
  game: Game,
  target: HomeRankingTarget
) {
  if (target !== "lowSpec") return true;

  const ram = minimumRamGb(game);
  return ram !== null && ram <= 12;
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

export function scoreHomeGame(
  game: Game,
  target: HomeRankingTarget,
  now = Date.now()
): HomeGameRanking {
  const popularity = popularitySignal(game);
  const rating = ratingSignal(game);
  const releaseRecency = ageSignal(
    game.releaseDate,
    1_095,
    now
  );
  const addedRecency = ageSignal(
    game.addedAt,
    365,
    now
  );
  const completeness = completenessSignal(game);
  const heroAsset = game.heroImage ? 1 : 0;
  const lowSpec = lowSpecSignal(game);

  let weighted = 0;

  if (target === "popular") {
    weighted =
      popularity * 58 +
      rating * 24 +
      releaseRecency * 10 +
      addedRecency * 8;
  } else if (target === "hero") {
    weighted =
      popularity * 38 +
      rating * 24 +
      releaseRecency * 18 +
      addedRecency * 8 +
      heroAsset * 12;
  } else if (target === "recommended") {
    weighted =
      rating * 34 +
      popularity * 28 +
      releaseRecency * 16 +
      completeness * 12 +
      addedRecency * 10;
  } else {
    weighted =
      lowSpec * 60 +
      rating * 18 +
      popularity * 10 +
      completeness * 12;
  }

  const reasons: string[] = [];
  const reviews = formatReviewReason(game);
  if (reviews) reasons.push(reviews);
  if (game.rating !== undefined) {
    reasons.push(`rating ${game.rating.toFixed(1)}/5`);
  }

  if (
    target === "hero" ||
    target === "popular" ||
    target === "recommended"
  ) {
    if (releaseRecency >= 0.55) {
      reasons.push("lanzamiento reciente");
    }
    if (addedRecency >= 0.65) {
      reasons.push("incorporación reciente");
    }
  }

  if (target === "hero" && game.heroImage) {
    reasons.push("arte Hero disponible");
  }

  if (target === "lowSpec") {
    const ram = minimumRamGb(game);
    if (ram !== null) {
      reasons.push(`mínimo ${ram} GB RAM`);
    }
  }

  if (target === "recommended" && completeness >= 0.8) {
    reasons.push("ficha completa");
  }

  return {
    game,
    score: Math.round(weighted * 10) / 10,
    reasons: reasons.slice(0, 3),
  };
}

export function rankHomeGames(
  catalog: Game[],
  target: HomeRankingTarget,
  now = Date.now()
) {
  return catalog
    .filter((game) =>
      isHomeRankingEligible(game, target)
    )
    .map((game) => scoreHomeGame(game, target, now))
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
    now
  ).map((entry) => entry.game);

  if (mode === "automatic") {
    return ranked.slice(0, limit);
  }

  const selected = [...configured];
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
