import {
  resolveGameCardVideo,
  resolveGameDestinationMediaMode,
} from "./game-video-media";

import type { Game, GameVideoViewport } from "@/types/game";

export type ResolvedGameCardPreview = {
  kind: "webm";
  src: string;
  viewport: GameVideoViewport;
};

export function resolveGameCardPreview(
  game: Game
): ResolvedGameCardPreview | null {
  if (resolveGameDestinationMediaMode(game, "card") === "image") {
    return null;
  }

  const resolved = resolveGameCardVideo(game);

  // La plataforma externa es sólo una fuente de importación editorial.
  // La web pública consume exclusivamente WebM interno. Cada destino conserva
  // su propia asignación y viewport aunque dos destinos elijan el mismo master.
  return resolved
    ? {
        kind: "webm",
        src: resolved.src,
        viewport: resolved.viewport,
      }
    : null;
}
