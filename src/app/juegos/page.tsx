import type {
  Metadata,
} from "next";

import Link from "next/link";

import {
  ChevronRight,
  House,
} from "lucide-react";

import GameCatalogClient from "@/components/games/GameCatalogClient";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import {
  buildHomeGameCollections,
} from "@/data/home";
import {
  parseCategory,
  parseEquipmentFilter,
  parseMinimumRating,
  parseSearchScope,
  parseSortMode,
  parseStatusFilter,
  parseViewMode,
  sanitizeCatalogQuery,
} from "@/lib/games/catalog";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import {
  getPublicTaxonomyPresentation,
} from "@/lib/games/public-taxonomy";
import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  safeJsonLd,
} from "@/lib/safe-json-ld";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type GamesSearchParams = {
  categoria?: string;
  orden?: string;
  q?: string;
  buscarEn?: string;
  puntuacion?: string;
  equipo?: string;
  estado?: string;
  vista?: string;
};

type GamesPageProps = {
  searchParams:
    Promise<GamesSearchParams>;
};

function hasCatalogFilters(
  params: GamesSearchParams
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
}: GamesPageProps): Promise<Metadata> {
  const [params, config] = await Promise.all([
    searchParams,
    getPublicSiteConfig(),
  ]);
  const filtered =
    hasCatalogFilters(
      params
    );
  const title =
    "Juegos para PC";
  const description =
    `Explora el catálogo de ${config.name} y encuentra juegos por clasificación, popularidad, puntuación, requisitos y estado.`;

  return {
    title,
    description,

    alternates: {
      canonical: "/juegos",
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
      url: "/juegos",
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

export default async function GamesPage({
  searchParams,
}: GamesPageProps) {
  const [params, games, config, taxonomy] = await Promise.all([
    searchParams,
    getPublicGames(),
    getPublicSiteConfig(),
    getPublicTaxonomyPresentation(),
  ]);
  const collections =
    buildHomeGameCollections(games);

  const description =
    "Explora nuestro catálogo, filtra por clasificación, puntuación, requisitos o popularidad y encuentra exactamente lo que quieres jugar.";

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
        name: "Juegos",
        item:
          absoluteUrl(
            "/juegos"
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
      "Juegos para PC",
    url:
      absoluteUrl(
        "/juegos"
      ),
    description,
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
        <section
          className={
            styles.hero
          }
          aria-labelledby="games-title"
        >
          <div
            className={
              styles.heroImage
            }
            aria-hidden="true"
          />

          <div
            className={
              styles.heroShade
            }
            aria-hidden="true"
          />

          <div
            className={
              styles.heroGlow
            }
            aria-hidden="true"
          />

          <nav
            className={
              styles.breadcrumb
            }
            aria-label="Migas de pan"
          >
            <Link href="/">
              <House
                size={13}
                aria-hidden="true"
              />
              Inicio
            </Link>

            <ChevronRight
              size={13}
              aria-hidden="true"
            />

            <span
              aria-current="page"
            >
              Juegos
            </span>
          </nav>

          <div
            className={
              styles.heroContent
            }
          >
            <span
              className={
                styles.eyebrow
              }
            >
              CATÁLOGO DE JUEGOS
            </span>

            <h1
              id="games-title"
            >
              Juegos
            </h1>

            <p>
              {description}
            </p>

            <div
              className={
                styles.heroMeta
              }
              aria-label="Resumen del catálogo"
            >
              <span>
                <strong>
                  {games.length}
                </strong>
                títulos
              </span>

              <span
                aria-hidden="true"
              >
                •
              </span>

              <span>
                PC
              </span>
            </div>
          </div>
        </section>

        <GameCatalogClient
          games={games}
          categoryTerms={taxonomy.classifications}
          lowSpecSlugs={
            collections.lowSpecGames.map(
              (game) =>
                game.slug
            )
          }
          initialCategory={
            parseCategory(
              params.categoria,
              games
            )
          }
          initialSort={
            parseSortMode(
              params.orden
            )
          }
          initialQuery={
            sanitizeCatalogQuery(
              params.q
            )
          }
          initialSearchScope={
            parseSearchScope(
              params.buscarEn
            )
          }
          initialRating={
            parseMinimumRating(
              params.puntuacion
            )
          }
          initialEquipment={
            parseEquipmentFilter(
              params.equipo
            )
          }
          initialStatus={
            parseStatusFilter(
              params.estado
            )
          }
          initialView={
            parseViewMode(
              params.vista
            )
          }
        />
      </main>

      <Footer />
    </>
  );
}
