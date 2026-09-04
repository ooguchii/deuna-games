import "server-only";

import {
  listGameImageReferences,
  listGameVideoReferences,
} from "@/lib/admin/game-media-integrity";
import type {
  EditorialMediaLibraryResource,
} from "@/lib/media/editorial-media-library";
import {
  resolveGameGalleryItems,
} from "@/lib/media/game-gallery-media";
import {
  resolveGameBackgroundMediaMode,
} from "@/lib/media/game-media-requirements";
import {
  resolveGameDestinationImage,
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type { Game } from "@/types/game";

export type GameMediaResourceHygieneStatus =
  | "active"
  | "reserved"
  | "published-only"
  | "historical"
  | "unused";

export type GameMediaResourceHygiene = {
  src: string;
  kind: "image" | "video";
  origin: "editorial" | "bundled";
  status: GameMediaResourceHygieneStatus;
  usage: string[];
  blocksPublication: boolean;
};

export type GameMediaHygieneResult = {
  ready: boolean;
  total: number;
  active: number;
  reserved: number;
  publishedOnly: number;
  historical: number;
  unused: number;
  blockingCount: number;
  blocking: GameMediaResourceHygiene[];
  resources: GameMediaResourceHygiene[];
};

function pushUnique(labels: string[], label: string) {
  if (!labels.includes(label)) labels.push(label);
}

function activeUsageLabels(
  game: Game,
  kind: "image" | "video",
  src: string
) {
  const labels: string[] = [];
  const coverMode = resolveGameDestinationMediaMode(game, "cover");
  const heroMode = resolveGameDestinationMediaMode(game, "hero");
  const cardMode = resolveGameDestinationMediaMode(game, "card");
  const detailMode = resolveGameDestinationMediaMode(game, "detail");
  const backgroundMode = resolveGameBackgroundMediaMode(game);

  if (kind === "image") {
    if (coverMode !== "video" && game.coverImage === src) {
      pushUnique(labels, coverMode === "hover-video" ? "Portada base" : "Portada");
    }
    if (heroMode !== "video" && game.heroImage === src) {
      pushUnique(labels, heroMode === "hover-video" ? "Hero base" : "Hero");
    }
    if (cardMode !== "video" && game.cardImage === src) {
      pushUnique(labels, cardMode === "hover-video" ? "Card base" : "Card");
    }

    const detailImage = resolveGameDestinationImage(game, "detail");
    if (detailMode !== "video" && detailImage === src) {
      pushUnique(
        labels,
        detailMode === "hover-video"
          ? "Contenedor base"
          : "Contenedor"
      );
    }

    if (
      backgroundMode &&
      backgroundMode !== "video" &&
      game.backgroundImage === src
    ) {
      pushUnique(
        labels,
        backgroundMode === "hover-video"
          ? "Fondo base"
          : "Fondo"
      );
    }
  } else {
    const coverClip = game.videoMedia?.cover?.clip;
    const heroClip = game.videoMedia?.hero?.clip;
    const cardVideo = game.videoMedia?.card;
    const cardClip = cardVideo?.source === "hero"
      ? heroClip
      : cardVideo?.clip;
    const detailClip = game.videoMedia?.detail?.clip;
    const backgroundClip = game.videoMedia?.background?.clip;

    if (coverMode !== "image" && coverClip === src) {
      pushUnique(labels, coverMode === "hover-video" ? "Portada hover" : "Portada");
    }
    if (heroMode !== "image" && heroClip === src) {
      pushUnique(labels, heroMode === "hover-video" ? "Hero hover" : "Hero");
    }
    if (cardMode !== "image" && cardClip === src) {
      pushUnique(labels, cardMode === "hover-video" ? "Card hover" : "Card");
    }
    if (detailMode !== "image" && detailClip === src) {
      pushUnique(
        labels,
        detailMode === "hover-video"
          ? "Contenedor hover"
          : "Contenedor"
      );
    }
    if (
      backgroundMode &&
      backgroundMode !== "image" &&
      backgroundClip === src
    ) {
      pushUnique(
        labels,
        backgroundMode === "hover-video"
          ? "Fondo hover"
          : "Fondo"
      );
    }

    if (game.previewClip === src) {
      pushUnique(labels, "Vista previa legacy");
    }
  }

  for (const item of resolveGameGalleryItems(game)) {
    if (item.kind === kind && item.src === src) {
      pushUnique(labels, "Galería");
    }
  }

  return labels;
}

export function evaluateGameMediaHygiene(
  game: Game,
  resources: readonly EditorialMediaLibraryResource[],
  publishedReferences: readonly string[],
  historicalReferences: readonly string[] = []
): GameMediaHygieneResult {
  const draftReferences = new Set([
    ...listGameImageReferences(game),
    ...listGameVideoReferences(game),
  ]);
  const published = new Set(publishedReferences);
  const historical = new Set(historicalReferences);

  const classified = resources.map((resource): GameMediaResourceHygiene => {
    const usage = activeUsageLabels(game, resource.kind, resource.src);
    const draftReferenced = draftReferences.has(resource.src);
    const publishedReferenced = published.has(resource.src);
    const historicalReferenced = historical.has(resource.src);

    let status: GameMediaResourceHygieneStatus;
    if (usage.length > 0) {
      status = "active";
    } else if (draftReferenced) {
      status = "reserved";
    } else if (publishedReferenced) {
      status = "published-only";
    } else if (historicalReferenced) {
      status = "historical";
    } else {
      status = "unused";
    }

    // Sólo un master editorial sin referencia alguna es basura. Un recurso
    // del snapshot público o del historial sigue teniendo una función real:
    // sostener la web actual o permitir una restauración verificable.
    const blocksPublication =
      resource.origin === "editorial" &&
      status === "unused";

    return {
      src: resource.src,
      kind: resource.kind,
      origin: resource.origin,
      status,
      usage: usage.length
        ? usage
        : status === "reserved"
          ? ["Reserva del borrador"]
          : status === "published-only"
            ? ["Publicación actual"]
            : status === "historical"
              ? ["Historial restaurable"]
              : [],
      blocksPublication,
    };
  });

  const blocking = classified.filter((resource) => resource.blocksPublication);

  return {
    ready: blocking.length === 0,
    total: classified.length,
    active: classified.filter((resource) => resource.status === "active").length,
    reserved: classified.filter((resource) => resource.status === "reserved").length,
    publishedOnly: classified.filter((resource) => resource.status === "published-only").length,
    historical: classified.filter((resource) => resource.status === "historical").length,
    unused: classified.filter((resource) => resource.status === "unused").length,
    blockingCount: blocking.length,
    blocking,
    resources: classified,
  };
}
