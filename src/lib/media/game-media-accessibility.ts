import {
  resolveGameCardBaseImage,
  resolveGameCoverImage,
} from "@/lib/media/game-card-presentation";
import {
  resolveGameGalleryItems,
} from "@/lib/media/game-gallery-media";
import type {
  Game,
  GameGalleryItem,
} from "@/types/game";

function galleryKey(item: Pick<GameGalleryItem, "kind" | "src">) {
  return `${item.kind}:${item.src}`;
}

export function getGameGalleryAccessibilityLabel(
  game: Game,
  item: Pick<GameGalleryItem, "kind" | "src">
) {
  const key = galleryKey(item);
  return game.mediaAccessibility?.gallery?.find(
    (entry) => galleryKey(entry) === key
  )?.label;
}

export function getGameGalleryAccessibleFallback(
  game: Game,
  item: Pick<GameGalleryItem, "kind" | "src">,
  index: number
) {
  return getGameGalleryAccessibilityLabel(game, item) ??
    `${game.title} — ${item.kind === "image" ? "imagen" : "video"} ${index + 1}`;
}

export function hasCompleteContextualMediaAccessibility(game: Game) {
  const gallery = resolveGameGalleryItems(game);
  const labels = game.mediaAccessibility;
  const coverImage = resolveGameCoverImage(game);
  const cardImage = resolveGameCardBaseImage(game);
  const coverReady = !coverImage || Boolean(labels?.cover?.trim());
  const cardReady = !cardImage || Boolean(labels?.card?.trim());
  const galleryReady = gallery.every(
    (item) => Boolean(getGameGalleryAccessibilityLabel(game, item)?.trim())
  );

  return coverReady && cardReady && galleryReady;
}
