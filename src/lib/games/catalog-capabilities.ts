import {
  parseGameDate,
  reviewScore,
  type SortMode,
  type StatusFilter,
} from "@/lib/games/catalog";
import type { Game } from "@/types/game";

export type CatalogCapabilities = Readonly<{
  ratings: boolean;
  reviews: boolean;
  releaseDates: boolean;
  versions: boolean;
}>;

export function getCatalogCapabilities(
  games: readonly Game[]
): CatalogCapabilities {
  return {
    ratings: games.some(
      (game) =>
        typeof game.rating === "number" &&
        Number.isFinite(game.rating)
    ),
    reviews: games.some(
      (game) => reviewScore(game.reviews) > 0
    ),
    releaseDates: games.some(
      (game) => parseGameDate(game.releaseDate) !== 0
    ),
    versions: games.some(
      (game) => Boolean(game.version?.trim())
    ),
  };
}

export function resolveSupportedCatalogSort(
  sort: SortMode,
  capabilities: CatalogCapabilities
): SortMode {
  if (sort === "popular" && !capabilities.reviews) {
    return capabilities.ratings ? "rating" : "az";
  }

  if (sort === "rating" && !capabilities.ratings) {
    return capabilities.reviews ? "popular" : "az";
  }

  if (sort === "recientes" && !capabilities.releaseDates) {
    return "az";
  }

  return sort;
}

export function resolveSupportedCatalogStatus(
  status: StatusFilter,
  capabilities: CatalogCapabilities
): StatusFilter {
  if (status === "recent" && !capabilities.releaseDates) {
    return "all";
  }

  if (status === "version" && !capabilities.versions) {
    return "all";
  }

  return status;
}
