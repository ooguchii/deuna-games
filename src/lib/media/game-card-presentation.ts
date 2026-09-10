import { resolveGameCardPreview } from "./game-card-preview";
import { resolveGameDestinationMediaMode } from "./game-video-media";

import type {
  Game,
  GameCoverArtworkSource,
  GameImageViewport,
} from "@/types/game";

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
 * New revisions persist the editor's explicit shared/custom choice. Legacy
 * snapshots do not carry that field, so only those infer intent from whether
 * Card and Portada point at distinct resources.
 */
export function resolveGameCoverArtworkSource(
  game: Game
): GameCoverArtworkSource {
  if (game.coverArtworkSource) return game.coverArtworkSource;

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

export function resolveGameCoverAlt(game: Game) {
  return game.mediaAccessibility?.cover ?? game.imageAlt;
}

export function resolveGameCardAlt(game: Game) {
  return game.mediaAccessibility?.card ?? game.imageAlt;
}

export function resolveGameCardPresentation(
  game: Game
): GameCardPresentation {
  return {
    cover: {
      image: resolveGameCoverImage(game),
      viewport: game.imageMedia?.cover,
      alt: resolveGameCoverAlt(game),
      source: resolveGameCoverArtworkSource(game),
    },
    card: {
      image: resolveGameCardBaseImage(game),
      viewport: game.imageMedia?.card,
      alt: resolveGameCardAlt(game),
      mode: resolveGameDestinationMediaMode(game, "card"),
      preview: resolveGameCardPreview(game),
    },
  };
}
