import { resolveGameCardPreview } from "./game-card-preview";
import { resolveGameDestinationMediaMode } from "./game-video-media";

import type {
  Game,
  GameImageViewport,
} from "@/types/game";

export type GameCoverArtworkSource = "card" | "custom";

export type GameCardPresentation = {
  cover: {
    image?: string;
    viewport?: GameImageViewport;
    alt: string;
    source: GameCoverArtworkSource;
  };
  card: {
    image?: string;
    viewport?: GameImageViewport;
    alt: string;
    mode: ReturnType<typeof resolveGameDestinationMediaMode>;
    preview: ReturnType<typeof resolveGameCardPreview>;
  };
};

/**
 * Resolves the active artwork contract without rewriting historical snapshots.
 *
 * Legacy payloads do not carry a dedicated source flag, so a distinct
 * coverImage is interpreted as an intentionally custom cover. New Admin writes
 * preserve the shared choice by keeping coverImage and cardImage on the same
 * resource while each destination retains its own crop.
 */
export function resolveGameCoverArtworkSource(
  game: Game
): GameCoverArtworkSource {
  return game.cardImage &&
    game.coverImage &&
    game.cardImage !== game.coverImage
    ? "custom"
    : "card";
}

export function resolveGameCardBaseImage(game: Game) {
  return game.cardImage ?? game.coverImage;
}

export function resolveGameCoverImage(game: Game) {
  const source = resolveGameCoverArtworkSource(game);
  return source === "custom"
    ? game.coverImage
    : resolveGameCardBaseImage(game) ?? game.coverImage;
}

export function resolveGameCardPresentation(
  game: Game
): GameCardPresentation {
  return {
    cover: {
      image: resolveGameCoverImage(game),
      viewport: game.imageMedia?.cover,
      alt:
        game.mediaAccessibility?.cover ??
        game.mediaAccessibility?.card ??
        game.imageAlt,
      source: resolveGameCoverArtworkSource(game),
    },
    card: {
      image: resolveGameCardBaseImage(game),
      viewport: game.imageMedia?.card,
      alt: game.mediaAccessibility?.card ?? game.imageAlt,
      mode: resolveGameDestinationMediaMode(game, "card"),
      preview: resolveGameCardPreview(game),
    },
  };
}
