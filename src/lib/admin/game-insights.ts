import "server-only";

import {
  adminQuery,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

export type GameInsightConfidence = "low" | "medium" | "high";

export type GameInsightBreakdown = {
  interest: number | null;
  engagement: number | null;
  satisfaction: number | null;
};

export type GameInsights = {
  migrationReady: boolean;
  preferences: {
    users: number;
    favorites: number;
    wantToPlay: number;
    playing: number;
    completed: number;
    followers: number;
  };
  community: {
    average: number | null;
    count: number;
  };
  index: {
    score: number;
    confidence: GameInsightConfidence;
    evidenceCount: number;
    breakdown: GameInsightBreakdown;
  };
  stored: {
    score: number;
    confidence: GameInsightConfidence;
    evidenceCount: number;
    calculatedAt: Date;
  } | null;
};

type PreferenceAggregateRow = {
  users: string;
  favorites: string;
  want_to_play: string;
  playing: string;
  completed: string;
  followers: string;
};

type RatingAggregateRow = {
  rating_count: string;
  rating_average: string | null;
};

type StoredScoreRow = {
  score: string;
  confidence: GameInsightConfidence;
  evidence_count: string;
  calculated_at: Date;
};

function number(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function weightedIndex(breakdown: GameInsightBreakdown) {
  const weighted = [
    { value: breakdown.interest, weight: 0.4 },
    { value: breakdown.engagement, weight: 0.3 },
    { value: breakdown.satisfaction, weight: 0.3 },
  ].filter(
    (item): item is { value: number; weight: number } =>
      item.value !== null
  );

  const totalWeight = weighted.reduce(
    (total, item) => total + item.weight,
    0
  );

  if (totalWeight === 0) return 0;

  return rounded(
    weighted.reduce(
      (total, item) => total + item.value * item.weight,
      0
    ) / totalWeight
  );
}

function confidenceFor(
  evidenceCount: number,
  ratingCount: number
): GameInsightConfidence {
  if (evidenceCount >= 250 && ratingCount >= 25) {
    return "high";
  }
  if (evidenceCount >= 25) return "medium";
  return "low";
}

function isUndefinedTable(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42P01"
  );
}

export async function getGameInsights(
  gameSlug: string
): Promise<GameInsights> {
  await verifyAdminSession();

  const preferenceResult =
    await adminQuery<PreferenceAggregateRow>(
      `SELECT
         count(*)::text AS users,
         count(*) FILTER (WHERE favorite = true)::text AS favorites,
         count(*) FILTER (WHERE library_state = 'want_to_play')::text AS want_to_play,
         count(*) FILTER (WHERE library_state = 'playing')::text AS playing,
         count(*) FILTER (WHERE library_state = 'completed')::text AS completed,
         count(*) FILTER (WHERE follow_updates = true)::text AS followers
       FROM deuna_accounts.game_preferences
       WHERE game_slug = $1`,
      [gameSlug]
    );
  const preference = preferenceResult.rows[0];
  const preferences = {
    users: number(preference?.users),
    favorites: number(preference?.favorites),
    wantToPlay: number(preference?.want_to_play),
    playing: number(preference?.playing),
    completed: number(preference?.completed),
    followers: number(preference?.followers),
  };

  let migrationReady = true;
  let ratingCount = 0;
  let ratingAverage: number | null = null;
  let stored: GameInsights["stored"] = null;

  try {
    const ratingResult = await adminQuery<RatingAggregateRow>(
      `SELECT
         count(*)::text AS rating_count,
         avg(rating)::text AS rating_average
       FROM deuna_accounts.game_ratings
       WHERE game_slug = $1`,
      [gameSlug]
    );
    ratingCount = number(ratingResult.rows[0]?.rating_count);
    const average = ratingResult.rows[0]?.rating_average;
    ratingAverage = average === null || average === undefined
      ? null
      : rounded(number(average));
  } catch (error) {
    if (!isUndefinedTable(error)) throw error;
    migrationReady = false;
  }

  try {
    const scoreResult = await adminQuery<StoredScoreRow>(
      `SELECT
         score::text,
         confidence,
         evidence_count::text,
         calculated_at
       FROM deuna_admin.game_insight_scores
       WHERE game_slug = $1
       LIMIT 1`,
      [gameSlug]
    );
    const score = scoreResult.rows[0];
    stored = score
      ? {
          score: rounded(number(score.score)),
          confidence: score.confidence,
          evidenceCount: number(score.evidence_count),
          calculatedAt: score.calculated_at,
        }
      : null;
  } catch (error) {
    if (!isUndefinedTable(error)) throw error;
    migrationReady = false;
  }

  const interestParts = [
    percent(preferences.favorites, preferences.users),
    percent(preferences.wantToPlay, preferences.users),
    percent(preferences.followers, preferences.users),
  ].filter((value): value is number => value !== null);
  const interest = interestParts.length
    ? rounded(
        interestParts.reduce((total, value) => total + value, 0) /
          interestParts.length
      )
    : null;
  const engagement = percent(
    preferences.playing + preferences.completed,
    preferences.users
  );
  const completion = percent(
    preferences.completed,
    preferences.playing + preferences.completed
  );
  const satisfaction = ratingAverage !== null
    ? rounded((ratingAverage / 5) * 100)
    : completion === null
      ? null
      : rounded(completion);
  const breakdown: GameInsightBreakdown = {
    interest,
    engagement: engagement === null ? null : rounded(engagement),
    satisfaction,
  };
  const evidenceCount = preferences.users + ratingCount;
  const calculated = {
    score: weightedIndex(breakdown),
    confidence: confidenceFor(evidenceCount, ratingCount),
    evidenceCount,
    breakdown,
  };

  return {
    migrationReady,
    preferences,
    community: {
      average: ratingAverage,
      count: ratingCount,
    },
    index: calculated,
    stored,
  };
}

export async function recalculateGameInsightScore(
  gameSlug: string,
  actorUserId: string
) {
  const session = await verifyAdminSession();
  if (session.userId !== actorUserId) {
    throw new Error(
      "La sesión administrativa no coincide con el actor."
    );
  }

  const insights = await getGameInsights(gameSlug);
  if (!insights.migrationReady) {
    throw new Error(
      "La migración de valoración e insights todavía no está aplicada."
    );
  }

  await adminQuery(
    `INSERT INTO deuna_admin.game_insight_scores (
       game_slug,
       score,
       confidence,
       evidence_count,
       breakdown,
       calculated_by,
       calculated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
     ON CONFLICT (game_slug)
     DO UPDATE SET
       score = EXCLUDED.score,
       confidence = EXCLUDED.confidence,
       evidence_count = EXCLUDED.evidence_count,
       breakdown = EXCLUDED.breakdown,
       calculated_by = EXCLUDED.calculated_by,
       calculated_at = now()`,
    [
      gameSlug,
      insights.index.score,
      insights.index.confidence,
      insights.index.evidenceCount,
      JSON.stringify(insights.index.breakdown),
      actorUserId,
    ]
  );

  await adminQuery(
    `INSERT INTO deuna_admin.admin_audit_log (
       user_id,
       action,
       entity_type,
       entity_id,
       details
     )
     VALUES ($1, 'game_insight_recalculated', 'game', $2, $3::jsonb)`,
    [
      actorUserId,
      gameSlug,
      JSON.stringify({
        score: insights.index.score,
        confidence: insights.index.confidence,
        evidenceCount: insights.index.evidenceCount,
      }),
    ]
  );

  return insights.index;
}
