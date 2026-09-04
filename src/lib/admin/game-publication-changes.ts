import type { Game } from "@/types/game";

export type GamePublicationChangeSection =
  | "ficha"
  | "datos"
  | "requisitos"
  | "rendimiento"
  | "multimedia"
  | "descargas"
  | "valoracion";

export type GamePublicationChange = {
  id: string;
  label: string;
  detail: string;
  section: GamePublicationChangeSection;
};

function serialized(value: unknown) {
  return JSON.stringify(value ?? null);
}

function changed(current: unknown, published: unknown) {
  return serialized(current) !== serialized(published);
}

function multimediaState(game: Game) {
  return {
    coverImage: game.coverImage,
    heroImage: game.heroImage,
    cardImage: game.cardImage,
    detailImage: game.detailImage,
    backgroundImage: game.backgroundImage,
    screenshots: game.screenshots,
    galleryMedia: game.galleryMedia,
    imageMedia: game.imageMedia,
    mediaModes: game.mediaModes,
    videoMedia: game.videoMedia,
    previewMode: game.previewMode,
    previewClip: game.previewClip,
    youtubePreview: game.youtubePreview,
    directPreview: game.directPreview,
  };
}

export function evaluateGamePublicationChanges(
  draft: Game,
  published: Game | null
): GamePublicationChange[] {
  if (!published) {
    return [
      {
        id: "new-game",
        label: "Juego completo",
        detail:
          "Es la primera publicación: se creará un snapshot público con la ficha completa del borrador actual.",
        section: "ficha",
      },
    ];
  }

  const changes: GamePublicationChange[] = [];

  if (
    changed(
      {
        title: draft.title,
        description: draft.description,
        shortTitle: draft.shortTitle,
        highlightedTitle: draft.highlightedTitle,
        developer: draft.developer,
        publisher: draft.publisher,
        releaseDate: draft.releaseDate,
        version: draft.version,
        badge: draft.badge,
        imageAlt: draft.imageAlt,
      },
      {
        title: published.title,
        description: published.description,
        shortTitle: published.shortTitle,
        highlightedTitle: published.highlightedTitle,
        developer: published.developer,
        publisher: published.publisher,
        releaseDate: published.releaseDate,
        version: published.version,
        badge: published.badge,
        imageAlt: published.imageAlt,
      }
    )
  ) {
    changes.push({
      id: "information",
      label: "Información e identidad",
      detail:
        "Cambian título, descripción, autoría, fecha, versión, insignia o texto alternativo general.",
      section: "ficha",
    });
  }

  if (
    changed(
      {
        category: draft.category,
        genres: draft.genres,
        tags: draft.tags,
      },
      {
        category: published.category,
        genres: published.genres,
        tags: published.tags,
      }
    )
  ) {
    changes.push({
      id: "classification",
      label: "Clasificación",
      detail:
        "Cambian la clasificación principal, las adicionales o las etiquetas del juego.",
      section: "datos",
    });
  }

  if (
    changed(
      {
        platforms: draft.platforms,
        requirements: draft.requirements,
      },
      {
        platforms: published.platforms,
        requirements: published.requirements,
      }
    )
  ) {
    changes.push({
      id: "compatibility",
      label: "Compatibilidad",
      detail:
        "Cambian plataformas confirmadas o requisitos mínimos/recomendados.",
      section: "requisitos",
    });
  }

  if (changed(draft.performance, published.performance)) {
    changes.push({
      id: "performance",
      label: "Rendimiento",
      detail:
        "Cambia la calibración usada para estimar FPS según la PC del visitante.",
      section: "rendimiento",
    });
  }

  if (changed(multimediaState(draft), multimediaState(published))) {
    changes.push({
      id: "media",
      label: "Multimedia",
      detail:
        "Cambian recursos, modos, recortes, orden de Galería o videos multimedia que se mostrarán en las superficies públicas.",
      section: "multimedia",
    });
  }

  if (changed(draft.download, published.download)) {
    changes.push({
      id: "downloads",
      label: "Distribución",
      detail:
        "Cambian las fuentes, disponibilidad, tamaño, plataforma u otros datos de descarga.",
      section: "descargas",
    });
  }

  if (
    changed(
      {
        rating: draft.rating,
        reviews: draft.reviews,
      },
      {
        rating: published.rating,
        reviews: published.reviews,
      }
    )
  ) {
    changes.push({
      id: "valuation",
      label: "Valoración",
      detail:
        "Cambia la valoración editorial o un contador histórico conservado por compatibilidad.",
      section: "valoracion",
    });
  }

  return changes;
}
