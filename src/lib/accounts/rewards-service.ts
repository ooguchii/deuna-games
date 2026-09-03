import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import {
  accountQuery,
  withAccountTransaction,
} from "@/lib/accounts/database";

const CLAIM_COOLDOWN_MS = 20 * 60 * 60 * 1000;
const STREAK_GRACE_MS = 60 * 60 * 60 * 1000;

const dailyRewards = [
  { day: 1, xp: 10, credits: 5 },
  { day: 2, xp: 10, credits: 5 },
  { day: 3, xp: 12, credits: 7 },
  { day: 4, xp: 12, credits: 7 },
  { day: 5, xp: 15, credits: 10 },
  { day: 6, xp: 15, credits: 10 },
  { day: 7, xp: 35, credits: 25 },
] as const;

const milestoneDefinitions = [
  {
    key: "first_game",
    title: "Primer juego guardado",
    description: "Agrega tu primer juego a Mi DeUna.",
    xp: 20,
    credits: 10,
    test: (state: MilestoneState) => state.savedGames >= 1,
  },
  {
    key: "library_5",
    title: "Biblioteca en marcha",
    description: "Guarda 5 juegos en Mi DeUna.",
    xp: 60,
    credits: 30,
    test: (state: MilestoneState) => state.savedGames >= 5,
  },
  {
    key: "favorites_3",
    title: "Tus imprescindibles",
    description: "Marca 3 juegos como favoritos.",
    xp: 40,
    credits: 20,
    test: (state: MilestoneState) => state.favorites >= 3,
  },
  {
    key: "follow_2",
    title: "Siempre al día",
    description: "Sigue las actualizaciones de 2 juegos.",
    xp: 40,
    credits: 20,
    test: (state: MilestoneState) => state.followedGames >= 2,
  },
  {
    key: "pc_configured",
    title: "Mi PC lista",
    description: "Guarda tu PC para activar compatibilidad y FPS personalizados.",
    xp: 50,
    credits: 25,
    test: (state: MilestoneState) => state.hasHardware,
  },
] as const;

type RewardProfileRow = {
  xp_total: string;
  credits_balance: string;
  streak_days: number;
  best_streak: number;
  last_claim_at: Date | null;
};

type RewardEventRow = {
  event_type: string;
  event_key: string;
  xp_delta: number;
  credits_delta: number;
  created_at: Date;
};

type MilestoneState = {
  savedGames: number;
  favorites: number;
  followedGames: number;
  hasHardware: boolean;
};

export type RewardLevel = {
  level: number;
  rank: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

export type RewardMilestone = {
  key: string;
  title: string;
  description: string;
  xp: number;
  credits: number;
  complete: boolean;
};

export type RewardSnapshot = {
  xpTotal: number;
  creditsBalance: number;
  streakDays: number;
  bestStreak: number;
  level: RewardLevel;
  daily: {
    available: boolean;
    nextClaimAt: string | null;
    rewardDay: number;
    xp: number;
    credits: number;
    schedule: Array<{ day: number; xp: number; credits: number }>;
  };
  weekly: {
    claims: number;
    target: number;
    complete: boolean;
    bonusXp: number;
    bonusCredits: number;
  };
  milestones: RewardMilestone[];
  recentEvents: Array<{
    type: string;
    key: string;
    xp: number;
    credits: number;
    createdAt: string;
  }>;
};

function asSafeNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function rankForLevel(level: number) {
  if (level >= 50) return "Leyenda DeUna";
  if (level >= 35) return "Experto";
  if (level >= 20) return "Veterano";
  if (level >= 10) return "Explorador";
  if (level >= 5) return "Gamer Activo";
  return "Gamer";
}

export function getRewardLevel(xpTotal: number): RewardLevel {
  const xp = Math.max(0, Math.floor(xpTotal));
  let level = 1;
  let currentLevelXp = 0;
  let nextLevelXp = 100;

  while (xp >= nextLevelXp && level < 1000) {
    level += 1;
    currentLevelXp = nextLevelXp;
    nextLevelXp = currentLevelXp + 100 + (level - 1) * 50;
  }

  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(((xp - currentLevelXp) / span) * 100))
  );

  return {
    level,
    rank: rankForLevel(level),
    currentLevelXp,
    nextLevelXp,
    progressPercent,
  };
}

