import type {
  Game,
  GameDirectPreview,
  GameYouTubePreview,
} from "@/types/game";

export type ResolvedGameCardPreview =
  | {
      kind: "webm";
      src: string;
    }
  | {
      kind: "youtube";
      preview: GameYouTubePreview;
    }
  | {
      kind: "direct";
      preview: GameDirectPreview;
    };

export function resolveGameCardPreview(
  game: Pick<
    Game,
    | "previewMode"
    | "previewClip"
    | "youtubePreview"
    | "directPreview"
  >
): ResolvedGameCardPreview | null {
  const local = game.previewClip?.trim();

  // Contrato público actual: la plataforma externa es sólo una fuente de
  // importación editorial. Las tarjetas nunca reproducen YouTube, Facebook ni
  // otra red en runtime; sólo consumen el WebM ya recortado y almacenado por
  // DeUna Games. Los campos externos se conservan temporalmente únicamente
  // para poder migrar configuraciones creadas por versiones anteriores.
  return local ? { kind: "webm", src: local } : null;
}
