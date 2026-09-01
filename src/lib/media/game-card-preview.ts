import {
  validateDirectPlatformPreview,
} from "./direct-platform-preview";
import {
  validateYouTubePreview,
} from "./youtube-preview";

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
  const youtube = validateYouTubePreview(
    game.youtubePreview
  )
    ? game.youtubePreview
    : undefined;
  const direct = validateDirectPlatformPreview(
    game.directPreview
  )
    ? game.directPreview
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
      : direct
        ? { kind: "direct", preview: direct }
        : null;
  }

  if (
    direct &&
    game.previewMode === direct.platform
  ) {
    return {
      kind: "direct",
      preview: direct,
    };
  }

  if (game.previewMode === "webm") {
    if (local) {
      return { kind: "webm", src: local };
    }

    if (youtube) {
      return {
        kind: "youtube",
        preview: youtube,
      };
    }

    return direct
      ? { kind: "direct", preview: direct }
      : null;
  }

  // Payloads históricos conservan prioridad para el WebM local.
  if (local) {
    return { kind: "webm", src: local };
  }

  if (youtube) {
    return {
      kind: "youtube",
      preview: youtube,
    };
  }

  return direct
    ? { kind: "direct", preview: direct }
    : null;
}
