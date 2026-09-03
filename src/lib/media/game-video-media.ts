import {
  DEFAULT_PREVIEW_VIEWPORT,
  parsePreviewViewport,
  type PreviewViewport,
} from "./preview-video-policy";

import type {
  Game,
  GameCardVideo,
  GameHeroVideoPlayback,
  GameVideoMedia,
  GameVideoViewport,
} from "@/types/game";

export type GameVideoTarget = "hero" | "card";
export type GameCardVideoSource = "hero" | "independent";

export type ResolvedGameVideo = {
  src: string;
  viewport: GameVideoViewport;
  source: GameCardVideoSource | "hero" | "legacy";
};

function defaultViewport(): GameVideoViewport {
  return { ...DEFAULT_PREVIEW_VIEWPORT };
}

export function normalizeGameVideoViewport(
  viewport: GameVideoViewport | PreviewViewport | undefined
): GameVideoViewport {
  if (!viewport) return defaultViewport();

  const parsed = parsePreviewViewport(
    String(viewport.x),
    String(viewport.y),
    String(viewport.zoom),
    viewport.aspect
  );
  if (!parsed) return defaultViewport();

  return {
    ...parsed,
    ...(Boolean((viewport as GameVideoViewport).confirmed)
      ? { confirmed: true as const }
      : {}),
  };
}

export function resolveGameHeroVideoPlayback(
  game: Game
): GameHeroVideoPlayback {
  return game.videoMedia?.hero?.playback === "hover" ? "hover" : "always";
}

export function resolveGameHeroVideo(
  game: Game
): ResolvedGameVideo | undefined {
  const hero = game.videoMedia?.hero;
  if (!hero?.clip) return undefined;

  return {
    src: hero.clip,
    viewport: normalizeGameVideoViewport(hero.viewport),
    source: "hero",
  };
}

export function resolveGameCardVideo(
  game: Game
): ResolvedGameVideo | undefined {
  const card = game.videoMedia?.card;

  if (card?.source === "hero") {
    const hero = game.videoMedia?.hero;
    if (hero?.clip) {
      return {
        src: hero.clip,
        viewport: normalizeGameVideoViewport(card.viewport),
        source: "hero",
      };
    }
  }

  if (card?.source === "independent" && card.clip) {
    return {
      src: card.clip,
      viewport: normalizeGameVideoViewport(card.viewport),
      source: "independent",
    };
  }

  const legacy = game.previewClip?.trim();
  if (!legacy) return undefined;

  return {
    src: legacy,
    viewport: defaultViewport(),
    source: "legacy",
  };
}

export function withSavedGameVideoClip(
  game: Game,
  target: GameVideoTarget,
  clip: string,
  viewport: PreviewViewport
): Pick<Game, "videoMedia" | "previewClip"> {
  const normalizedViewport = normalizeGameVideoViewport(viewport);
  const current = game.videoMedia;

  if (target === "hero") {
    let card = current?.card;

    if (!card) {
      card = game.previewClip
        ? {
            source: "independent",
            clip: game.previewClip,
            viewport: defaultViewport(),
          }
        : {
            source: "hero",
            viewport: defaultViewport(),
          };
    }

    return {
      videoMedia: {
        ...current,
        hero: {
          clip,
          viewport: normalizedViewport,
          playback: "always",
        },
        card,
      },
      previewClip: game.previewClip,
    };
  }

  const card: GameCardVideo = {
    source: "independent",
    clip,
    viewport: normalizedViewport,
  };

  return {
    videoMedia: {
      ...current,
      card,
    },
    previewClip: clip,
  };
}

export function withGameVideoLayout(
  game: Game,
  target: GameVideoTarget,
  source: GameCardVideoSource,
  viewport: PreviewViewport
): GameVideoMedia | null {
  const normalizedViewport: GameVideoViewport = {
    ...normalizeGameVideoViewport(viewport),
    confirmed: true,
  };
  const current = game.videoMedia;

  if (target === "hero") {
    if (!current?.hero) return null;
    return {
      ...current,
      hero: {
        ...current.hero,
        viewport: normalizedViewport,
      },
    };
  }

  if (source === "hero") {
    if (!current?.hero) return null;
    return {
      ...current,
      card: {
        source: "hero",
        viewport: normalizedViewport,
      },
    };
  }

  const independentClip =
    current?.card?.source === "independent"
      ? current.card.clip
      : game.previewClip;
  if (!independentClip) return null;

  return {
    ...current,
    card: {
      source: "independent",
      clip: independentClip,
      viewport: normalizedViewport,
    },
  };
}

export function withoutGameVideoTarget(
  game: Game,
  target: GameVideoTarget
): Pick<Game, "videoMedia" | "previewClip"> {
  const current = game.videoMedia;

  if (target === "card") {
    return {
      videoMedia: current
        ? {
            ...current,
            card: undefined,
          }
        : undefined,
      previewClip: undefined,
    };
  }

  if (!current?.hero) {
    return {
      videoMedia: current,
      previewClip: game.previewClip,
    };
  }

  let card = current.card;
  if (card?.source === "hero") {
    const fallback = game.previewClip;
    card = fallback
      ? {
          source: "independent",
          clip: fallback,
          viewport: card.viewport,
        }
      : undefined;
  }

  const videoMedia = {
    ...current,
    hero: undefined,
    card,
  };

  return {
    videoMedia:
      videoMedia.hero || videoMedia.card
        ? videoMedia
        : undefined,
    previewClip: game.previewClip,
  };
}