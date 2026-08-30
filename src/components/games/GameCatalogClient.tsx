"use client";

import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Grid2X2,
  LayoutList,
  MonitorCheck,
  Search,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import type {
  CSSProperties,
  FormEvent,
} from "react";
import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import TaxonomyIcon from "@/components/taxonomy/TaxonomyIcon";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import {
  filterAndSortGames,
  getCategoryStats,
  MAX_CATALOG_QUERY_LENGTH,
  normalizeCatalogText,
  sanitizeCatalogQuery,
  type EquipmentFilter,
  type SearchScope,
  type SortMode,
  type StatusFilter,
  type ViewMode,
} from "@/lib/games/catalog";
import {
  resolveTaxonomyVisual,
} from "@/lib/games/taxonomy-presentation";
import type { Game } from "@/types/game";
import type {
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

import styles from "./GameCatalogClient.module.css";

type GameCatalogClientProps = {
  games: Game[];
  categoryTerms: GameTaxonomyTerm[];
  lowSpecSlugs: string[];
  initialCategory?: string;
  initialSort?: SortMode;
  initialQuery?: string;
  initialSearchScope?: SearchScope;
  initialRating?: number;
  initialEquipment?: EquipmentFilter;
  initialStatus?: StatusFilter;
  initialView?: ViewMode;
};

function orderedCategoryStats(
  games: readonly Game[],
  terms: readonly GameTaxonomyTerm[]
) {
  const counts = new Map(getCategoryStats(games));
  const labels = new Map(
    [...counts.keys()].map((label) => [
      normalizeCatalogText(label),
      label,
    ])
  );
  const used = new Set<string>();
  const ordered: Array<{
    term: GameTaxonomyTerm;
    label: string;
    count: number;
  }> = [];

  terms.forEach((term) => {
    const label = labels.get(normalizeCatalogText(term.label));
    if (!label) return;

    used.add(label);
    ordered.push({
      term,
      label,
      count: counts.get(label) ?? 0,
    });
  });

  [...counts.entries()]
    .filter(([label]) => !used.has(label))
    .sort(([left], [right]) =>
      left.localeCompare(right, "es", {
        sensitivity: "base",
      })
    )
    .forEach(([label, count]) => {
      ordered.push({
        term: {
          key:
            normalizeCatalogText(label)
              .replace(/[^a-z0-9]+/g, "-") ||
            "clasificacion",
          label,
          active: true,
        },
        label,
        count,
      });
    });

  return ordered;
}

export default function GameCatalogClient({
  games,
  categoryTerms,
  lowSpecSlugs,
  initialCategory = "todos",
  initialSort = "popular",
  initialQuery = "",
  initialSearchScope = "all",
  initialRating = 0,
  initialEquipment = "all",
  initialStatus = "all",
  initialView = "grid",
}: GameCatalogClientProps) {
  const router = useRouter();
  const categoryRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(
    sanitizeCatalogQuery(initialQuery)
  );
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [scope, setScope] =
    useState<SearchScope>(initialSearchScope);
  const [minRating, setMinRating] = useState(initialRating);
  const [equipment, setEquipment] =
    useState<EquipmentFilter>(initialEquipment);
  const [status, setStatus] =
    useState<StatusFilter>(initialStatus);
  const [view, setView] = useState<ViewMode>(initialView);

  const categoryStats = useMemo(
    () => orderedCategoryStats(games, categoryTerms),
    [games, categoryTerms]
  );

  const visibleGames = useMemo(
    () =>
      filterAndSortGames(games, lowSpecSlugs, {
        query: deferredQuery,
        category,
        sort,
        scope,
        minRating,
        equipment,
        status,
      }),
    [
      category,
      deferredQuery,
      equipment,
      games,
      lowSpecSlugs,
      minRating,
      scope,
      sort,
      status,
    ]
  );

  function replaceUrl(next?: {
    category?: string;
    sort?: SortMode;
    scope?: SearchScope;
    rating?: number;
    equipment?: EquipmentFilter;
    status?: StatusFilter;
    view?: ViewMode;
    query?: string;
  }) {
    const params = new URLSearchParams();
    const nextCategory = next?.category ?? category;
    const nextSort = next?.sort ?? sort;
    const nextScope = next?.scope ?? scope;
    const nextRating = next?.rating ?? minRating;
    const nextEquipment = next?.equipment ?? equipment;
    const nextStatus = next?.status ?? status;
    const nextView = next?.view ?? view;
    const nextQuery = sanitizeCatalogQuery(next?.query ?? query);

    if (nextCategory !== "todos") {
      params.set("categoria", nextCategory);
    }
    if (nextSort !== "popular") {
      params.set("orden", nextSort);
    }
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    if (nextScope !== "all") {
      params.set("buscarEn", nextScope);
    }
    if (nextRating > 0) {
      params.set("puntuacion", String(nextRating));
    }
    if (nextEquipment !== "all") {
      params.set("equipo", nextEquipment);
    }
    if (nextStatus !== "all") {
      params.set("estado", nextStatus);
    }
    if (nextView !== "grid") {
      params.set("vista", nextView);
    }

    const suffix = params.toString();
    router.replace(
      suffix ? `/juegos?${suffix}` : "/juegos",
      { scroll: false }
    );
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    replaceUrl({ query });
  }

  function clearAll() {
    setQuery("");
    setCategory("todos");
    setSort("popular");
    setScope("all");
    setMinRating(0);
    setEquipment("all");
    setStatus("all");
    setView("grid");
    router.replace("/juegos", { scroll: false });
  }

  function scrollCategories(direction: -1 | 1) {
    categoryRef.current?.scrollBy({
      left: direction * 390,
      behavior: "smooth",
    });
  }

  const activeFilterCount = [
    Boolean(query),
    category !== "todos",
    sort !== "popular",
    scope !== "all",
    minRating > 0,
    equipment !== "all",
    status !== "all",
    view !== "grid",
  ].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  return (
    <>
      <section
        className={styles.categoryArea}
        aria-label="Clasificaciones de juegos"
      >
        <button
          type="button"
          className={`${styles.categoryArrow} ${styles.arrowLeft}`}
          onClick={() => scrollCategories(-1)}
          aria-label="Ver clasificaciones anteriores"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div
          ref={categoryRef}
          className={styles.categoryScroller}
        >
          <button
            type="button"
            className={`${styles.categoryCard} ${
              category === "todos" ? styles.categoryActive : ""
            }`}
            style={
              {
                "--taxonomy-accent": "var(--brand)",
              } as CSSProperties
            }
            onClick={() => {
              setCategory("todos");
              replaceUrl({ category: "todos" });
            }}
            aria-pressed={category === "todos"}
          >
            <span className={styles.categoryIcon}>
              <Grid2X2 size={28} aria-hidden="true" />
            </span>
            <strong>Todos</strong>
            <small>{games.length} juegos</small>
          </button>

          {categoryStats.map(
            ({ term, label, count }, index) => {
              const visual = resolveTaxonomyVisual(term, index);

              return (
                <button
                  key={term.key}
                  type="button"
                  className={`${styles.categoryCard} ${
                    category === label
                      ? styles.categoryActive
                      : ""
                  }`}
                  style={
                    {
                      "--taxonomy-accent": visual.color,
                    } as CSSProperties
                  }
                  onClick={() => {
                    setCategory(label);
                    replaceUrl({ category: label });
                  }}
                  aria-pressed={category === label}
                >
                  <span className={styles.categoryIcon}>
                    <TaxonomyIcon
                      icon={visual.icon}
                      size={28}
                    />
                  </span>
                  <strong>{label}</strong>
                  <small>
                    {count} {count === 1 ? "juego" : "juegos"}
                  </small>
                </button>
              );
            }
          )}
        </div>

        <button
          type="button"
          className={`${styles.categoryArrow} ${styles.arrowRight}`}
          onClick={() => scrollCategories(1)}
          aria-label="Ver clasificaciones siguientes"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </section>

      <section
        className={styles.explorer}
        aria-labelledby="catalog-tools-title"
      >
        <div className={styles.explorerHeader}>
          <div>
            <span className={styles.explorerEyebrow}>
              EXPLORADOR
            </span>
            <h2 id="catalog-tools-title">
              Encuentra el juego justo
            </h2>
          </div>

          {hasFilters && (
            <span className={styles.activeCount}>
              {activeFilterCount}{" "}
              {activeFilterCount === 1
                ? "filtro activo"
                : "filtros activos"}
            </span>
          )}
        </div>

        <form
          className={styles.searchRow}
          role="search"
          onSubmit={handleSearchSubmit}
        >
          <div className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              maxLength={MAX_CATALOG_QUERY_LENGTH}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) =>
                setQuery(
                  sanitizeCatalogQuery(event.target.value)
                )
              }
              placeholder="Buscar juegos..."
              aria-label="Buscar juegos"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  replaceUrl({ query: "" });
                }}
                aria-label="Limpiar búsqueda"
              >
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>

          <label className={styles.field}>
            <span>Buscar en</span>
            <select
              value={scope}
              onChange={(event) => {
                const value = event.target.value as SearchScope;
                setScope(value);
                replaceUrl({ scope: value });
              }}
            >
              <option value="all">Todo</option>
              <option value="title">Nombre</option>
              <option value="category">Clasificación / etiqueta</option>
              <option value="requirements">Requisitos</option>
            </select>
          </label>

          <button type="submit" className={styles.searchButton}>
            Buscar
          </button>
        </form>

        <div
          className={styles.quickFilters}
          aria-label="Filtros rápidos"
        >
          <span>
            <Tag size={14} aria-hidden="true" />
            Rápidos
          </span>

          <button
            type="button"
            className={
              minRating === 4.8 ? styles.quickActive : ""
            }
            onClick={() => {
              const value = minRating === 4.8 ? 0 : 4.8;
              setMinRating(value);
              replaceUrl({ rating: value });
            }}
            aria-pressed={minRating === 4.8}
          >
            <Star
              size={14}
              fill="currentColor"
              aria-hidden="true"
            />
            4.8+
          </button>

          <button
            type="button"
            className={
              equipment === "lowSpec"
                ? styles.quickActiveGreen
                : ""
            }
            onClick={() => {
              const value =
                equipment === "lowSpec" ? "all" : "lowSpec";
              setEquipment(value);
              replaceUrl({ equipment: value });
            }}
            aria-pressed={equipment === "lowSpec"}
          >
            <Cpu size={14} aria-hidden="true" />
            Bajos recursos
          </button>

          <button
            type="button"
            className={
              status === "recent" ? styles.quickActive : ""
            }
            onClick={() => {
              const value =
                status === "recent" ? "all" : "recent";
              setStatus(value);
              replaceUrl({ status: value });
            }}
            aria-pressed={status === "recent"}
          >
            <Sparkles size={14} aria-hidden="true" />
            Recientes
          </button>

          <button
            type="button"
            className={
              status === "version" ? styles.quickActive : ""
            }
            onClick={() => {
              const value =
                status === "version" ? "all" : "version";
              setStatus(value);
              replaceUrl({ status: value });
            }}
            aria-pressed={status === "version"}
          >
            <MonitorCheck size={14} aria-hidden="true" />
            Con versión
          </button>
        </div>

        <div className={styles.advancedFilters}>
          <label className={styles.field}>
            <span>Puntuación</span>
            <select
              value={minRating}
              onChange={(event) => {
                const value = Number(event.target.value);
                setMinRating(value);
                replaceUrl({ rating: value });
              }}
            >
              <option value="0">Todas</option>
              <option value="4.5">4.5+</option>
              <option value="4.7">4.7+</option>
              <option value="4.8">4.8+</option>
              <option value="4.9">4.9</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Equipo</span>
            <select
              value={equipment}
              onChange={(event) => {
                const value =
                  event.target.value as EquipmentFilter;
                setEquipment(value);
                replaceUrl({ equipment: value });
              }}
            >
              <option value="all">Todos</option>
              <option value="lowSpec">Bajos recursos</option>
              <option value="requirements">Con requisitos</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) => {
                const value =
                  event.target.value as StatusFilter;
                setStatus(value);
                replaceUrl({ status: value });
              }}
            >
              <option value="all">Todos</option>
              <option value="recent">Añadidos recientemente</option>
              <option value="version">Con versión registrada</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Ordenar</span>
            <select
              value={sort}
              onChange={(event) => {
                const value = event.target.value as SortMode;
                setSort(value);
                replaceUrl({ sort: value });
              }}
            >
              <option value="popular">Más populares</option>
              <option value="rating">Mejor puntuados</option>
              <option value="recientes">Más recientes</option>
              <option value="az">A — Z</option>
            </select>
          </label>
        </div>

        <div className={styles.bottomBar}>
          <div
            className={styles.resultCount}
            aria-live="polite"
          >
            <strong>{visibleGames.length}</strong>
            <span>
              de {games.length}{" "}
              {games.length === 1 ? "juego" : "juegos"}
            </span>
            {hasFilters && (
              <button type="button" onClick={clearAll}>
                Limpiar todo
              </button>
            )}
          </div>

          <div
            className={styles.viewControls}
            aria-label="Vista del catálogo"
          >
            <span>Ver:</span>
            <button
              type="button"
              className={
                view === "grid" ? styles.viewActive : ""
              }
              onClick={() => {
                setView("grid");
                replaceUrl({ view: "grid" });
              }}
              aria-label="Vista amplia"
              aria-pressed={view === "grid"}
            >
              <Grid2X2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={
                view === "compact" ? styles.viewActive : ""
              }
              onClick={() => {
                setView("compact");
                replaceUrl({ view: "compact" });
              }}
              aria-label="Vista compacta"
              aria-pressed={view === "compact"}
            >
              <LayoutList size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {visibleGames.length > 0 ? (
        <section
          className={`${styles.grid} ${
            view === "compact" ? styles.compactGrid : ""
          }`}
          aria-label="Listado de juegos"
        >
          {visibleGames.map((game) => (
            <UniversalGameCard
              key={game.slug}
              game={game}
              variant="standard"
            />
          ))}
        </section>
      ) : (
        <section className={styles.empty} aria-live="polite">
          <Search size={30} aria-hidden="true" />
          <h2>No encontramos juegos</h2>
          <p>
            Prueba con otro nombre, clasificación, puntuación o combinación de filtros.
          </p>
          <button type="button" onClick={clearAll}>
            Ver todo el catálogo
          </button>
        </section>
      )}
    </>
  );
}
