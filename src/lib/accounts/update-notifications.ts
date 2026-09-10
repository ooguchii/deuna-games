import type {
  AccountGamePreference,
} from "@/lib/accounts/personalization-types";
import { resolveGameCardBaseImage } from "@/lib/media/game-card-presentation";
import type { GameImageViewport } from "@/types/game";
import type { ResolvedGameUpdate } from "@/types/update";

export type AccountUpdateNotification = {
  id: string;
  gameSlug: string;
  gameTitle: string;
  gameCoverImage?: string;
  gameImageViewport?: GameImageViewport;
  version: string;
  summary: string;
  publishedAt: string;
};

function validTime(value: Date | null) {
  if (!value) return null;
  const time = value.getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolveAccountUpdateNotifications(
  preferences: readonly AccountGamePreference[],
  updates: readonly ResolvedGameUpdate[]
): AccountUpdateNotification[] {
  const preferenceBySlug = new Map(
    preferences.map((preference) => [
      preference.gameSlug,
      preference,
    ])
  );
  const notifications: AccountUpdateNotification[] = [];

  for (const update of updates) {
    const preference = preferenceBySlug.get(update.gameSlug);

    if (!preference?.followUpdates) continue;

    const followedAt = validTime(preference.followedAt);
    if (followedAt === null) continue;

    const seenThrough = validTime(preference.updatesSeenThrough);
    const boundary = seenThrough === null
      ? followedAt
      : Math.max(followedAt, seenThrough);
    const publishedAt = Date.parse(update.publishedAt);

    if (!Number.isFinite(publishedAt) || publishedAt <= boundary) {
      continue;
    }

    notifications.push({
      id: update.id,
      gameSlug: update.gameSlug,
      gameTitle: update.game.title,
            gameCoverImage: resolveGameCardBaseImage(update.game),
      gameImageViewport:
        update.game.imageMedia?.card ?? update.game.imageMedia?.cover,
      version: update.version,
      summary: update.summary,
      publishedAt: update.publishedAt,
    });
  }

  return notifications.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}
