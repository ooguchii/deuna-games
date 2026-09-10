import { resolveGameCardPreview } from "./game-card-preview";
import { resolveGameDestinationMediaMode } from "./game-video-media";

import type { Game } from "@/types/game";

export type GameCoverArtworkSource = "card" | "custom";

export type GameCardPresentation = {
  cover: {
    image?: string;
    viewport: Game["imageMedia"] extends infer _Media
      ? NonNullable<Game["imageMedia"]>["cover"]
      : never;
    alt: string;
    source: GameCoverArtworkSource;
  };
  card: {
    image?: string;
    viewport: NonNullable<Game["imageMedia"]>["card"] | undefined;
    alt: string;
    mode: ReturnType<typeof resolveGameDestinationMediaMode>;
    preview: ReturnType<typeof resolveGameCardPreview>;
  };
};

/**
 * Resolves the current editorial intent without rewriting historical snapshots.
 *
 * Existing payloads do not carry a dedicated source flag. A distinct coverImage
 * therefore means an intentionally custom cover, while a missing/equal Card
 * image means both destinations share one master. New Admin writes preserve
 * that invariant explicitly by keeping both refs equal for the shared case.
 */
export function resolveGameCoverArtworkSource(
  game: Game
): GameCoverArtworkSource {
  if (
    game.cardImage &&
    game.coverImage &&
    game.cardImage !== game.coverImage
  ) {
    return "custom";
  }
  return "card";
}

export function resolveGameCardBaseImage(game: Game) {
  return game.cardImage ?? game.coverImage;
}

export function resolveGameCoverImage(game: Game) {
  const source = resolveGameCoverArtworkSource(game);
  const cardImage = resolveGameCardBaseImage(game);

  if (source === "custom") return game.coverImage;
  return cardImage ?? game.coverImage;
}

export function resolveGameCardPresentation(
  game: Game
): GameCardPresentation {
  const source = resolveGameCoverArtworkSource(game);
  const cardImage = resolveGameCardBaseImage(game);
  const coverImage = resolveGameCoverImage(game);

  return {
    cover: {
      image: coverImage,
      viewport: game.imageMedia?.cover,
      alt:
        game.mediaAccessibility?.cover ??
        game.mediaAccessibility?.card ??
        game.imageAlt,
      source,
    },
    card: {
      image: cardImage,
      viewport: game.imageMedia?.card,
      alt: game.mediaAccessibility?.card ?? game.imageAlt,
      mode: resolveGameDestinationMediaMode(game, "card"),
      preview: resolveGameCardPreview(game),
    },
  };
}
