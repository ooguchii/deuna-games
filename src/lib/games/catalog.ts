import {
  hasGameCivilDateSyntax,
  hasGameIsoDatePrefix,
  parseGameCivilDate,
  parseGameIsoDatePrefix,
} from "@/lib/games/game-date";
import type { Game } from "@/types/game";
import type {
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

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

export type OrderedClassificationStat = {
  term: GameTaxonomyTerm;
  label: string;
  count: number;
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
  const trimmed = value?.trim();
  if (!trimmed) {
    return 0;
  }

  const civil = parseGameCivilDate(trimmed);
  if (civil !== null) {
    return civil;
  }

  // Do not let Date.parse normalize impossible civil dates such as 31/02.
  if (hasGameCivilDateSyntax(trimmed)) {
    return 0;
  }

  if (
    hasGameIsoDatePrefix(trimmed) &&
    parseGameIsoDatePrefix(trimmed) === null
  ) {
    return 0;
  }

  const parsed = Date.parse(trimmed);

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

export function gameClassifications(
  game: Game
) {
  const values = [
    game.category,
    ...(game.genres ?? []),
  ];
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = normalizeCatalogText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function classificationText(game: Game) {
  return [
    ...gameClassifications(game),
    ...(game.tags ?? []),
  ].join(" ");
}

function hasClassification(
  game: Game,
  classification: string
) {
  const requested = normalizeCatalogText(classification);

  return gameClassifications(game).some(
    (value) => normalizeCatalogText(value) === requested
  );
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

function titleOrder(a: Game, b: Game) {
  return a.title.localeCompare(
    b.title,
    "es",
    {
      sensitivity: "base",
    }
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
          hasClassification(
            game,
            filters.category
          );

        const ratingOk =
          filters.minRating <= 0 ||
          (
            game.rating !== undefined &&
            game.rating >= filters.minRating
          );

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
              game.releaseDate
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
        return titleOrder(a, b);
      }

      if (
        filters.sort ===
        "rating"
      ) {
        return (
          (b.rating ?? 0) -
            (a.rating ?? 0) ||
          titleOrder(a, b)
        );
      }

      if (
        filters.sort ===
        "recientes"
      ) {
        return (
          parseGameDate(
            b.releaseDate
          ) -
            parseGameDate(
              a.releaseDate
            ) ||
          titleOrder(a, b)
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
          (a.rating ?? 0) ||
        titleOrder(a, b)
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
  const canonical = new Map<string, string>();

  games.forEach((game) => {
    gameClassifications(game).forEach((classification) => {
      const normalized = normalizeCatalogText(classification);
      const label = canonical.get(normalized) ?? classification;
      canonical.set(normalized, label);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  });

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

export function getOrderedClassificationStats(
  games: readonly Game[],
  terms: readonly GameTaxonomyTerm[]
): OrderedClassificationStat[] {
  const byNormalized = new Map(
    getCategoryStats(games).map(([label, count]) => [
      normalizeCatalogText(label),
      { label, count },
    ])
  );
  const used = new Set<string>();
  const ordered: OrderedClassificationStat[] = [];

  terms.forEach((term) => {
    const normalized = normalizeCatalogText(term.label);
    const stat = byNormalized.get(normalized);
    if (!stat) return;

    used.add(normalized);
    ordered.push({
      term,
      label: stat.label,
      count: stat.count,
    });
  });

  [...byNormalized.entries()]
    .filter(([normalized]) => !used.has(normalized))
    .sort(([, left], [, right]) =>
      left.label.localeCompare(right.label, "es", {
        sensitivity: "base",
      })
    )
    .forEach(([normalized, stat]) => {
      ordered.push({
        term: {
          key:
            normalized
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") ||
            "clasificacion",
          label: stat.label,
          active: true,
        },
        label: stat.label,
        count: stat.count,
      });
    });

  return ordered;
}

export function parseCategory(
  value: string | undefined,
  games: readonly Game[]
) {
  if (!value) {
    return "todos";
  }

  return games.some(
    (game) => hasClassification(game, value)
  )
    ? value
    : "todos";
}

export function parseSortMode(
  value?: string
): SortMode {
  if (
    value === "popular" ||
    value === "rating" ||
    value === "recientes" ||
    value === "az"
  ) {
    return value;
  }

  return "az";
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
