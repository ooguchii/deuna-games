import {
  DEFAULT_PREVIEW_VIEWPORT,
  parsePreviewViewport,
  type PreviewViewport,
} from "./preview-video-policy";

import type {
  Game,
  GameCardVideo,
  GameDestinationMediaMode,
  GameHeroVideoPlayback,
  GameVideoMedia,
  GameVideoViewport,
} from "@/types/game";

export type GameVideoTarget = "cover" | "hero" | "card";
export type GameCardVideoSource = "hero" | "independent";

export type ResolvedGameVideo = {
  src: string;
  viewport: GameVideoViewport;
  source: GameCardVideoSource | "cover" | "hero" | "legacy";
};

export const DEFAULT_GAME_MEDIA_MODES = {
  cover: "video",
  hero: "hover-video",
  card: "hover-video",
} as const satisfies Record<GameVideoTarget, GameDestinationMediaMode>;

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

export function resolveGameDestinationImage(
  game: Game,
  target: GameVideoTarget
) {
  if (target === "cover") return game.coverImage;
  if (target === "hero") return game.heroImage;
  return game.cardImage ?? game.coverImage;
}

export function resolveGameDestinationMediaMode(
  game: Game,
  target: GameVideoTarget
): GameDestinationMediaMode {
  const explicit = game.mediaModes?.[target];
  if (explicit) return explicit;

  const video = target === "cover"
    ? game.videoMedia?.cover
    : target === "hero"
      ? game.videoMedia?.hero
      : game.videoMedia?.card;
  if (video) {
    return video.playback === "hover" ? "hover-video" : "video";
  }

  if (resolveGameDestinationImage(game, target)) return "image";
  return DEFAULT_GAME_MEDIA_MODES[target];
}

export function resolveGameHeroVideoPlayback(
  game: Game
): GameHeroVideoPlayback {
  return resolveGameDestinationMediaMode(game, "hero") === "hover-video"
    ? "hover"
    : "always";
}

export function resolveGameCoverVideo(
  game: Game
): ResolvedGameVideo | undefined {
  const cover = game.videoMedia?.cover;
  if (!cover?.clip) return undefined;

  return {
    src: cover.clip,
    viewport: normalizeGameVideoViewport(cover.viewport),
    source: "cover",
  };
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
): Pick<Game, "videoMedia" | "previewClip" | "mediaModes"> {
  const normalizedViewport = normalizeGameVideoViewport(viewport);
  const current = game.videoMedia;

  if (target === "cover") {
    return {
      videoMedia: {
        ...current,
        cover: {
          clip,
          viewport: normalizedViewport,
          playback: "always",
        },
      },
      mediaModes: {
        ...game.mediaModes,
        cover: "video",
      },
      previewClip: game.previewClip,
    };
  }

  if (target === "hero") {
    let card = current?.card;

    if (!card) {
      card = game.previewClip
        ? {
            source: "independent",
            clip: game.previewClip,
            viewport: defaultViewport(),
          }
        : undefined;
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
      mediaModes: {
        ...game.mediaModes,
        hero: "video",
      },
      previewClip: game.previewClip,
    };
  }

  const card: GameCardVideo = {
    source: "independent",
    clip,
    viewport: normalizedViewport,
    playback: "always",
  };

  return {
    videoMedia: {
      ...current,
      card,
    },
    mediaModes: {
      ...game.mediaModes,
      card: "video",
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

  if (target === "cover") {
    if (!current?.cover) return null;
    return {
      ...current,
      cover: {
        ...current.cover,
        viewport: normalizedViewport,
      },
    };
  }

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
        playback: current.card?.playback,
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
      playback: current.card?.playback,
    },
  };
}

export function withoutGameVideoTarget(
  game: Game,
  target: GameVideoTarget
): Pick<Game, "videoMedia" | "previewClip"> {
  const current = game.videoMedia;

  if (target === "cover") {
    const videoMedia = current
      ? { ...current, cover: undefined }
      : undefined;
    return {
      videoMedia:
        videoMedia?.hero || videoMedia?.card
          ? videoMedia
          : undefined,
      previewClip: game.previewClip,
    };
  }

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
          playback: card.playback,
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
      videoMedia.cover || videoMedia.hero || videoMedia.card
        ? videoMedia
        : undefined,
    previewClip: game.previewClip,
  };
}