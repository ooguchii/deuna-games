import "server-only";

import {
  findCpuById,
  findGpuById,
} from "@/features/game-finder/hardware-catalog";
import type { HardwareProfile } from "@/features/game-finder/types";

import {
  accountQuery,
  withAccountTransaction,
} from "./database";
import type {
  AccountGamePreference,
  AccountHardwareSelection,
  AccountLibraryState,
  AccountPersonalization,
} from "./personalization-types";

type GamePreferenceRow = {
  game_slug: string;
  favorite: boolean;
  library_state: AccountLibraryState | null;
  follow_updates: boolean;
  followed_at: Date | null;
  updates_seen_through: Date | null;
  updated_at: Date;
};

type HardwareProfileRow = {
  cpu_id: string;
  gpu_id: string;
  ram_gb: string;
  memory_mode: "unknown" | "single" | "dual";
  updated_at: Date;
};

export type SaveAccountGamePreferenceInput = {
  gameSlug: string;
  favorite: boolean;
  libraryState: AccountLibraryState | null;
  followUpdates: boolean;
};

export type SaveAccountHardwareInput = {
  cpuId: string;
  gpuId: string;
  ramGb: number;
  memoryMode: "unknown" | "single" | "dual";
};

function mapPreference(row: GamePreferenceRow): AccountGamePreference {
  return {
    gameSlug: row.game_slug,
    favorite: row.favorite,
    libraryState: row.library_state,
    followUpdates: row.follow_updates,
    followedAt: row.followed_at,
    updatesSeenThrough: row.updates_seen_through,
    updatedAt: row.updated_at,
  };
}

function mapHardwareSelection(row: HardwareProfileRow): AccountHardwareSelection | null {
  const ramGb = Number(row.ram_gb);

  if (!Number.isFinite(ramGb) || ramGb < 1 || ramGb > 256) {
    return null;
  }

  return {
    cpuId: row.cpu_id,
    gpuId: row.gpu_id,
    ramGb,
    memoryMode: row.memory_mode,
    updatedAt: row.updated_at,
  };
}

export function resolveSavedHardwareProfile(
  selection: AccountHardwareSelection | null
): HardwareProfile | null {
  if (!selection) return null;

  const cpu = findCpuById(selection.cpuId);
  const gpu = findGpuById(selection.gpuId);

  if (!cpu || !gpu) return null;

  return {
    cpu,
    cpuKnowledge: "confirmed",
    gpu,
    ramGb: selection.ramGb,
    ramKnowledge: "confirmed",
    os: "Sistema sin guardar",
    osConfirmed: false,
    memoryMode: selection.memoryMode,
    source: "saved",
    confidence: "high",
    updatedAt: selection.updatedAt.toISOString(),
  };
}

export async function getAccountGamePreferences(
  userId: string
): Promise<AccountGamePreference[]> {
  const result = await accountQuery<GamePreferenceRow>(
    `SELECT
       game_slug,
       favorite,
       library_state,
       follow_updates,
       followed_at,
       updates_seen_through,
       updated_at
     FROM deuna_accounts.game_preferences
     WHERE user_id = $1
     ORDER BY updated_at DESC, game_slug ASC`,
    [userId]
  );

  return result.rows.map(mapPreference);
}

export async function getAccountHardwareSelection(
  userId: string
): Promise<AccountHardwareSelection | null> {
  const result = await accountQuery<HardwareProfileRow>(
    `SELECT
       cpu_id,
       gpu_id,
       ram_gb,
       memory_mode,
       updated_at
     FROM deuna_accounts.hardware_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]
    ? mapHardwareSelection(result.rows[0])
    : null;
}

export async function getAccountPersonalization(
  userId: string
): Promise<AccountPersonalization> {
  const [preferences, hardwareSelection] = await Promise.all([
    getAccountGamePreferences(userId),
    getAccountHardwareSelection(userId),
  ]);

  return {
    preferences,
    hardwareSelection,
    hardware: resolveSavedHardwareProfile(hardwareSelection),
  };
}

export async function saveAccountGamePreference(
  userId: string,
  input: SaveAccountGamePreferenceInput
) {
  const meaningful =
    input.favorite ||
    input.libraryState !== null ||
    input.followUpdates;

  await withAccountTransaction(async (client) => {
    const existing = await client.query<{
      follow_updates: boolean;
      followed_at: Date | null;
      updates_seen_through: Date | null;
    }>(
      `SELECT
         follow_updates,
         followed_at,
         updates_seen_through
       FROM deuna_accounts.game_preferences
       WHERE user_id = $1
         AND game_slug = $2
       FOR UPDATE`,
      [userId, input.gameSlug]
    );

    if (!meaningful) {
      await client.query(
        `DELETE FROM deuna_accounts.game_preferences
         WHERE user_id = $1
           AND game_slug = $2`,
        [userId, input.gameSlug]
      );
      return;
    }

    const current = existing.rows[0];
    const keepFollowState =
      input.followUpdates && current?.follow_updates === true;
    const followedAt = input.followUpdates
      ? keepFollowState && current.followed_at
        ? current.followed_at
        : new Date()
      : null;
    const updatesSeenThrough = input.followUpdates && keepFollowState
      ? current.updates_seen_through
      : null;

    await client.query(
      `INSERT INTO deuna_accounts.game_preferences
         (
           user_id,
           game_slug,
           favorite,
           library_state,
           follow_updates,
           followed_at,
           updates_seen_through,
           updated_at
         )
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (user_id, game_slug)
       DO UPDATE SET
         favorite = EXCLUDED.favorite,
         library_state = EXCLUDED.library_state,
         follow_updates = EXCLUDED.follow_updates,
         followed_at = EXCLUDED.followed_at,
         updates_seen_through = EXCLUDED.updates_seen_through,
         updated_at = now()`,
      [
        userId,
        input.gameSlug,
        input.favorite,
        input.libraryState,
        input.followUpdates,
        followedAt,
        updatesSeenThrough,
      ]
    );
  });
}

export async function saveAccountHardwareProfile(
  userId: string,
  input: SaveAccountHardwareInput
) {
  await accountQuery(
    `INSERT INTO deuna_accounts.hardware_profiles
       (user_id, cpu_id, gpu_id, ram_gb, memory_mode, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       cpu_id = EXCLUDED.cpu_id,
       gpu_id = EXCLUDED.gpu_id,
       ram_gb = EXCLUDED.ram_gb,
       memory_mode = EXCLUDED.memory_mode,
       updated_at = now()`,
    [
      userId,
      input.cpuId,
      input.gpuId,
      input.ramGb,
      input.memoryMode,
    ]
  );
}

export async function clearAccountHardwareProfile(userId: string) {
  await accountQuery(
    `DELETE FROM deuna_accounts.hardware_profiles
     WHERE user_id = $1`,
    [userId]
  );
}

export async function markAccountUpdatesSeen(userId: string) {
  await accountQuery(
    `UPDATE deuna_accounts.game_preferences
     SET updates_seen_through = now(),
         updated_at = now()
     WHERE user_id = $1
       AND follow_updates = true`,
    [userId]
  );
}
