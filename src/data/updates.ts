import {
  getGameBySlug,
} from "./games";

import {
  resolveGameDownload,
} from "@/lib/games/download";
import type {
  GameUpdate,
  ResolvedGameUpdate,
} from "@/types/update";
import {
  gameUpdates,
} from "./update-records";

export {
  gameUpdates,
} from "./update-records";

function resolveUpdate(
  update: GameUpdate
): ResolvedGameUpdate {
  const game =
    getGameBySlug(
      update.gameSlug
    );

  if (!game) {
    throw new Error(
      `No se encontró el juego "${update.gameSlug}" usado por la actualización "${update.id}".`
    );
  }

  return {
    ...update,
    game,
    downloadable:
      resolveGameDownload(game) !==
      null,
  };
}

export const resolvedGameUpdates:
  ResolvedGameUpdate[] =
  gameUpdates
    .map(resolveUpdate)
    .sort(
      (a, b) =>
        Date.parse(
          b.publishedAt
        ) -
        Date.parse(
          a.publishedAt
        )
    );

export const featuredUpdates =
  resolvedGameUpdates.filter(
    (update) =>
      update.featured
  );

export function getLatestUpdate() {
  return (
    featuredUpdates[0] ??
    resolvedGameUpdates[0]
  );
}
