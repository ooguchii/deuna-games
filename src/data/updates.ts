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

export const gameUpdates:
  GameUpdate[] = [
  {
    id: "elden-ring-v1-10-1",
    gameSlug: "elden-ring",
    version: "v1.10.1",
    publishedAt:
      "2025-05-17T15:00:00Z",
    type: "update",
    summary:
      "Balance de armas, ajustes generales y mejoras de rendimiento.",
    featured: true,
  },
  {
    id: "palworld-v0-3-2",
    gameSlug: "palworld",
    version: "v0.3.2",
    publishedAt:
      "2025-05-16T15:00:00Z",
    type: "fix",
    summary:
      "Correcciones de estabilidad, optimización y mejoras generales.",
    featured: true,
  },
  {
    id: "stellar-blade-v1-3-1",
    gameSlug: "stellar-blade",
    version: "v1.3.1",
    publishedAt:
      "2025-05-15T15:00:00Z",
    type: "improvement",
    summary:
      "Nueva versión con ajustes, correcciones y mejoras generales.",
    featured: true,
  },
  {
    id: "enshrouded-v0-8-5",
    gameSlug: "enshrouded",
    version: "v0.8.5",
    publishedAt:
      "2025-05-14T15:00:00Z",
    type: "content",
    summary:
      "Contenido actualizado y pequeños ajustes para mejorar la experiencia.",
  },
  {
    id: "helldivers-2-v1-000-302",
    gameSlug: "helldivers-2",
    version: "v1.000.302",
    publishedAt:
      "2025-05-13T15:00:00Z",
    type: "fix",
    summary:
      "Correcciones generales y mejoras de estabilidad.",
  },
  {
    id: "talos-principle-2-v1-2-0",
    gameSlug:
      "the-talos-principle-2",
    version: "v1.2.0",
    publishedAt:
      "2025-05-12T15:00:00Z",
    type: "improvement",
    summary:
      "Mejoras generales y pequeños ajustes en distintos sistemas.",
  },
  {
    id: "god-of-war-ragnarok-v1-5-3",
    gameSlug:
      "god-of-war-ragnarok",
    version: "v1.5.3",
    publishedAt:
      "2025-05-11T15:00:00Z",
    type: "content",
    summary:
      "Nueva versión disponible con contenido actualizado y mejoras generales.",
  },
];

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
