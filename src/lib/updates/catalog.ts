import type {
  ResolvedGameUpdate,
  UpdateType,
} from "@/types/update";

export type UpdateSort =
  | "recent"
  | "oldest"
  | "az";

export type DownloadFilter =
  | "all"
  | "downloadable";

export type UpdateFilters = {
  query: string;
  gameSlug: string;
  type: "all" | UpdateType;
  sort: UpdateSort;
  download: DownloadFilter;
};

export const MAX_UPDATE_QUERY_LENGTH =
  80;

export const updateTypeLabels:
  Record<UpdateType, string> = {
    update: "Actualización",
    content: "Contenido",
    fix: "Correcciones",
    improvement: "Mejoras",
  };

export function sanitizeUpdateQuery(
  value?: string
) {
  return (value ?? "")
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .slice(
      0,
      MAX_UPDATE_QUERY_LENGTH
    );
}

export function normalizeUpdateText(
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

export function formatUpdateDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

export function formatCompactUpdateDate(
  value?: string
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es",
    {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }
  )
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

export function filterAndSortUpdates(
  updates:
    readonly ResolvedGameUpdate[],
  filters: UpdateFilters
) {
  const query =
    normalizeUpdateText(
      sanitizeUpdateQuery(
        filters.query
      )
    );

  const filtered =
    updates.filter(
      (update) => {
        const searchable =
          normalizeUpdateText(
            [
              update.game.title,
              update.version,
              update.summary,
              updateTypeLabels[
                update.type
              ],
            ].join(" ")
          );

        const queryOk =
          !query ||
          searchable.includes(
            query
          );

        const gameOk =
          filters.gameSlug ===
            "all" ||
          update.game.slug ===
            filters.gameSlug;

        const typeOk =
          filters.type ===
            "all" ||
          update.type ===
            filters.type;

        const downloadOk =
          filters.download ===
            "all" ||
          update.downloadable;

        return (
          queryOk &&
          gameOk &&
          typeOk &&
          downloadOk
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
        return a.game.title
          .localeCompare(
            b.game.title,
            "es",
            {
              sensitivity:
                "base",
            }
          );
      }

      const aTime =
        Date.parse(
          a.publishedAt
        );

      const bTime =
        Date.parse(
          b.publishedAt
        );

      if (
        filters.sort ===
        "oldest"
      ) {
        return (
          aTime - bTime
        );
      }

      return (
        bTime - aTime
      );
    }
  );
}

export function parseUpdateGameSlug(
  value: string | undefined,
  updates: readonly ResolvedGameUpdate[]
) {
  if (!value) {
    return "all";
  }

  return updates.some(
    (update) => update.game.slug === value
  )
    ? value
    : "all";
}

export function parseUpdateType(
  value?: string
): "all" | UpdateType {
  if (
    value === "update" ||
    value === "content" ||
    value === "fix" ||
    value === "improvement"
  ) {
    return value;
  }

  return "all";
}

export function parseUpdateSort(
  value?: string
): UpdateSort {
  if (
    value === "oldest" ||
    value === "az"
  ) {
    return value;
  }

  return "recent";
}

export function parseDownloadFilter(
  value?: string
): DownloadFilter {
  return value ===
    "downloadable"
    ? "downloadable"
    : "all";
}
