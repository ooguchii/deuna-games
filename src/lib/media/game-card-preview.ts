import type { Game } from "@/types/game";

export type ResolvedGameCardPreview = {
  kind: "webm";
  src: string;
};

export function resolveGameCardPreview(
  game: Pick<Game, "previewClip">
): ResolvedGameCardPreview | null {
  const local = game.previewClip?.trim();

  // La plataforma externa es sólo una fuente de importación editorial.
  // La web pública consume exclusivamente el WebM recortado y almacenado por
  // DeUna Games; nunca depende de un iframe o reproductor de terceros.
  return local ? { kind: "webm", src: local } : null;
}