function getIsoWeekKey(date: Date) {
  const value = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getIsoWeekStart(date: Date) {
  const start = new Date(date);
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

async function ensureRewardProfile(client: PoolClient, userId: string) {
  await client.query(
    `INSERT INTO deuna_accounts.reward_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getMilestoneState(client: PoolClient, userId: string) {
  const result = await client.query<{
    saved_games: number;
    favorites: number;
    followed_games: number;
    has_hardware: boolean;
  }>(
    `SELECT
       (SELECT count(*)::integer
          FROM deuna_accounts.game_preferences
         WHERE user_id = $1) AS saved_games,
       (SELECT count(*)::integer
          FROM deuna_accounts.game_preferences
         WHERE user_id = $1
           AND favorite = true) AS favorites,
       (SELECT count(*)::integer
          FROM deuna_accounts.game_preferences
         WHERE user_id = $1
           AND follow_updates = true) AS followed_games,
       EXISTS (
         SELECT 1
           FROM deuna_accounts.hardware_profiles
          WHERE user_id = $1
       ) AS has_hardware`,
    [userId]
  );
  const row = result.rows[0];

  return {
    savedGames: row?.saved_games ?? 0,
    favorites: row?.favorites ?? 0,
    followedGames: row?.followed_games ?? 0,
    hasHardware: row?.has_hardware ?? false,
  } satisfies MilestoneState;
}

async function awardMilestones(
  client: PoolClient,
  userId: string,
  state: MilestoneState
) {
  let xpDelta = 0;
  let creditsDelta = 0;

  for (const milestone of milestoneDefinitions) {
    if (!milestone.test(state)) continue;

    const inserted = await client.query<{
      xp_delta: number;
      credits_delta: number;
    }>(
      `INSERT INTO deuna_accounts.reward_events
         (id, user_id, event_type, event_key, xp_delta, credits_delta)
       VALUES ($1, $2, 'milestone', $3, $4, $5)
       ON CONFLICT (user_id, event_type, event_key) DO NOTHING
       RETURNING xp_delta, credits_delta`,
      [randomUUID(), userId, milestone.key, milestone.xp, milestone.credits]
    );

    if (inserted.rows[0]) {
      xpDelta += inserted.rows[0].xp_delta;
      creditsDelta += inserted.rows[0].credits_delta;
    }
  }

  if (xpDelta > 0 || creditsDelta > 0) {
    await client.query(
      `UPDATE deuna_accounts.reward_profiles
          SET xp_total = xp_total + $2,
              credits_balance = credits_balance + $3,
              updated_at = now()
        WHERE user_id = $1`,
      [userId, xpDelta, creditsDelta]
    );
  }
}

export async function syncRewardMilestones(userId: string) {
  await withAccountTransaction(async (client) => {
    await ensureRewardProfile(client, userId);
    await client.query(
      `SELECT user_id
         FROM deuna_accounts.reward_profiles
        WHERE user_id = $1
        FOR UPDATE`,
      [userId]
    );
    await awardMilestones(client, userId, await getMilestoneState(client, userId));
  });
}

export async function claimDailyReward(userId: string, now = new Date()) {
  return withAccountTransaction(async (client) => {
    await ensureRewardProfile(client, userId);
    const profileResult = await client.query<RewardProfileRow>(
      `SELECT xp_total,
              credits_balance,
              streak_days,
              best_streak,
              last_claim_at
         FROM deuna_accounts.reward_profiles
        WHERE user_id = $1
        FOR UPDATE`,
      [userId]
    );
    const profile = profileResult.rows[0];

    if (!profile) {
      throw new Error("No se pudo crear el perfil de recompensas.");
    }

    const lastClaimAt = profile.last_claim_at;
    const elapsed = lastClaimAt ? now.getTime() - lastClaimAt.getTime() : null;

    if (elapsed !== null && elapsed < CLAIM_COOLDOWN_MS) {
      return {
        claimed: false,
        nextClaimAt: new Date(lastClaimAt!.getTime() + CLAIM_COOLDOWN_MS),
        xp: 0,
        credits: 0,
        weeklyBonus: false,
      };
    }

    const streakDays =
      elapsed !== null && elapsed <= STREAK_GRACE_MS
        ? profile.streak_days + 1
        : 1;
    const bestStreak = Math.max(profile.best_streak, streakDays);
    const reward = dailyRewards[(streakDays - 1) % dailyRewards.length]!;

    await client.query(
      `INSERT INTO deuna_accounts.reward_events
         (id, user_id, event_type, event_key, xp_delta, credits_delta, created_at)
       VALUES ($1, $2, 'daily_claim', $3, $4, $5, $6)`,
      [
        randomUUID(),
        userId,
        `claim:${now.getTime()}`,
        reward.xp,
        reward.credits,
        now,
      ]
    );

    await client.query(
      `UPDATE deuna_accounts.reward_profiles
          SET xp_total = xp_total + $2,
              credits_balance = credits_balance + $3,
              streak_days = $4,
              best_streak = $5,
              last_claim_at = $6,
              updated_at = $6
        WHERE user_id = $1`,
      [userId, reward.xp, reward.credits, streakDays, bestStreak, now]
    );

    const weekStart = getIsoWeekStart(now);
    const weekClaims = await client.query<{ count: number }>(
      `SELECT count(*)::integer AS count
         FROM deuna_accounts.reward_events
        WHERE user_id = $1
          AND event_type = 'daily_claim'
          AND created_at >= $2`,
      [userId, weekStart]
    );
    let weeklyBonus = false;
    let totalXp = reward.xp;
    let totalCredits = reward.credits;

    if ((weekClaims.rows[0]?.count ?? 0) >= 3) {
      const bonus = await client.query<{
        xp_delta: number;
        credits_delta: number;
      }>(
        `INSERT INTO deuna_accounts.reward_events
           (id, user_id, event_type, event_key, xp_delta, credits_delta, created_at)
         VALUES ($1, $2, 'weekly_bonus', $3, 25, 15, $4)
         ON CONFLICT (user_id, event_type, event_key) DO NOTHING
         RETURNING xp_delta, credits_delta`,
        [randomUUID(), userId, `checkin:${getIsoWeekKey(now)}`, now]
      );

      if (bonus.rows[0]) {
        weeklyBonus = true;
        totalXp += bonus.rows[0].xp_delta;
        totalCredits += bonus.rows[0].credits_delta;
        await client.query(
          `UPDATE deuna_accounts.reward_profiles
              SET xp_total = xp_total + $2,
                  credits_balance = credits_balance + $3,
                  updated_at = $4
            WHERE user_id = $1`,
          [userId, bonus.rows[0].xp_delta, bonus.rows[0].credits_delta, now]
        );
      }
    }

    await awardMilestones(client, userId, await getMilestoneState(client, userId));

    return {
      claimed: true,
      nextClaimAt: new Date(now.getTime() + CLAIM_COOLDOWN_MS),
      xp: totalXp,
      credits: totalCredits,
      weeklyBonus,
    };
  });
}

export async function getAccountRewardSnapshot(
  userId: string,
  now = new Date()
): Promise<RewardSnapshot> {
  await syncRewardMilestones(userId);

  const [profileResult, eventsResult, milestoneStateResult, completedResult, weeklyClaimsResult] = await Promise.all([
    accountQuery<RewardProfileRow>(
      `SELECT xp_total,
              credits_balance,
              streak_days,
              best_streak,
              last_claim_at
         FROM deuna_accounts.reward_profiles
        WHERE user_id = $1`,
      [userId]
    ),
    accountQuery<RewardEventRow>(
      `SELECT event_type,
              event_key,
              xp_delta,
              credits_delta,
              created_at
         FROM deuna_accounts.reward_events
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 8`,
      [userId]
    ),
    accountQuery<{
      saved_games: number;
      favorites: number;
      followed_games: number;
      has_hardware: boolean;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM deuna_accounts.game_preferences WHERE user_id = $1) AS saved_games,
         (SELECT count(*)::integer FROM deuna_accounts.game_preferences WHERE user_id = $1 AND favorite = true) AS favorites,
         (SELECT count(*)::integer FROM deuna_accounts.game_preferences WHERE user_id = $1 AND follow_updates = true) AS followed_games,
         EXISTS (SELECT 1 FROM deuna_accounts.hardware_profiles WHERE user_id = $1) AS has_hardware`,
      [userId]
    ),
    accountQuery<{ event_key: string }>(
      `SELECT event_key
         FROM deuna_accounts.reward_events
        WHERE user_id = $1
          AND event_type = 'milestone'`,
      [userId]
    ),
    accountQuery<{ count: number }>(
      `SELECT count(*)::integer AS count
         FROM deuna_accounts.reward_events
        WHERE user_id = $1
          AND event_type = 'daily_claim'
          AND created_at >= $2`,
      [userId, getIsoWeekStart(now)]
    ),
  ]);

  const profile = profileResult.rows[0];
  const xpTotal = asSafeNumber(profile?.xp_total ?? 0);
  const creditsBalance = asSafeNumber(profile?.credits_balance ?? 0);
  const lastClaimAt = profile?.last_claim_at ?? null;
  const elapsed = lastClaimAt ? now.getTime() - lastClaimAt.getTime() : null;
  const available = elapsed === null || elapsed >= CLAIM_COOLDOWN_MS;
  const displayedStreak =
    elapsed !== null && elapsed > STREAK_GRACE_MS
      ? 0
      : profile?.streak_days ?? 0;
  const nextStreak = displayedStreak > 0 ? displayedStreak + 1 : 1;
  const nextReward = dailyRewards[(nextStreak - 1) % dailyRewards.length]!;
  const stateRow = milestoneStateResult.rows[0];
  const state: MilestoneState = {
    savedGames: stateRow?.saved_games ?? 0,
    favorites: stateRow?.favorites ?? 0,
    followedGames: stateRow?.followed_games ?? 0,
    hasHardware: stateRow?.has_hardware ?? false,
  };
  const completed = new Set(completedResult.rows.map((row) => row.event_key));
  const weeklyClaims = weeklyClaimsResult.rows[0]?.count ?? 0;

  return {
    xpTotal,
    creditsBalance,
    streakDays: displayedStreak,
    bestStreak: profile?.best_streak ?? 0,
    level: getRewardLevel(xpTotal),
    daily: {
      available,
      nextClaimAt:
        !available && lastClaimAt
          ? new Date(lastClaimAt.getTime() + CLAIM_COOLDOWN_MS).toISOString()
          : null,
      rewardDay: nextReward.day,
      xp: nextReward.xp,
      credits: nextReward.credits,
      schedule: dailyRewards.map((reward) => ({ ...reward })),
    },
    weekly: {
      claims: Math.min(weeklyClaims, 3),
      target: 3,
      complete: weeklyClaims >= 3,
      bonusXp: 25,
      bonusCredits: 15,
    },
    milestones: milestoneDefinitions.map((milestone) => ({
      key: milestone.key,
      title: milestone.title,
      description: milestone.description,
      xp: milestone.xp,
      credits: milestone.credits,
      complete: completed.has(milestone.key) || milestone.test(state),
    })),
    recentEvents: eventsResult.rows.map((event) => ({
      type: event.event_type,
      key: event.event_key,
      xp: event.xp_delta,
      credits: event.credits_delta,
      createdAt: event.created_at.toISOString(),
    })),
  };
}
