import type {
  Metadata,
} from "next";

import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Gamepad2,
  House,
  Layers3,
  RefreshCcw,
} from "lucide-react";

import FeaturedUpdatesSlider from "@/components/updates/FeaturedUpdatesSlider";
import UpdatesCatalogClient from "@/components/updates/UpdatesCatalogClient";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  safeJsonLd,
} from "@/lib/safe-json-ld";
import {
  formatCompactUpdateDate,
  parseDownloadFilter,
  parseUpdateGameSlug,
  parseUpdateSort,
  parseUpdateType,
  sanitizeUpdateQuery,
} from "@/lib/updates/catalog";
import {
  getPublicResolvedUpdates,
} from "@/lib/updates/public-updates";

import styles from "./page.module.css";

type UpdatesSearchParams = {
  q?: string;
  juego?: string;
  tipo?: string;
  orden?: string;
  descarga?: string;
};

type UpdatesPageProps = {
  searchParams:
    Promise<UpdatesSearchParams>;
};

export const dynamic = "force-dynamic";

function hasFilters(
  params: UpdatesSearchParams
) {
  return Object.values(
    params
  ).some(
    (value) =>
      typeof value ===
        "string" &&
      value.length > 0
  );
}

export async function generateMetadata({
  searchParams,
}: UpdatesPageProps): Promise<Metadata> {
  const [params, config] = await Promise.all([
    searchParams,
    getPublicSiteConfig(),
  ]);
  const filtered = hasFilters(params);
  const title =
    "Actualizaciones de juegos para PC";
  const description =
    `Consulta las últimas versiones y actualizaciones de juegos disponibles en ${config.name}.`;

  return {
    title,
    description,

    alternates: {
      canonical:
        "/actualizaciones",
    },

    robots: filtered
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },

    openGraph: {
      title:
        `${title} | ${config.name}`,
      description,
      url:
        "/actualizaciones",
      type: "website",
    },

    twitter: {
      card:
        "summary_large_image",
      title:
        `${title} | ${config.name}`,
      description,
    },
  };
}

