import type {
  Game,
  GameCoverImageSource,
  GameImageViewport,
} from "@/types/game";

export type ResolvedGameCardArtwork = {
  coverImageSource: GameCoverImageSource;
  cardImage?: string;
  coverImage?: string;
  cardViewport?: GameImageViewport;
  coverViewport?: GameImageViewport;
  usesSharedImage: boolean;
};

/**
 * New revisions persist the editorial intent explicitly. Historical snapshots
 * predate that field, so they are interpreted without rewriting them:
 * - no dedicated card image => the cover was also the card fallback;
 * - equal card/cover images => shared artwork;
 * - different images => custom cover artwork.
 */
export function resolveGameCoverImageSource(
  game: Game
): GameCoverImageSource {
  if (game.coverImageSource) return game.coverImageSource;

  if (
    game.cardImage &&
    game.coverImage &&
    game.cardImage !== game.coverImage
  ) {
    return "custom";
  }

  return "card";
}

/** Card always has a static base image in the active contract. */
export function resolveGameCardBaseImage(game: Game) {
  return game.cardImage ?? game.coverImage;
}

/**
 * Portada remains image-only. In shared mode it resolves from the Card base;
 * coverImage is still mirrored by new writes for backwards compatibility, but
 * consumers should use this resolver instead of relying on that duplication.
 */
export function resolveGameCoverImage(game: Game) {
  const source = resolveGameCoverImageSource(game);
  if (source === "custom") return game.coverImage;
  return resolveGameCardBaseImage(game);
}

export function resolveGameCardArtwork(
  game: Game
): ResolvedGameCardArtwork {
  const coverImageSource = resolveGameCoverImageSource(game);
  const cardImage = resolveGameCardBaseImage(game);
  const coverImage = coverImageSource === "custom"
    ? game.coverImage
    : cardImage;

  return {
    coverImageSource,
    cardImage,
    coverImage,
    cardViewport: game.imageMedia?.card,
    coverViewport: game.imageMedia?.cover,
    usesSharedImage: coverImageSource === "card",
  };
}

export function isCustomCoverDistinctFromCard(game: Game) {
  const artwork = resolveGameCardArtwork(game);
  return artwork.coverImageSource !== "custom" || Boolean(
    artwork.coverImage &&
    artwork.cardImage &&
    artwork.coverImage !== artwork.cardImage
  );
}

export function viewportMatchesImageSource(
  viewport: GameImageViewport | undefined,
  image: string | undefined
) {
  if (!viewport || !image) return false;
  // Historical crops have no provenance. They remain readable; every new crop
  // saved by the Admin records its source and therefore becomes self-checking.
  return viewport.source === undefined || viewport.source === image;
}
