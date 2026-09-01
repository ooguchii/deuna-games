import {
  validateYouTubePreview,
} from "./youtube-preview";

import type {
  Game,
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
    };

export function resolveGameCardPreview(
  game: Pick<
    Game,
    "previewMode" | "previewClip" | "youtubePreview"
  >
): ResolvedGameCardPreview | null {
  const local = game.previewClip?.trim();
  const youtube = validateYouTubePreview(
    game.youtubePreview
  )
    ? game.youtubePreview
    : undefined;

  if (game.previewMode === "youtube") {
    if (youtube) {
      return {
        kind: "youtube",
        preview: youtube,
      };
    }

    return local
      ? { kind: "webm", src: local }
      : null;
  }

  if (game.previewMode === "webm") {
    if (local) {
      return { kind: "webm", src: local };
    }

    return youtube
      ? { kind: "youtube", preview: youtube }
      : null;
  }

  // Payloads históricos conservan prioridad para el WebM local.
  if (local) {
    return { kind: "webm", src: local };
  }

  return youtube
    ? { kind: "youtube", preview: youtube }
    : null;
}
