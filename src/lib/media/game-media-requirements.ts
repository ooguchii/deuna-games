import {
  isGameGalleryItemConfirmed,
  resolveGameGalleryItems,
} from "./game-gallery-media";
import {
  isCustomCoverDistinctFromCard,
  resolveGameCardArtwork,
  viewportMatchesImageSource,
} from "./game-card-artwork";
import {
  resolveGameDestinationImage,
  resolveGameDestinationMediaMode,
} from "./game-video-media";

import type {
  Game,
  GameDestinationMediaMode,
  GameImageViewport,
  GameImageViewportAspect,
  GameVideoViewport,
  GameVideoViewportAspect,
} from "@/types/game";

export const REQUIRED_DESTINATION_ASPECTS = {
  cover: "4:5",
  hero: "3:1",
  card: "3:2",
} as const;

export const LEGACY_DESTINATION_IMAGE_ASPECTS = {
  cover: "4:5",
  hero: "16:9",
  card: "3:2",
} as const satisfies Record<keyof typeof REQUIRED_DESTINATION_ASPECTS, GameImageViewportAspect>;

export const GAME_DETAIL_VIEWPORT_ASPECT = "source" as const;
export const GAME_BACKGROUND_VIEWPORT_ASPECT = "source" as const;

export type RequiredMediaDestination = keyof typeof REQUIRED_DESTINATION_ASPECTS;

export function isImageCropConfirmed(
  viewport: GameImageViewport | undefined,
  requiredAspect?: GameImageViewportAspect,
  legacyAspect?: GameImageViewportAspect,
  imageSource?: string
) {
  if (viewport?.confirmed !== true) return false;
  if (imageSource && !viewportMatchesImageSource(viewport, imageSource)) {
    return false;
  }
  if (!requiredAspect) return true;
  const effectiveAspect = viewport.aspect ?? legacyAspect;
  return effectiveAspect === requiredAspect;
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
  videoAspect: GameVideoViewportAspect,
  imageAspect?: GameImageViewportAspect,
  legacyImageAspect?: GameImageViewportAspect,
  imageSource?: string
) {
  const imageReady = imageAssigned && isImageCropConfirmed(
    imageViewport,
    imageAspect,
    legacyImageAspect,
    imageSource
  );
  const videoReady = videoAssigned && isVideoCropConfirmed(videoViewport, videoAspect);

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

function cardRequirement(
  mode: "image" | "video" | "hover-video",
  imageAssigned: boolean,
  imageViewport: GameImageViewport | undefined,
  imageSource: string | undefined,
  videoAssigned: boolean,
  videoViewport: GameVideoViewport | undefined
) {
  const imageReady = imageAssigned && isImageCropConfirmed(
    imageViewport,
    REQUIRED_DESTINATION_ASPECTS.card,
    LEGACY_DESTINATION_IMAGE_ASPECTS.card,
    imageSource
  );
  const videoReady = videoAssigned && isVideoCropConfirmed(
    videoViewport,
    REQUIRED_DESTINATION_ASPECTS.card
  );

  if (mode === "image") {
    return { assigned: imageAssigned, cropReady: imageReady };
  }

  // Video enriches a Card but never replaces its static base. The image is the
  // poster/fallback and is what touch/reduced-motion can render safely.
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
  const heroMode = resolveGameDestinationMediaMode(game, "hero");
  const cardMode = resolveGameDestinationMediaMode(game, "card");
  const detailMode = resolveGameDestinationMediaMode(game, "detail");
  const backgroundMode = resolveGameBackgroundMediaMode(game);
  const artwork = resolveGameCardArtwork(game);

  // Portada sigue siendo image-only. En modo shared resuelve la imagen base de
  // Card; en custom exige un recurso realmente distinto para que la excepción
  // tenga intención editorial inequívoca.
  const coverAssigned = Boolean(artwork.coverImage) &&
    isCustomCoverDistinctFromCard(game);
  const cover = {
    assigned: coverAssigned,
    cropReady: coverAssigned && isImageCropConfirmed(
      artwork.coverViewport,
      REQUIRED_DESTINATION_ASPECTS.cover,
      LEGACY_DESTINATION_IMAGE_ASPECTS.cover,
      artwork.coverImage
    ),
  };

  const hero = destinationRequirement(
    heroMode,
    Boolean(game.heroImage),
    game.imageMedia?.hero,
    Boolean(game.videoMedia?.hero?.clip),
    game.videoMedia?.hero?.viewport,
    REQUIRED_DESTINATION_ASPECTS.hero,
    REQUIRED_DESTINATION_ASPECTS.hero,
    LEGACY_DESTINATION_IMAGE_ASPECTS.hero,
    game.heroImage
  );

  const cardVideo = game.videoMedia?.card;
  const cardClipAssigned = cardVideo?.source === "hero"
    ? Boolean(game.videoMedia?.hero?.clip)
    : Boolean(cardVideo?.clip);
  const card = cardRequirement(
    cardMode,
    Boolean(artwork.cardImage),
    artwork.cardViewport,
    artwork.cardImage,
    cardClipAssigned,
    cardVideo?.viewport
  );

  const detailImage = resolveGameDestinationImage(game, "detail");
  const legacyDetailViewport = !game.detailImage
    ? game.heroImage
      ? game.imageMedia?.hero
      : game.imageMedia?.cover
    : undefined;
  const detail = destinationRequirement(
    detailMode,
    Boolean(detailImage),
    game.imageMedia?.detail ?? legacyDetailViewport,
    Boolean(game.videoMedia?.detail?.clip),
    game.videoMedia?.detail?.viewport,
    GAME_DETAIL_VIEWPORT_ASPECT,
    undefined,
    undefined,
    detailImage
  );

  const background = backgroundMode
    ? destinationRequirement(
        backgroundMode,
        Boolean(game.backgroundImage),
        game.imageMedia?.background,
        Boolean(game.videoMedia?.background?.clip),
        game.videoMedia?.background?.viewport,
        GAME_BACKGROUND_VIEWPORT_ASPECT,
        undefined,
        undefined,
        game.backgroundImage
      )
    : { assigned: true, cropReady: true };

  const galleryItems = resolveGameGalleryItems(game);
  const galleryAssigned = galleryItems.length > 0;
  const galleryCropReady = galleryAssigned && galleryItems.every(
    (item) => isGameGalleryItemConfirmed(game, item)
  );

  return {
    cover: {
      ...cover,
      source: artwork.coverImageSource,
      mode: "image" as const,
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
    detail: {
      ...detail,
      mode: detailMode,
      aspect: "adaptive" as const,
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
      count: galleryItems.length,
      imageCount: galleryItems.filter((item) => item.kind === "image").length,
      videoCount: galleryItems.filter((item) => item.kind === "video").length,
    },
    ready:
      cover.cropReady &&
      hero.cropReady &&
      card.cropReady &&
      detail.cropReady &&
      background.cropReady &&
      galleryCropReady,
  };
}
