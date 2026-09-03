import {
  resolvePerformanceProfile,
} from "@/features/game-finder/performance-data";
import { evaluateGameMediaRequirements } from "@/lib/media/game-media-requirements";
import type { Game } from "@/types/game";

export type GameReadinessSection =
  | "ficha"
  | "datos"
  | "requisitos"
  | "rendimiento"
  | "multimedia"
  | "descargas";

export type GameReadinessItem = {
  id: string;
  label: string;
  detail: string;
  section: GameReadinessSection;
  complete: boolean;
  priority: "essential" | "recommended";
};

export type GamePublicationReadiness = {
  items: GameReadinessItem[];
  completed: number;
  total: number;
  percentage: number;
  essentialsReady: boolean;
  recommendedMissing: number;
};

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function hasMinimumRequirements(game: Game) {
  const minimum = game.requirements?.minimum ?? game.requirements;

  return Boolean(
    hasText(minimum?.processor) &&
      hasText(minimum?.ram) &&
      hasText(minimum?.graphics)
  );
}

function hasRecommendedRequirements(game: Game) {
  const recommended = game.requirements?.recommended;

  return Boolean(
    hasText(recommended?.processor) &&
      hasText(recommended?.ram) &&
      hasText(recommended?.graphics)
  );
}

function hasVisibleDownload(game: Game) {
  const download = game.download;
  if (!download) return false;

  if (hasText(download.href)) return true;

  return Boolean(
    download.sources?.some(
      (source) =>
        source.enabled !== false &&
        source.status !== "down" &&
        hasText(source.href)
    )
  );
}

export function evaluateGamePublicationReadiness(
  game: Game
): GamePublicationReadiness {
  const media = evaluateGameMediaRequirements(game);
  const items: GameReadinessItem[] = [
    {
      id: "core",
      label: "Ficha principal",
      detail: "Título, descripción, categoría y texto alternativo están completos.",
      section: "ficha",
      complete: Boolean(
        hasText(game.title) &&
          hasText(game.description) &&
          hasText(game.category) &&
          hasText(game.imageAlt)
      ),
      priority: "essential",
    },
    {
      id: "identity",
      label: "Identidad del juego",
      detail: "Desarrollador, editor y fecha de lanzamiento ayudan a completar la ficha pública.",
      section: "datos",
      complete: Boolean(
        hasText(game.developer) &&
          hasText(game.publisher) &&
          hasText(game.releaseDate)
      ),
      priority: "recommended",
    },
    {
      id: "classification",
      label: "Clasificación",
      detail: "Géneros y plataformas permiten filtrar y presentar correctamente el juego.",
      section: "datos",
      complete: Boolean(
        game.genres?.length &&
          game.platforms?.length
      ),
      priority: "recommended",
    },
    {
      id: "minimum-requirements",
      label: "Requisitos mínimos",
      detail: "Procesador, RAM y gráficos mínimos permiten comparar compatibilidad.",
      section: "requisitos",
      complete: hasMinimumRequirements(game),
      priority: "recommended",
    },
    {
      id: "recommended-requirements",
      label: "Requisitos recomendados",
      detail: "Procesador, RAM y gráficos recomendados mejoran la ficha técnica.",
      section: "requisitos",
      complete: hasRecommendedRequirements(game),
      priority: "recommended",
    },
    {
      id: "performance",
      label: "Estimación de FPS",
      detail: "Una calibración editorial o histórica permite adaptar los FPS al hardware de cada visitante.",
      section: "rendimiento",
      complete: Boolean(resolvePerformanceProfile(game.slug, game.performance)),
      priority: "recommended",
    },
    {
      id: "cover-crop",
      label: "Portada · recorte 4:5",
      detail: "La Portada debe completar los recursos exigidos por su modo activo. Imagen + hover requiere confirmar imagen y video; Video sólo exige su video.",
      section: "multimedia",
      complete: media.cover.cropReady,
      priority: "essential",
    },
    {
      id: "hero-crop",
      label: "Hero · recorte 16:9",
      detail: "El Hero debe completar los recursos exigidos por su modo activo. Imagen + hover requiere confirmar imagen y video.",
      section: "multimedia",
      complete: media.hero.cropReady,
      priority: "essential",
    },
    {
      id: "card-crop",
      label: "Card · recorte 3:2",
      detail: "La Card tiene asignación independiente de la Portada y debe completar los recursos y recortes que exija su modo activo.",
      section: "multimedia",
      complete: media.card.cropReady,
      priority: "essential",
    },
    {
      id: "gallery-minimum",
      label: "Galería · mínimo 1 imagen",
      detail: "La Galería del juego debe contener al menos una imagen asignada.",
      section: "multimedia",
      complete: media.gallery.assigned,
      priority: "essential",
    },
    {
      id: "downloads",
      label: "Fuente de descarga",
      detail: "Configura al menos una fuente visible si este juego debe ofrecer descarga.",
      section: "descargas",
      complete: hasVisibleDownload(game),
      priority: "recommended",
    },
  ];

  const completed = items.filter((item) => item.complete).length;
  const essentialsReady = items
    .filter((item) => item.priority === "essential")
    .every((item) => item.complete);
  const recommendedMissing = items.filter(
    (item) => item.priority === "recommended" && !item.complete
  ).length;

  return {
    items,
    completed,
    total: items.length,
    percentage: Math.round((completed / items.length) * 100),
    essentialsReady,
    recommendedMissing,
  };
}