export default async function UpdatesPage({
  searchParams,
}: UpdatesPageProps) {
  const [params, resolvedGameUpdates, config] =
    await Promise.all([
      searchParams,
      getPublicResolvedUpdates(),
      getPublicSiteConfig(),
    ]);
  const featuredUpdates =
    resolvedGameUpdates.filter(
      (update) => update.featured
    );

  const latestUpdate =
    resolvedGameUpdates[0];

  const uniqueGames =
    new Set(
      resolvedGameUpdates.map(
        (update) =>
          update.game.slug
      )
    ).size;

  const sliderUpdates =
    featuredUpdates.length
      ? [
          ...featuredUpdates,
          ...resolvedGameUpdates.filter(
            (update) =>
              !featuredUpdates.some(
                (featured) =>
                  featured.id ===
                  update.id
              )
          ),
        ]
      : resolvedGameUpdates;

  const breadcrumbJsonLd = {
    "@context":
      "https://schema.org",
    "@type":
      "BreadcrumbList",
    itemListElement: [
      {
        "@type":
          "ListItem",
        position: 1,
        name: "Inicio",
        item:
          absoluteUrl("/"),
      },
      {
        "@type":
          "ListItem",
        position: 2,
        name:
          "Actualizaciones",
        item:
          absoluteUrl(
            "/actualizaciones"
          ),
      },
    ],
  };

  const collectionJsonLd = {
    "@context":
      "https://schema.org",
    "@type":
      "CollectionPage",
    name:
      "Actualizaciones de juegos para PC",
    url:
      absoluteUrl(
        "/actualizaciones"
      ),
    description:
      `Últimas versiones y actualizaciones de juegos disponibles en ${config.name}.`,
    inLanguage:
      config.language,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            safeJsonLd(
              breadcrumbJsonLd
            ),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            safeJsonLd(
              collectionJsonLd
            ),
        }}
      />

      <Header />

      <main
        id="main-content"
        className={
          styles.main
        }
      >
        <nav
          className={
            styles.breadcrumb
          }
          aria-label="Migas de pan"
        >
          <Link href="/">
            <House
              size={14}
              aria-hidden="true"
            />
            Inicio
          </Link>

          <ChevronRight
            size={14}
            aria-hidden="true"
          />

          <span
            aria-current="page"
          >
            Actualizaciones
          </span>
        </nav>

        <section
          className={
            styles.heroGrid
          }
        >
          <div
            className={
              styles.heroIntro
            }
          >
            <div
              className={
                styles.introGlow
              }
              aria-hidden="true"
            />

            <span
              className={
                styles.eyebrow
              }
            >
              VERSIONES Y MEJORAS
            </span>

            <h1>
              Actualizaciones{" "}
              <span>
                recientes
              </span>
            </h1>

            <p>
              Sigue las nuevas versiones de los juegos disponibles en {config.name}. Encuentra qué se actualizó y accede siempre a la versión vigente.
            </p>

            <div
              className={
                styles.statsGrid
              }
            >
              <article>
                <span
                  className={
                    styles.statIcon
                  }
                >
                  <RefreshCcw
                    size={21}
                    aria-hidden="true"
                  />
                </span>

                <strong>
                  {
                    resolvedGameUpdates.length
                  }
                </strong>

                <div>
                  <b>
                    Versiones publicadas
                  </b>
                  <span>
                    Historial disponible
                  </span>
                </div>
              </article>

              <article>
                <span
                  className={
                    styles.statIcon
                  }
                >
                  <Gamepad2
                    size={21}
                    aria-hidden="true"
                  />
                </span>

                <strong>
                  {uniqueGames}
                </strong>

                <div>
                  <b>
                    Juegos actualizados
                  </b>
                  <span>
                    Con versión registrada
                  </span>
                </div>
              </article>

              <article>
                <span
                  className={
                    styles.statIcon
                  }
                >
                  <CalendarDays
                    size={21}
                    aria-hidden="true"
                  />
                </span>

                <strong
                  className={
                    styles.statDate
                  }
                >
                  {formatCompactUpdateDate(
                    latestUpdate
                      ?.publishedAt
                  )}
                </strong>

                <div>
                  <b>
                    Última publicación
                  </b>
                  <span>
                    La más reciente
                  </span>
                </div>
              </article>
            </div>
          </div>

          <FeaturedUpdatesSlider
            updates={
              sliderUpdates
            }
          />
        </section>

        <div
          className={
            styles.sectionDivider
          }
          aria-hidden="true"
        />

        <UpdatesCatalogClient
          updates={
            resolvedGameUpdates
          }
          initialQuery={
            sanitizeUpdateQuery(
              params.q
            )
          }
          initialGameSlug={
            parseUpdateGameSlug(
              params.juego,
              resolvedGameUpdates
            )
          }
          initialType={
            parseUpdateType(
              params.tipo
            )
          }
          initialSort={
            parseUpdateSort(
              params.orden
            )
          }
          initialDownload={
            parseDownloadFilter(
              params.descarga
            )
          }
        />

        <section
          className={
            styles.infoGrid
          }
          aria-label="Cómo funciona Actualizaciones"
        >
          <article>
            <span>
              <RefreshCcw
                size={20}
                aria-hidden="true"
              />
            </span>

            <div>
              <strong>
                Versiones ordenadas
              </strong>

              <p>
                Cada publicación queda
                asociada a su juego y a
                una versión concreta.
              </p>
            </div>
          </article>

          <article>
            <span>
              <Gamepad2
                size={20}
                aria-hidden="true"
              />
            </span>

            <div>
              <strong>
                Un acceso por juego
              </strong>

              <p>
                El mismo botón de
                descarga puede ofrecer
                siempre la versión
                vigente.
              </p>
            </div>
          </article>

          <article>
            <span>
              <Layers3
                size={20}
                aria-hidden="true"
              />
            </span>

            <div>
              <strong>
                Mirrors independientes
              </strong>

              <p>
                Cambiar un enlace no
                genera una actualización;
                publicar una versión
                nueva sí.
              </p>
            </div>
          </article>
        </section>
      </main>

      <Footer />
    </>
  );
}
