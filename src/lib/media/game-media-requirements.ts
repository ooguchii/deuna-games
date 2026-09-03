import type {
  Game,
  GameImageViewport,
  GameVideoViewport,
  GameVideoViewportAspect,
} from "@/types/game";

export const REQUIRED_DESTINATION_ASPECTS = {
  cover: "4:5",
  hero: "16:9",
  card: "3:2",
} as const;

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

export function evaluateGameMediaRequirements(game: Game) {
  const heroVideo = game.videoMedia?.hero;
  const cardVideo = game.videoMedia?.card;
  const heroUsesVideo = Boolean(heroVideo);
  const heroUsesHoverVideo = heroVideo?.playback === "hover";

  const coverAssigned = Boolean(game.coverImage);
  const coverCropReady = coverAssigned && isImageCropConfirmed(game.imageMedia?.cover);

  const heroAssigned = heroUsesVideo
    ? Boolean(heroVideo?.clip) && (!heroUsesHoverVideo || Boolean(game.heroImage))
    : Boolean(game.heroImage);
  const heroCropReady = heroUsesVideo
    ? Boolean(heroVideo?.clip) &&
      isVideoCropConfirmed(
        heroVideo?.viewport,
        REQUIRED_DESTINATION_ASPECTS.hero
      ) &&
      (!heroUsesHoverVideo || isImageCropConfirmed(game.imageMedia?.hero))
    : Boolean(game.heroImage) && isImageCropConfirmed(game.imageMedia?.hero);

  const cardAssigned = Boolean(cardVideo || game.coverImage);
  const cardCropReady = cardVideo
    ? isVideoCropConfirmed(
        cardVideo.viewport,
        REQUIRED_DESTINATION_ASPECTS.card
      )
    : Boolean(game.coverImage) && isImageCropConfirmed(game.imageMedia?.card);

  const galleryReady = Boolean(game.screenshots?.length);

  return {
    cover: {
      assigned: coverAssigned,
      cropReady: coverCropReady,
      aspect: REQUIRED_DESTINATION_ASPECTS.cover,
    },
    hero: {
      assigned: heroAssigned,
      cropReady: heroCropReady,
      aspect: REQUIRED_DESTINATION_ASPECTS.hero,
    },
    card: {
      assigned: cardAssigned,
      cropReady: cardCropReady,
      aspect: REQUIRED_DESTINATION_ASPECTS.card,
    },
    gallery: {
      assigned: galleryReady,
      minimum: 1,
    },
    ready: coverCropReady && heroCropReady && cardCropReady && galleryReady,
  };
}
