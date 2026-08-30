import type {
  Metadata,
} from "next";

import {
  CalendarDays,
  Gamepad2,
  Layers3,
  RefreshCcw,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import PublicBreadcrumb from "@/components/layout/PublicBreadcrumb";
import FeaturedUpdatesSlider from "@/components/updates/FeaturedUpdatesSlider";
import UpdatesCatalogClient from "@/components/updates/UpdatesCatalogClient";
import {
  safeJsonLd,
} from "@/lib/safe-json-ld";
import {
  buildBreadcrumbJsonLd,
} from "@/lib/seo/breadcrumb";
import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicPagesConfig,
} from "@/lib/site/public-pages-config";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
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

const infoIcons = [
  RefreshCcw,
  Gamepad2,
  Layers3,
] as const;

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
  const [params, config, publicPages] = await Promise.all([
    searchParams,
    getPublicSiteConfig(),
    getPublicPagesConfig(),
  ]);
  const filtered = hasFilters(params);
  const page = publicPages.updates;
  const title =
    `${page.title} de juegos para PC`;
  const description = page.description;

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
  const [
    params,
    resolvedGameUpdates,
    config,
    publicPages,
  ] = await Promise.all([
    searchParams,
    getPublicResolvedUpdates(),
    getPublicSiteConfig(),
    getPublicPagesConfig(),
  ]);
  const page = publicPages.updates;
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

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    page.title,
    "/actualizaciones"
  );

  const collectionJsonLd = {
    "@context":
      "https://schema.org",
    "@type":
      "CollectionPage",
    name:
      `${page.title} de juegos para PC`,
    url:
      absoluteUrl(
        "/actualizaciones"
      ),
    description:
      page.description,
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
        <PublicBreadcrumb
          className={styles.breadcrumb}
          currentLabel={page.title}
          iconSize={14}
        />

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
              {page.eyebrow}
            </span>

            <h1>
              {page.title}{" "}
              <span>
                {page.highlight}
              </span>
            </h1>

            <p>{page.description}</p>

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
          aria-label={`Cómo funciona ${page.title}`}
        >
          {page.infoCards.map((card, index) => {
            const Icon = infoIcons[index];

            return (
              <article key={`${index}-${card.title}`}>
                <span>
                  <Icon
                    size={20}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>{card.title}</strong>
                  <p>{card.text}</p>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <Footer />
    </>
  );
}
