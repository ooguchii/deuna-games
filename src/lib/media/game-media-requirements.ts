import {
  resolveGameDestinationMediaMode,
} from "./game-video-media";

import type {
  Game,
  GameDestinationMediaMode,
  GameImageViewport,
  GameVideoViewport,
  GameVideoViewportAspect,
} from "@/types/game";

export const REQUIRED_DESTINATION_ASPECTS = {
  cover: "4:5",
  hero: "16:9",
  card: "3:2",
} as const;

export const GAME_BACKGROUND_VIEWPORT_ASPECT = "source" as const;

export type RequiredMediaDestination = keyof typeof REQUIRED_DESTINATION_ASPECTS;

export function isImageCropConfirmed(viewport: GameImageViewport | undefined) {
  return viewport?.confirmed === true;
}

export function isVideoCropConfirmed(
  viewport: GameVideoViewport | undefined,
  requiredAspect?: GameVideoViewportAspect
) {
  return viewport?.confirmed === true &&
    (!requiredAspect || viewport.aspect === requiredAspect);
}

function destinationRequirement(
  mode: "image" | "video" | "hover-video",
  imageAssigned: boolean,
  imageViewport: GameImageViewport | undefined,
  videoAssigned: boolean,
  videoViewport: GameVideoViewport | undefined,
  aspect: GameVideoViewportAspect
) {
  const imageReady = imageAssigned && isImageCropConfirmed(imageViewport);
  const videoReady = videoAssigned && isVideoCropConfirmed(videoViewport, aspect);

  if (mode === "image") {
    return { assigned: imageAssigned, cropReady: imageReady };
  }
  if (mode === "video") {
    return { assigned: videoAssigned, cropReady: videoReady };
  }
  return {
    assigned: imageAssigned && videoAssigned,
    cropReady: imageReady && videoReady,
  };
}

export function resolveGameBackgroundMediaMode(
  game: Game
): GameDestinationMediaMode | null {
  const explicit = game.mediaModes?.background;
  if (explicit) return explicit;

  const video = game.videoMedia?.background;
  if (video) {
    return video.playback === "hover" ? "hover-video" : "video";
  }

  if (game.backgroundImage) return "image";
  return null;
}

export function evaluateGameMediaRequirements(game: Game) {
  const coverMode = resolveGameDestinationMediaMode(game, "cover");
  const heroMode = resolveGameDestinationMediaMode(game, "hero");
  const cardMode = resolveGameDestinationMediaMode(game, "card");
  const backgroundMode = resolveGameBackgroundMediaMode(game);

  const cover = destinationRequirement(
    coverMode,
    Boolean(game.coverImage),
    game.imageMedia?.cover,
    Boolean(game.videoMedia?.cover?.clip),
    game.videoMedia?.cover?.viewport,
    REQUIRED_DESTINATION_ASPECTS.cover
  );

  const hero = destinationRequirement(
    heroMode,
    Boolean(game.heroImage),
    game.imageMedia?.hero,
    Boolean(game.videoMedia?.hero?.clip),
    game.videoMedia?.hero?.viewport,
    REQUIRED_DESTINATION_ASPECTS.hero
  );

  const cardVideo = game.videoMedia?.card;
  const cardClipAssigned = cardVideo?.source === "hero"
    ? Boolean(game.videoMedia?.hero?.clip)
    : Boolean(cardVideo?.clip);
  const card = destinationRequirement(
    cardMode,
    Boolean(game.cardImage),
    game.imageMedia?.card,
    cardClipAssigned,
    cardVideo?.viewport,
    REQUIRED_DESTINATION_ASPECTS.card
  );

  const background = backgroundMode
    ? destinationRequirement(
        backgroundMode,
        Boolean(game.backgroundImage),
        game.imageMedia?.background,
        Boolean(game.videoMedia?.background?.clip),
        game.videoMedia?.background?.viewport,
        GAME_BACKGROUND_VIEWPORT_ASPECT
      )
    : { assigned: true, cropReady: true };

  const screenshots = game.screenshots ?? [];
  const galleryAssigned = screenshots.length > 0;
  const galleryCropReady = galleryAssigned && screenshots.every(
    (src) => isImageCropConfirmed(game.imageMedia?.gallery?.[src])
  );

  return {
    cover: {
      ...cover,
      mode: coverMode,
      aspect: REQUIRED_DESTINATION_ASPECTS.cover,
    },
    hero: {
      ...hero,
      mode: heroMode,
      aspect: REQUIRED_DESTINATION_ASPECTS.hero,
    },
    card: {
      ...card,
      mode: cardMode,
      aspect: REQUIRED_DESTINATION_ASPECTS.card,
    },
    background: {
      ...background,
      active: backgroundMode !== null,
      mode: backgroundMode,
      aspect: "adaptive" as const,
    },
    gallery: {
      assigned: galleryAssigned,
      cropReady: galleryCropReady,
      minimum: 1,
    },
    ready:
      cover.cropReady &&
      hero.cropReady &&
      card.cropReady &&
      background.cropReady &&
      galleryCropReady,
  };
}
