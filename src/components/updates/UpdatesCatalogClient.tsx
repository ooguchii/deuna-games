"use client";

import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Download,
  Monitor,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import {
  FormEvent,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import GameMedia from "@/components/ui/GameMedia";

import {
  filterAndSortUpdates,
  formatUpdateDate,
  MAX_UPDATE_QUERY_LENGTH,
  sanitizeUpdateQuery,
  updateTypeLabels,
  type DownloadFilter,
  type UpdateSort,
} from "@/lib/updates/catalog";

import type {
  ResolvedGameUpdate,
  UpdateType,
} from "@/types/update";

import styles from "./UpdatesCatalogClient.module.css";

type TypeFilter =
  | "all"
  | UpdateType;

type UpdatesCatalogClientProps = {
  updates:
    ResolvedGameUpdate[];
  initialQuery?: string;
  initialGameSlug?: string;
  initialType?: TypeFilter;
  initialSort?: UpdateSort;
  initialDownload?: DownloadFilter;
};

function TypeBadge({
  type,
}: {
  type: UpdateType;
}) {
  return (
    <span
      className={`${styles.typeBadge} ${styles[`type_${type}`]}`}
    >
      {
        updateTypeLabels[
          type
        ]
      }
    </span>
  );
}

export default function UpdatesCatalogClient({
  updates,
  initialQuery = "",
  initialGameSlug = "all",
  initialType = "all",
  initialSort = "recent",
  initialDownload = "all",
}: UpdatesCatalogClientProps) {
  const router =
    useRouter();

  const [
    query,
    setQuery,
  ] = useState(
    sanitizeUpdateQuery(
      initialQuery
    )
  );

  const deferredQuery =
    useDeferredValue(
      query
    );

  const [
    gameSlug,
    setGameSlug,
  ] = useState(
    initialGameSlug
  );

  const [
    type,
    setType,
  ] =
    useState<TypeFilter>(
      initialType
    );

  const [
    sort,
    setSort,
  ] =
    useState<UpdateSort>(
      initialSort
    );

  const [
    download,
    setDownload,
  ] =
    useState<DownloadFilter>(
      initialDownload
    );

  const games =
    useMemo(() => {
      const map =
        new Map<
          string,
          string
        >();

      updates.forEach(
        (update) => {
          map.set(
            update.game.slug,
            update.game.title
          );
        }
      );

      return Array.from(
        map.entries()
      ).sort(
        ([, a], [, b]) =>
          a.localeCompare(
            b,
            "es"
          )
      );
    }, [updates]);

  const visibleUpdates =
    useMemo(
      () =>
        filterAndSortUpdates(
          updates,
          {
            query:
              deferredQuery,
            gameSlug,
            type,
            sort,
            download,
          }
        ),
      [
        deferredQuery,
        download,
        gameSlug,
        sort,
        type,
        updates,
      ]
    );

  const recentSidebar =
    updates.slice(0, 5);

  const downloadableGames =
    new Set(
      updates
        .filter(
          (update) =>
            update.downloadable
        )
        .map(
          (update) =>
            update.game.slug
        )
    ).size;

  const typeStats =
    useMemo(
      () =>
        (
          [
            "update",
            "content",
            "fix",
            "improvement",
          ] as UpdateType[]
        ).map(
          (item) => ({
            type: item,
            count:
              updates.filter(
                (update) =>
                  update.type ===
                  item
              ).length,
          })
        ),
      [updates]
    );

  function replaceUrl(
    next?: {
      query?: string;
      gameSlug?: string;
      type?: TypeFilter;
      sort?: UpdateSort;
      download?: DownloadFilter;
    }
  ) {
    const params =
      new URLSearchParams();

    const nextQuery =
      sanitizeUpdateQuery(
        next?.query ??
        query
      );

    const nextGame =
      next?.gameSlug ??
      gameSlug;

    const nextType =
      next?.type ??
      type;

    const nextSort =
      next?.sort ??
      sort;

    const nextDownload =
      next?.download ??
      download;

    if (nextQuery) {
      params.set(
        "q",
        nextQuery
      );
    }

    if (
      nextGame !== "all"
    ) {
      params.set(
        "juego",
        nextGame
      );
    }

    if (
      nextType !== "all"
    ) {
      params.set(
        "tipo",
        nextType
      );
    }

    if (
      nextSort !== "recent"
    ) {
      params.set(
        "orden",
        nextSort
      );
    }

    if (
      nextDownload !==
      "all"
    ) {
      params.set(
        "descarga",
        nextDownload
      );
    }

    const suffix =
      params.toString();

    router.replace(
      suffix
        ? `/actualizaciones?${suffix}`
        : "/actualizaciones",
      {
        scroll: false,
      }
    );
  }

  function submitSearch(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    replaceUrl({
      query,
    });
  }

  function clearFilters() {
    setQuery("");
    setGameSlug("all");
    setType("all");
    setSort("recent");
    setDownload("all");

    router.replace(
      "/actualizaciones",
      {
        scroll: false,
      }
    );
  }

  const activeCount =
    [
      Boolean(query),
      gameSlug !== "all",
      type !== "all",
      sort !== "recent",
      download !== "all",
    ].filter(Boolean).length;

  function setTypeFilter(
    nextType: TypeFilter
  ) {
    setType(
      nextType
    );

    replaceUrl({
      type:
        nextType,
    });
  }

  return (
    <section
      aria-labelledby="updates-list-title"
    >
      <div
        className={
          styles.filters
        }
      >
        <div
          className={
            styles.filterHeader
          }
        >
          <div>
            <span>
              EXPLORAR
            </span>

            <h2>
              Encuentra una actualización
            </h2>

            <p>
              Busca por juego o versión
              y combina los filtros.
            </p>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className={
                styles.clearButton
              }
            >
              Limpiar
              <span>
                {activeCount}
              </span>
              <X
                size={14}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <div
          className={
            styles.typeRail
          }
          aria-label="Tipos de actualización"
        >
          <button
            type="button"
            className={
              type === "all"
                ? styles.typeRailPrimaryActive
                : styles.typeRailPrimary
            }
            onClick={() =>
              setTypeFilter(
                "all"
              )
            }
            aria-pressed={
              type === "all"
            }
          >
            <RefreshCcw
              size={16}
              aria-hidden="true"
            />
            Todas las actualizaciones
          </button>

          {(
            [
              "update",
              "content",
              "fix",
              "improvement",
            ] as UpdateType[]
          ).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={
                  type === item
                    ? styles.typeRailActive
                    : styles.typeRailButton
                }
                onClick={() =>
                  setTypeFilter(
                    type === item
                      ? "all"
                      : item
                  )
                }
                aria-pressed={
                  type === item
                }
              >
                {
                  updateTypeLabels[
                    item
                  ]
                }
              </button>
            )
          )}
        </div>

        <form
          className={
            styles.searchRow
          }
          role="search"
          onSubmit={
            submitSearch
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
                MAX_UPDATE_QUERY_LENGTH
              }
              autoComplete="off"
              spellCheck={false}
              onChange={(
                event
              ) =>
                setQuery(
                  sanitizeUpdateQuery(
                    event.target
                      .value
                  )
                )
              }
              placeholder="Buscar juego, versión o mejora..."
              aria-label="Buscar actualizaciones"
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
                  size={16}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

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
            styles.filterGrid
          }
        >
          <label
            className={
              styles.field
            }
          >
            <span>
              Juego
            </span>

            <select
              value={
                gameSlug
              }
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value;

                setGameSlug(
                  value
                );

                replaceUrl({
                  gameSlug:
                    value,
                });
              }}
            >
              <option value="all">
                Todos los juegos
              </option>

              {games.map(
                ([slug, title]) => (
                  <option
                    key={slug}
                    value={slug}
                  >
                    {title}
                  </option>
                )
              )}
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Tipo
            </span>

            <select
              value={type}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as TypeFilter;

                setTypeFilter(
                  value
                );
              }}
            >
              <option value="all">
                Todos los tipos
              </option>
              <option value="update">
                Actualización
              </option>
              <option value="content">
                Contenido
              </option>
              <option value="fix">
                Correcciones
              </option>
              <option value="improvement">
                Mejoras
              </option>
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Orden
            </span>

            <select
              value={sort}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as UpdateSort;

                setSort(value);

                replaceUrl({
                  sort: value,
                });
              }}
            >
              <option value="recent">
                Más recientes
              </option>
              <option value="oldest">
                Más antiguas
              </option>
              <option value="az">
                A — Z
              </option>
            </select>
          </label>

          <button
            type="button"
            className={`${styles.downloadFilter} ${
              download ===
              "downloadable"
                ? styles.downloadFilterActive
                : ""
            }`}
            onClick={() => {
              const value =
                download ===
                "downloadable"
                  ? "all"
                  : "downloadable";

              setDownload(
                value
              );

              replaceUrl({
                download:
                  value,
              });
            }}
            aria-pressed={
              download ===
              "downloadable"
            }
          >
            <Download
              size={16}
              aria-hidden="true"
            />
            Sólo descargables
          </button>
        </div>

        <div
          className={
            styles.filterHint
          }
        >
          <SlidersHorizontal
            size={15}
            aria-hidden="true"
          />

          <span>
            Los filtros pueden
            combinarse entre sí.
          </span>
        </div>
      </div>

      <div
        className={
          styles.contentGrid
        }
      >
        <div
          className={
            styles.listPanel
          }
        >
          <div
            className={
              styles.listHeader
            }
          >
            <div>
              <span
                className={
                  styles.listEyebrow
                }
              >
                TODAS LAS ACTUALIZACIONES
              </span>

              <h2
                id="updates-list-title"
              >
                Versiones publicadas
              </h2>

              <p>
                Cambios recientes,
                ordenados por juego y
                fecha.
              </p>
            </div>

            <span
              className={
                styles.resultCount
              }
              aria-live="polite"
            >
              <strong>
                {
                  visibleUpdates.length
                }
              </strong>
              {" "}
              de {updates.length}
            </span>
          </div>

          {visibleUpdates.length >
          0 ? (
            <div
              className={
                styles.updateList
              }
            >
              {visibleUpdates.map(
                (update) => (
                  <article
                    key={
                      update.id
                    }
                    className={
                      styles.updateRow
                    }
                  >
                    <div
                      className={
                        styles.updateImage
                      }
                    >
                      {update.game.coverImage && (
                        <GameMedia
                          src={
                            update.game
                              .coverImage
                          }
                          alt={
                            update.game
                              .imageAlt
                          }
                          sizes="(max-width: 720px) 100vw, 270px"
                          viewport={
                            update.game
                              .imageMedia
                              ?.card ??
                            update.game
                              .imageMedia
                              ?.cover
                          }
                        />
                      )}

                      <div
                        className={
                          styles.updateImageShade
                        }
                        aria-hidden="true"
                      />

                      <TypeBadge
                        type={
                          update.type
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.updateBody
                      }
                    >
                      <div
                        className={
                          styles.updateTitleRow
                        }
                      >
                        <div>
                          <h3>
                            {
                              update.game
                                .title
                            }
                          </h3>

                          <strong>
                            {
                              update.version
                            }
                          </strong>
                        </div>
                      </div>

                      <p>
                        {update.summary}
                      </p>

                      <div
                        className={
                          styles.metaRow
                        }
                      >
                        <span>
                          <CalendarDays
                            size={15}
                            aria-hidden="true"
                          />
                          {formatUpdateDate(
                            update.publishedAt
                          )}
                        </span>

                        <span>
                          <Monitor
                            size={15}
                            aria-hidden="true"
                          />
                          PC
                        </span>

                        <span
                          className={
                            styles.status
                          }
                        >
                          Disponible
                        </span>
                      </div>
                    </div>

                    <div
                      className={
                        styles.updateAction
                      }
                    >
                      {update.downloadable ? (
                        <>
                          <Link
                            href={`/juegos/${update.game.slug}/descargar`}
                            className={
                              styles.downloadSquare
                            }
                            aria-label={`Descargar ${update.game.title} ${update.version}`}
                          >
                            <Download
                              size={23}
                              aria-hidden="true"
                            />
                          </Link>

                          <span>
                            Descargar
                          </span>
                        </>
                      ) : (
                        <span
                          className={
                            styles.notAvailable
                          }
                        >
                          Sin descarga
                        </span>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          ) : (
            <div
              className={
                styles.empty
              }
              aria-live="polite"
            >
              <Search
                size={30}
                aria-hidden="true"
              />

              <h3>
                No encontramos
                actualizaciones
              </h3>

              <p>
                Prueba con otro juego,
                versión o combinación
                de filtros.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
              >
                Ver todas
              </button>
            </div>
          )}
        </div>

        <aside
          className={
            styles.sidebar
          }
          aria-label="Información de actualizaciones"
        >
          <section
            className={
              styles.sideCard
            }
          >
            <div
              className={
                styles.sideHeader
              }
            >
              <div>
                <span
                  className={
                    styles.sideEyebrow
                  }
                >
                  RECIENTES
                </span>

                <h2>
                  Últimas publicadas
                </h2>
              </div>

              <Sparkles
                size={18}
                aria-hidden="true"
              />
            </div>

            <div
              className={
                styles.recentList
              }
            >
              {recentSidebar.map(
                (update) => (
                  <Link
                    key={
                      update.id
                    }
                    href={
                      update.downloadable
                        ? `/juegos/${update.game.slug}/descargar`
                        : `/juegos/${update.game.slug}`
                    }
                  >
                    <span
                      className={
                        styles.recentThumb
                      }
                    >
                      {update.game.coverImage && (
                        <GameMedia
                          src={
                            update.game
                              .coverImage
                          }
                          alt=""
                          sizes="46px"
                          viewport={
                            update.game
                              .imageMedia
                              ?.card ??
                            update.game
                              .imageMedia
                              ?.cover
                          }
                        />
                      )}
                    </span>

                    <span
                      className={
                        styles.recentInfo
                      }
                    >
                      <span
                        className={
                          styles.recentName
                        }
                      >
                        {
                          update.game
                            .title
                        }
                      </span>

                      <small>
                        {formatUpdateDate(
                          update.publishedAt
                        )}
                      </small>
                    </span>

                    <strong>
                      {
                        update.version
                      }
                    </strong>
                  </Link>
                )
              )}
            </div>
          </section>

          <section
            className={
              styles.sideCard
            }
          >
            <span
              className={
                styles.sideEyebrow
              }
            >
              DESCARGABLES
            </span>

            <strong
              className={
                styles.bigNumber
              }
            >
              {
                downloadableGames
              }
            </strong>

            <p>
              juegos con una versión
              disponible para descargar.
            </p>

            <Link
              href="/juegos"
              className={
                styles.sideLink
              }
            >
              Explorar juegos
              <ChevronRight
                size={15}
                aria-hidden="true"
              />
            </Link>
          </section>

          <section
            className={
              styles.sideCard
            }
          >
            <span
              className={
                styles.sideEyebrow
              }
            >
              POR TIPO
            </span>

            <h2>
              Qué se publicó
            </h2>

            <div
              className={
                styles.typeStats
              }
            >
              {typeStats.map(
                (item) => (
                  <button
                    type="button"
                    key={
                      item.type
                    }
                    onClick={() =>
                      setTypeFilter(
                        item.type
                      )
                    }
                  >
                    <span>
                      <i
                        className={`${styles.typeDot} ${styles[`dot_${item.type}`]}`}
                      />
                      {
                        updateTypeLabels[
                          item.type
                        ]
                      }
                    </span>

                    <strong>
                      {
                        item.count
                      }
                    </strong>
                  </button>
                )
              )}
            </div>
          </section>

          <section
            className={
              styles.sideCard
            }
          >
            <span
              className={
                styles.sideEyebrow
              }
            >
              CÓMO FUNCIONA
            </span>

            <h2>
              Siempre la versión actual
            </h2>

            <p>
              Cada juego mantiene un
              único acceso de descarga.
              Cuando se publica una
              versión nueva, ese mismo
              acceso pasa a ofrecer la
              versión vigente.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
