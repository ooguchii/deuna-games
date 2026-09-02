import { resolveGameCardVideo } from "./game-video-media";

import type { Game, GameVideoViewport } from "@/types/game";

export type ResolvedGameCardPreview = {
  kind: "webm";
  src: string;
  viewport: GameVideoViewport;
};

export function resolveGameCardPreview(
  game: Game
): ResolvedGameCardPreview | null {
  const resolved = resolveGameCardVideo(game);

  // La plataforma externa es sólo una fuente de importación editorial.
  // La web pública consume exclusivamente WebM interno. Cuando la Card
  // comparte Hero, `src` es exactamente la misma ruta física y sólo cambia
  // viewport, sin crear ni descargar una segunda variante del archivo.
  return resolved
    ? {
        kind: "webm",
        src: resolved.src,
        viewport: resolved.viewport,
      }
    : null;
}
