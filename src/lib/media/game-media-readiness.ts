import { resolveGameCardVideo } from "./game-video-media";

import type {
  Game,
  GameMediaCropConfirmation,
  GameRequiredCropAspect,
} from "@/types/game";

export const REQUIRED_GAME_MEDIA_CROPS = {
  cover: "4:5",
  hero: "16:9",
  card: "4:5",
} as const satisfies Record<
  "cover" | "hero" | "card",
  GameRequiredCropAspect
>;

export type RequiredGameMediaCropTarget =
  keyof typeof REQUIRED_GAME_MEDIA_CROPS;

export type GameMediaRequirementState = {
  target: RequiredGameMediaCropTarget;
  aspect: GameRequiredCropAspect;
  resource: string | null;
  confirmed: boolean;
};

export type GameMediaReadiness = {
  crops: Record<
    RequiredGameMediaCropTarget,
    GameMediaRequirementState
  >;
  galleryReady: boolean;
  complete: boolean;
  pendingCount: number;
};

export function resolveRequiredGameMediaResource(
  game: Game,
  target: RequiredGameMediaCropTarget
) {
  if (target === "cover") {
    return game.coverImage?.trim() || null;
  }

  if (target === "hero") {
    return game.videoMedia?.hero?.clip?.trim()
      || game.heroImage?.trim()
      || null;
  }

  return resolveGameCardVideo(game)?.src?.trim()
    || game.coverImage?.trim()
    || null;
}

export function mediaCropConfirmation(
  resource: string,
  aspect: GameRequiredCropAspect
): GameMediaCropConfirmation {
  return { resource, aspect };
}

export function isGameMediaCropConfirmed(
  game: Game,
  target: RequiredGameMediaCropTarget
) {
  const resource = resolveRequiredGameMediaResource(game, target);
  if (!resource) return false;

  const expectedAspect = REQUIRED_GAME_MEDIA_CROPS[target];
  const confirmation = game.mediaSetup?.crops?.[target];

  return Boolean(
    confirmation &&
      confirmation.resource === resource &&
      confirmation.aspect === expectedAspect
  );
}

export function evaluateGameMediaReadiness(
  game: Game
): GameMediaReadiness {
  const cropTargets = Object.keys(
    REQUIRED_GAME_MEDIA_CROPS
  ) as RequiredGameMediaCropTarget[];

  const crops = Object.fromEntries(
    cropTargets.map((target) => {
      const resource = resolveRequiredGameMediaResource(game, target);
      return [
        target,
        {
          target,
          aspect: REQUIRED_GAME_MEDIA_CROPS[target],
          resource,
          confirmed: isGameMediaCropConfirmed(game, target),
        },
      ];
    })
  ) as GameMediaReadiness["crops"];

  const galleryReady = Boolean(game.screenshots?.length);
  const pendingCount = cropTargets.filter(
    (target) => !crops[target].confirmed
  ).length + (galleryReady ? 0 : 1);

  return {
    crops,
    galleryReady,
    complete: pendingCount === 0,
    pendingCount,
  };
}