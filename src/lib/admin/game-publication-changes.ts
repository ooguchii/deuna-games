import type { Game } from "@/types/game";

export type GamePublicationChangeSection =
  | "ficha"
  | "datos"
  | "requisitos"
  | "multimedia"
  | "descargas";

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
        category: draft.category,
        version: draft.version,
        badge: draft.badge,
        rating: draft.rating,
        reviews: draft.reviews,
        imageAlt: draft.imageAlt,
      },
      {
        title: published.title,
        description: published.description,
        category: published.category,
        version: published.version,
        badge: published.badge,
        rating: published.rating,
        reviews: published.reviews,
        imageAlt: published.imageAlt,
      }
    )
  ) {
    changes.push({
      id: "core",
      label: "Ficha principal",
      detail:
        "Cambian datos de presentación como título, descripción, categoría, versión, valoración o texto alternativo.",
      section: "ficha",
    });
  }

  if (
    changed(
      {
        shortTitle: draft.shortTitle,
        highlightedTitle: draft.highlightedTitle,
        developer: draft.developer,
        publisher: draft.publisher,
        releaseDate: draft.releaseDate,
        genres: draft.genres,
        tags: draft.tags,
        platforms: draft.platforms,
      },
      {
        shortTitle: published.shortTitle,
        highlightedTitle: published.highlightedTitle,
        developer: published.developer,
        publisher: published.publisher,
        releaseDate: published.releaseDate,
        genres: published.genres,
        tags: published.tags,
        platforms: published.platforms,
      }
    )
  ) {
    changes.push({
      id: "identity",
      label: "Datos e identidad",
      detail:
        "Cambian desarrollador, editor, fecha, géneros, etiquetas, plataformas o variantes del título.",
      section: "datos",
    });
  }

  if (changed(draft.requirements, published.requirements)) {
    changes.push({
      id: "requirements",
      label: "Requisitos",
      detail:
        "Cambian los requisitos mínimos o recomendados que usa la ficha técnica.",
      section: "requisitos",
    });
  }

  if (
    changed(
      {
        coverImage: draft.coverImage,
        heroImage: draft.heroImage,
        screenshots: draft.screenshots,
      },
      {
        coverImage: published.coverImage,
        heroImage: published.heroImage,
        screenshots: published.screenshots,
      }
    )
  ) {
    changes.push({
      id: "media",
      label: "Multimedia",
      detail:
        "Cambian la portada, la imagen hero o las capturas que verá el visitante.",
      section: "multimedia",
    });
  }

  if (changed(draft.download, published.download)) {
    changes.push({
      id: "downloads",
      label: "Descargas",
      detail:
        "Cambian las fuentes, disponibilidad, tamaño, plataforma u otros datos de descarga.",
      section: "descargas",
    });
  }

  return changes;
}
