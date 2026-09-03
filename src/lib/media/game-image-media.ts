import type {
  Game,
  GameImageMedia,
} from "@/types/game";

type GameImageAssignments = Pick<
  Game,
  "coverImage" | "heroImage" | "screenshots"
>;

function compactImageMedia(
  imageMedia: GameImageMedia
): GameImageMedia | undefined {
  return imageMedia.cover ||
    imageMedia.hero ||
    imageMedia.card ||
    imageMedia.gallery
    ? imageMedia
    : undefined;
}

export function reconcileGameImageMedia(
  game: Game,
  assignments: GameImageAssignments
): GameImageMedia | undefined {
  const imageMedia: GameImageMedia = {
    ...game.imageMedia,
  };

  if (game.coverImage !== assignments.coverImage) {
    delete imageMedia.cover;
    delete imageMedia.card;
  }

  if (game.heroImage !== assignments.heroImage) {
    delete imageMedia.hero;
  }

  const assignedGallery = new Set(
    assignments.screenshots ?? []
  );
  const gallery = Object.fromEntries(
    Object.entries(imageMedia.gallery ?? {}).filter(
      ([resource]) => assignedGallery.has(resource)
    )
  );

  if (Object.keys(gallery).length > 0) {
    imageMedia.gallery = gallery;
  } else {
    delete imageMedia.gallery;
  }

  return compactImageMedia(imageMedia);
}
