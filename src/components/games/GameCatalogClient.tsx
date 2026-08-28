"use client";

import {
  Box,
  Car,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Grid2X2,
  LayoutList,
  MonitorCheck,
  Puzzle,
  Search,
  Shield,
  Sparkles,
  Star,
  Sword,
  Tag,
  X,
  Zap,
} from "lucide-react";

import {
  FormEvent,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import GameCard from "@/components/home/GameCard";

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

import type { Game } from "@/types/game";

import styles from "./GameCatalogClient.module.css";

type GameCatalogClientProps = {
  games: Game[];
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

function CategoryIcon({
  category,
}: {
  category: string;
}) {
  const value =
    normalizeCatalogText(category);

  if (
    value.includes("accion")
  ) {
    return (
      <Zap
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("aventura")
  ) {
    return (
      <Compass
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("carrera")
  ) {
    return (
      <Car
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("puzzle")
  ) {
    return (
      <Puzzle
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("rpg")
  ) {
    return (
      <Sword
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("sandbox")
  ) {
    return (
      <Box
        size={28}
        aria-hidden="true"
      />
    );
  }

  if (
    value.includes("simul")
  ) {
    return (
      <Sparkles
        size={28}
        aria-hidden="true"
      />
    );
  }

  return (
    <Shield
      size={28}
      aria-hidden="true"
    />
  );
}

export default function GameCatalogClient({
  games,
  lowSpecSlugs,
  initialCategory =
    "todos",
  initialSort =
    "popular",
  initialQuery = "",
  initialSearchScope =
    "all",
  initialRating = 0,
  initialEquipment =
    "all",
  initialStatus =
    "all",
  initialView =
    "grid",
}: GameCatalogClientProps) {
  const router =
    useRouter();

  const categoryRef =
    useRef<HTMLDivElement>(
      null
    );

  const [
    query,
    setQuery,
  ] = useState(
    sanitizeCatalogQuery(
      initialQuery
    )
  );

  const deferredQuery =
    useDeferredValue(
      query
    );

  const [
    category,
    setCategory,
  ] = useState(
    initialCategory
  );

  const [
    sort,
    setSort,
  ] =
    useState<SortMode>(
      initialSort
    );

  const [
    scope,
    setScope,
  ] =
    useState<SearchScope>(
      initialSearchScope
    );

  const [
    minRating,
    setMinRating,
  ] = useState(
    initialRating
  );

  const [
    equipment,
    setEquipment,
  ] =
    useState<EquipmentFilter>(
      initialEquipment
    );

  const [
    status,
    setStatus,
  ] =
    useState<StatusFilter>(
      initialStatus
    );

  const [
    view,
    setView,
  ] =
    useState<ViewMode>(
      initialView
    );

  const categoryStats =
    useMemo(
      () =>
        getCategoryStats(
          games
        ),
      [games]
    );

  const visibleGames =
    useMemo(
      () =>
        filterAndSortGames(
          games,
          lowSpecSlugs,
          {
            query:
              deferredQuery,
            category,
            sort,
            scope,
            minRating,
            equipment,
            status,
          }
        ),
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

  function replaceUrl(
    next?: {
      category?: string;
      sort?: SortMode;
      scope?: SearchScope;
      rating?: number;
      equipment?: EquipmentFilter;
      status?: StatusFilter;
      view?: ViewMode;
      query?: string;
    }
  ) {
    const params =
      new URLSearchParams();

    const nextCategory =
      next?.category ??
      category;

    const nextSort =
      next?.sort ??
      sort;

    const nextScope =
      next?.scope ??
      scope;

    const nextRating =
      next?.rating ??
      minRating;

    const nextEquipment =
      next?.equipment ??
      equipment;

    const nextStatus =
      next?.status ??
      status;

    const nextView =
      next?.view ??
      view;

    const nextQuery =
      sanitizeCatalogQuery(
        next?.query ??
        query
      );

    if (
      nextCategory !==
      "todos"
    ) {
      params.set(
        "categoria",
        nextCategory
      );
    }

    if (
      nextSort !==
      "popular"
    ) {
      params.set(
        "orden",
        nextSort
      );
    }

    if (nextQuery) {
      params.set(
        "q",
        nextQuery
      );
    }

    if (
      nextScope !==
      "all"
    ) {
      params.set(
        "buscarEn",
        nextScope
      );
    }

    if (
      nextRating > 0
    ) {
      params.set(
        "puntuacion",
        String(
          nextRating
        )
      );
    }

    if (
      nextEquipment !==
      "all"
    ) {
      params.set(
        "equipo",
        nextEquipment
      );
    }

    if (
      nextStatus !==
      "all"
    ) {
      params.set(
        "estado",
        nextStatus
      );
    }

    if (
      nextView !==
      "grid"
    ) {
      params.set(
        "vista",
        nextView
      );
    }

    const suffix =
      params.toString();

    router.replace(
      suffix
        ? `/juegos?${suffix}`
        : "/juegos",
      {
        scroll: false,
      }
    );
  }

  function handleSearchSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    replaceUrl({
      query,
    });
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

    router.replace(
      "/juegos",
      {
        scroll: false,
      }
    );
  }

  function scrollCategories(
    direction:
      -1 | 1
  ) {
    categoryRef.current
      ?.scrollBy({
        left:
          direction *
          390,
        behavior:
          "smooth",
      });
  }

  const activeFilterCount =
    [
      Boolean(query),
      category !== "todos",
      sort !== "popular",
      scope !== "all",
      minRating > 0,
      equipment !== "all",
      status !== "all",
      view !== "grid",
    ].filter(Boolean).length;

  const hasFilters =
    activeFilterCount > 0;

  return (
    <>
      <section
        className={
          styles.categoryArea
        }
        aria-label="Categorías de juegos"
      >
        <button
          type="button"
          className={`${styles.categoryArrow} ${styles.arrowLeft}`}
          onClick={() =>
            scrollCategories(
              -1
            )
          }
          aria-label="Ver categorías anteriores"
        >
          <ChevronLeft
            size={20}
            aria-hidden="true"
          />
        </button>

        <div
          ref={categoryRef}
          className={
            styles.categoryScroller
          }
        >
          <button
            type="button"
            className={`${styles.categoryCard} ${
              category ===
              "todos"
                ? styles.categoryActive
                : ""
            }`}
            onClick={() => {
              setCategory(
                "todos"
              );

              replaceUrl({
                category:
                  "todos",
              });
            }}
            aria-pressed={
              category ===
              "todos"
            }
          >
            <span
              className={
                styles.categoryIcon
              }
            >
              <Grid2X2
                size={28}
                aria-hidden="true"
              />
            </span>

            <strong>
              Todos
            </strong>

            <small>
              {games.length} juegos
            </small>
          </button>

          {categoryStats.map(
            ([item, count]) => (
              <button
                key={item}
                type="button"
                className={`${styles.categoryCard} ${
                  category ===
                  item
                    ? styles.categoryActive
                    : ""
                }`}
                onClick={() => {
                  setCategory(
                    item
                  );

                  replaceUrl({
                    category:
                      item,
                  });
                }}
                aria-pressed={
                  category ===
                  item
                }
              >
                <span
                  className={
                    styles.categoryIcon
                  }
                >
                  <CategoryIcon
                    category={
                      item
                    }
                  />
                </span>

                <strong>
                  {item}
                </strong>

                <small>
                  {count}{" "}
                  {count === 1
                    ? "juego"
                    : "juegos"}
                </small>
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className={`${styles.categoryArrow} ${styles.arrowRight}`}
          onClick={() =>
            scrollCategories(
              1
            )
          }
          aria-label="Ver categorías siguientes"
        >
          <ChevronRight
            size={20}
            aria-hidden="true"
          />
        </button>
      </section>

      <section
        className={
          styles.explorer
        }
        aria-labelledby="catalog-tools-title"
      >
        <div
          className={
            styles.explorerHeader
          }
        >
          <div>
            <span
              className={
                styles.explorerEyebrow
              }
            >
              EXPLORADOR
            </span>

            <h2
              id="catalog-tools-title"
            >
              Encuentra el juego justo
            </h2>
          </div>

          {hasFilters && (
            <span
              className={
                styles.activeCount
              }
            >
              {activeFilterCount}
              {" "}
              {activeFilterCount === 1
                ? "filtro activo"
                : "filtros activos"}
            </span>
          )}
        </div>

        <form
          className={
            styles.searchRow
          }
          role="search"
          onSubmit={
            handleSearchSubmit
          }
        >
          <div
            className={
              styles.searchBox
            }
          >
            <Search
              size={18}
              aria-hidden="true"
            />

            <input
              type="search"
              value={query}
              maxLength={
                MAX_CATALOG_QUERY_LENGTH
              }
              autoComplete="off"
              spellCheck={false}
              onChange={(
                event
              ) =>
                setQuery(
                  sanitizeCatalogQuery(
                    event.target
                      .value
                  )
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

                  replaceUrl({
                    query: "",
                  });
                }}
                aria-label="Limpiar búsqueda"
              >
                <X
                  size={17}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

          <label
            className={
              styles.field
            }
          >
            <span>
              Buscar en
            </span>

            <select
              value={scope}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as SearchScope;

                setScope(
                  value
                );

                replaceUrl({
                  scope:
                    value,
                });
              }}
            >
              <option value="all">
                Todo
              </option>
              <option value="title">
                Nombre
              </option>
              <option value="category">
                Categoría
              </option>
              <option value="requirements">
                Requisitos
              </option>
            </select>
          </label>

          <button
            type="submit"
            className={
              styles.searchButton
            }
          >
            Buscar
          </button>
        </form>

        <div
          className={
            styles.quickFilters
          }
          aria-label="Filtros rápidos"
        >
          <span>
            <Tag
              size={14}
              aria-hidden="true"
            />
            Rápidos
          </span>

          <button
            type="button"
            className={
              minRating === 4.8
                ? styles.quickActive
                : ""
            }
            onClick={() => {
              const value =
                minRating === 4.8
                  ? 0
                  : 4.8;

              setMinRating(
                value
              );

              replaceUrl({
                rating:
                  value,
              });
            }}
            aria-pressed={
              minRating === 4.8
            }
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
              equipment ===
              "lowSpec"
                ? styles.quickActiveGreen
                : ""
            }
            onClick={() => {
              const value =
                equipment ===
                "lowSpec"
                  ? "all"
                  : "lowSpec";

              setEquipment(
                value
              );

              replaceUrl({
                equipment:
                  value,
              });
            }}
            aria-pressed={
              equipment ===
              "lowSpec"
            }
          >
            <Cpu
              size={14}
              aria-hidden="true"
            />
            Bajos recursos
          </button>

          <button
            type="button"
            className={
              status ===
              "recent"
                ? styles.quickActive
                : ""
            }
            onClick={() => {
              const value =
                status ===
                "recent"
                  ? "all"
                  : "recent";

              setStatus(
                value
              );

              replaceUrl({
                status:
                  value,
              });
            }}
            aria-pressed={
              status ===
              "recent"
            }
          >
            <Sparkles
              size={14}
              aria-hidden="true"
            />
            Recientes
          </button>

          <button
            type="button"
            className={
              status ===
              "version"
                ? styles.quickActive
                : ""
            }
            onClick={() => {
              const value =
                status ===
                "version"
                  ? "all"
                  : "version";

              setStatus(
                value
              );

              replaceUrl({
                status:
                  value,
              });
            }}
            aria-pressed={
              status ===
              "version"
            }
          >
            <MonitorCheck
              size={14}
              aria-hidden="true"
            />
            Con versión
          </button>
        </div>

        <div
          className={
            styles.advancedFilters
          }
        >
          <label
            className={
              styles.field
            }
          >
            <span>
              Puntuación
            </span>

            <select
              value={
                minRating
              }
              onChange={(
                event
              ) => {
                const value =
                  Number(
                    event.target
                      .value
                  );

                setMinRating(
                  value
                );

                replaceUrl({
                  rating:
                    value,
                });
              }}
            >
              <option value="0">
                Todas
              </option>
              <option value="4.5">
                4.5+
              </option>
              <option value="4.7">
                4.7+
              </option>
              <option value="4.8">
                4.8+
              </option>
              <option value="4.9">
                4.9
              </option>
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Equipo
            </span>

            <select
              value={
                equipment
              }
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as EquipmentFilter;

                setEquipment(
                  value
                );

                replaceUrl({
                  equipment:
                    value,
                });
              }}
            >
              <option value="all">
                Todos
              </option>
              <option value="lowSpec">
                Bajos recursos
              </option>
              <option value="requirements">
                Con requisitos
              </option>
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Estado
            </span>

            <select
              value={
                status
              }
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as StatusFilter;

                setStatus(
                  value
                );

                replaceUrl({
                  status:
                    value,
                });
              }}
            >
              <option value="all">
                Todos
              </option>
              <option value="recent">
                Añadidos recientemente
              </option>
              <option value="version">
                Con versión registrada
              </option>
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Ordenar
            </span>

            <select
              value={sort}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as SortMode;

                setSort(
                  value
                );

                replaceUrl({
                  sort:
                    value,
                });
              }}
            >
              <option value="popular">
                Más populares
              </option>
              <option value="rating">
                Mejor puntuados
              </option>
              <option value="recientes">
                Más recientes
              </option>
              <option value="az">
                A — Z
              </option>
            </select>
          </label>
        </div>

        <div
          className={
            styles.bottomBar
          }
        >
          <div
            className={
              styles.resultCount
            }
            aria-live="polite"
          >
            <strong>
              {visibleGames.length}
            </strong>

            <span>
              de {games.length}
              {" "}
              {games.length === 1
                ? "juego"
                : "juegos"}
            </span>

            {hasFilters && (
              <button
                type="button"
                onClick={
                  clearAll
                }
              >
                Limpiar todo
              </button>
            )}
          </div>

          <div
            className={
              styles.viewControls
            }
            aria-label="Vista del catálogo"
          >
            <span>Ver:</span>

            <button
              type="button"
              className={
                view ===
                "grid"
                  ? styles.viewActive
                  : ""
              }
              onClick={() => {
                setView(
                  "grid"
                );

                replaceUrl({
                  view:
                    "grid",
                });
              }}
              aria-label="Vista amplia"
              aria-pressed={
                view ===
                "grid"
              }
            >
              <Grid2X2
                size={18}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className={
                view ===
                "compact"
                  ? styles.viewActive
                  : ""
              }
              onClick={() => {
                setView(
                  "compact"
                );

                replaceUrl({
                  view:
                    "compact",
                });
              }}
              aria-label="Vista compacta"
              aria-pressed={
                view ===
                "compact"
              }
            >
              <LayoutList
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </section>

      {visibleGames.length >
      0 ? (
        <section
          className={`${styles.grid} ${
            view ===
            "compact"
              ? styles.compactGrid
              : ""
          }`}
          aria-label="Listado de juegos"
        >
          {visibleGames.map(
            (game) => (
              <GameCard
                key={
                  game.slug
                }
                game={game}
              />
            )
          )}
        </section>
      ) : (
        <section
          className={
            styles.empty
          }
          aria-live="polite"
        >
          <Search
            size={30}
            aria-hidden="true"
          />

          <h2>
            No encontramos juegos
          </h2>

          <p>
            Prueba con otro nombre,
            categoría, puntuación o
            combinación de filtros.
          </p>

          <button
            type="button"
            onClick={clearAll}
          >
            Ver todo el catálogo
          </button>
        </section>
      )}
    </>
  );
}
