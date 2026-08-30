import type { Game } from "@/types/game";

export type SortMode =
  | "popular"
  | "rating"
  | "recientes"
  | "az";

export type SearchScope =
  | "all"
  | "title"
  | "category"
  | "requirements";

export type EquipmentFilter =
  | "all"
  | "lowSpec"
  | "requirements";

export type StatusFilter =
  | "all"
  | "recent"
  | "version";

export type ViewMode =
  | "grid"
  | "compact";

export type CatalogFilters = {
  query: string;
  category: string;
  sort: SortMode;
  scope: SearchScope;
  minRating: number;
  equipment: EquipmentFilter;
  status: StatusFilter;
};

export const MAX_CATALOG_QUERY_LENGTH =
  80;

export function normalizeCatalogText(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

export function sanitizeCatalogQuery(
  value?: string
) {
  return (value ?? "")
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .slice(
      0,
      MAX_CATALOG_QUERY_LENGTH
    );
}

export function reviewScore(
  value?: string
) {
  if (!value) {
    return 0;
  }

  const normalized =
    value
      .toUpperCase()
      .replace(",", ".");

  const multiplier =
    normalized.endsWith("M")
      ? 1_000_000
      : normalized.endsWith("K")
        ? 1_000
        : 1;

  const number =
    Number.parseFloat(
      normalized.replace(
        /[KM]$/,
        ""
      )
    );

  return Number.isFinite(number)
    ? number * multiplier
    : 0;
}

export function parseGameDate(
  value?: string
) {
  if (!value) {
    return 0;
  }

  const ddmmyyyy =
    value.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (ddmmyyyy) {
    const [
      ,
      day,
      month,
      year,
    ] = ddmmyyyy;

    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  }

  const parsed =
    Date.parse(value);

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function requirementValues(
  value: unknown
): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [];
  }

  return Object.values(value).flatMap(
    requirementValues
  );
}

export function requirementsText(
  game: Game
) {
  return requirementValues(
    game.requirements
  ).join(" ");
}

function classificationText(game: Game) {
  return [
    game.category,
    ...(game.genres ?? []),
    ...(game.tags ?? []),
  ].join(" ");
}

export function matchesCatalogSearch(
  game: Game,
  query: string,
  scope: SearchScope
) {
  const normalizedQuery =
    normalizeCatalogText(
      sanitizeCatalogQuery(query)
    );

  if (!normalizedQuery) {
    return true;
  }

  if (scope === "title") {
    return normalizeCatalogText(
      game.title
    ).includes(
      normalizedQuery
    );
  }

  if (scope === "category") {
    return normalizeCatalogText(
      classificationText(game)
    ).includes(
      normalizedQuery
    );
  }

  if (
    scope === "requirements"
  ) {
    return normalizeCatalogText(
      requirementsText(game)
    ).includes(
      normalizedQuery
    );
  }

  return normalizeCatalogText(
    [
      game.title,
      game.description,
      classificationText(game),
      game.badge ?? "",
      game.version ?? "",
      requirementsText(game),
    ].join(" ")
  ).includes(
    normalizedQuery
  );
}

export function filterAndSortGames(
  games: readonly Game[],
  lowSpecSlugs: readonly string[],
  filters: CatalogFilters
) {
  const lowSpecSet =
    new Set(lowSpecSlugs);

  const filtered =
    games.filter(
      (game) => {
        const searchOk =
          matchesCatalogSearch(
            game,
            filters.query,
            filters.scope
          );

        const categoryOk =
          filters.category ===
            "todos" ||
          game.category ===
            filters.category;

        const ratingOk =
          (game.rating ?? 0) >=
          filters.minRating;

        const equipmentOk =
          filters.equipment ===
            "all" ||
          (filters.equipment ===
            "lowSpec" &&
            lowSpecSet.has(
              game.slug
            )) ||
          (filters.equipment ===
            "requirements" &&
            Boolean(
              game.requirements
            ));

        const statusOk =
          filters.status ===
            "all" ||
          (filters.status ===
            "recent" &&
            Boolean(
              game.addedAt
            )) ||
          (filters.status ===
            "version" &&
            Boolean(
              game.version
            ));

        return (
          searchOk &&
          categoryOk &&
          ratingOk &&
          equipmentOk &&
          statusOk
        );
      }
    );

  return [
    ...filtered,
  ].sort(
    (a, b) => {
      if (
        filters.sort ===
        "az"
      ) {
        return a.title
          .localeCompare(
            b.title,
            "es",
            {
              sensitivity:
                "base",
            }
          );
      }

      if (
        filters.sort ===
        "rating"
      ) {
        return (
          (b.rating ?? 0) -
          (a.rating ?? 0)
        );
      }

      if (
        filters.sort ===
        "recientes"
      ) {
        return (
          parseGameDate(
            b.addedAt
          ) -
            parseGameDate(
              a.addedAt
            ) ||
          a.title.localeCompare(
            b.title,
            "es"
          )
        );
      }

      return (
        reviewScore(
          b.reviews
        ) -
          reviewScore(
            a.reviews
          ) ||
        (b.rating ?? 0) -
          (a.rating ?? 0)
      );
    }
  );
}

export function getCategoryStats(
  games: readonly Game[]
) {
  const counts =
    new Map<
      string,
      number
    >();

  games.forEach(
    (game) => {
      counts.set(
        game.category,
        (counts.get(
          game.category
        ) ?? 0) + 1
      );
    }
  );

  return Array.from(
    counts.entries()
  ).sort(
    ([a], [b]) =>
      a.localeCompare(
        b,
        "es",
        {
          sensitivity:
            "base",
        }
      )
  );
}

export function parseCategory(
  value: string | undefined,
  games: readonly Game[]
) {
  if (!value) {
    return "todos";
  }

  return games.some(
    (game) => game.category === value
  )
    ? value
    : "todos";
}

export function parseSortMode(
  value?: string
): SortMode {
  if (
    value === "rating" ||
    value === "recientes" ||
    value === "az"
  ) {
    return value;
  }

  return "popular";
}

export function parseSearchScope(
  value?: string
): SearchScope {
  if (
    value === "title" ||
    value === "category" ||
    value === "requirements"
  ) {
    return value;
  }

  return "all";
}

export function parseEquipmentFilter(
  value?: string
): EquipmentFilter {
  if (
    value === "lowSpec" ||
    value === "requirements"
  ) {
    return value;
  }

  return "all";
}

export function parseStatusFilter(
  value?: string
): StatusFilter {
  if (
    value === "recent" ||
    value === "version"
  ) {
    return value;
  }

  return "all";
}

export function parseViewMode(
  value?: string
): ViewMode {
  return value === "compact"
    ? "compact"
    : "grid";
}

export function parseMinimumRating(
  value?: string
) {
  const number =
    Number.parseFloat(
      value ?? ""
    );

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 5
  ) {
    return 0;
  }

  return number;
}
