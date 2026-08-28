import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ChevronRight,
  Gamepad2,
  HardDrive,
  House,
  MemoryStick,
  Monitor,
  RefreshCcw,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import GameMedia from "@/components/ui/GameMedia";
import {
  games,
  getGameBySlug,
} from "@/data/games";
import GamePerformanceEstimate from "@/features/game-finder/GamePerformanceEstimate";
import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";

import styles from "./page.module.css";

type GameDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return games.map((game) => ({
    slug: game.slug,
  }));
}

export async function generateMetadata({
  params,
}: GameDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    return {
      title: "Juego no encontrado",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = game.title;
  const description = game.description;
  const image = game.heroImage ?? game.coverImage;

  return {
    title,
    description,
    alternates: {
      canonical: `/juegos/${game.slug}`,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: `/juegos/${game.slug}`,
      type: "website",
      images: image
        ? [
            {
              url: image,
              alt: game.imageAlt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function GameDetailPage({
  params,
}: GameDetailPageProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Juegos",
        item: absoluteUrl("/juegos"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: game.title,
        item: absoluteUrl(`/juegos/${game.slug}`),
      },
    ],
  };

  const gameJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.description,
    url: absoluteUrl(`/juegos/${game.slug}`),
    image: game.coverImage
      ? absoluteUrl(game.coverImage)
      : undefined,
    genre: game.category,
    gamePlatform: "PC",
    operatingSystem: game.requirements?.system,
    inLanguage: siteConfig.language,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(gameJsonLd),
        }}
      />

      <Header />

      <main
        id="main-content"
        className={styles.main}
      >
        <nav
          className={styles.breadcrumb}
          aria-label="Migas de pan"
        >
          <Link href="/">
            <House size={14} aria-hidden="true" />
            Inicio
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link href="/juegos">Juegos</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{game.title}</span>
        </nav>

        <section
          className={styles.hero}
          aria-labelledby="game-title"
        >
          <div
            className={styles.heroMedia}
            aria-hidden="true"
          >
            <GameMedia
              src={game.heroImage ?? game.coverImage}
              alt=""
              sizes="100vw"
              priority
              variant="hero"
            />
            <div className={styles.heroShade} />
          </div>

          <div className={styles.heroInner}>
            <div className={styles.cover}>
              <GameMedia
                src={game.coverImage}
                alt={game.imageAlt}
                sizes="(max-width: 700px) 52vw, 260px"
              />
            </div>

            <div className={styles.content}>
              <span className={styles.category}>
                {game.category}
              </span>

              <h1 id="game-title">{game.title}</h1>
              <p className={styles.description}>
                {game.description}
              </p>

              <div
                className={styles.summary}
                aria-label="Información principal"
              >
                <span>
                  <Gamepad2 size={17} aria-hidden="true" />
                  PC
                </span>

                {game.version && (
                  <span>
                    <RefreshCcw size={17} aria-hidden="true" />
                    {game.version}
                  </span>
                )}
              </div>

              <GamePerformanceEstimate slug={game.slug} />

              <div className={styles.actions}>
                <Link
                  href={`/actualizaciones?juego=${encodeURIComponent(
                    game.slug
                  )}`}
                  className={styles.primaryAction}
                >
                  <RefreshCcw size={18} aria-hidden="true" />
                  Ver actualizaciones
                </Link>

                <Link
                  href="/juegos"
                  className={styles.secondaryAction}
                >
                  Explorar catálogo
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.information}
          aria-labelledby="game-info-title"
        >
          <div className={styles.sectionHeading}>
            <span>INFORMACIÓN DEL JUEGO</span>
            <h2 id="game-info-title">
              Lo importante, en un solo lugar
            </h2>
          </div>

          <div className={styles.infoGrid}>
            <article className={styles.infoCard}>
              <span className={styles.infoIcon}>
                <Gamepad2 size={21} aria-hidden="true" />
              </span>
              <div>
                <small>Categoría</small>
                <strong>{game.category}</strong>
              </div>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.infoIcon}>
                <Monitor size={21} aria-hidden="true" />
              </span>
              <div>
                <small>Plataforma</small>
                <strong>PC</strong>
              </div>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.infoIcon}>
                <RefreshCcw size={21} aria-hidden="true" />
              </span>
              <div>
                <small>Versión</small>
                <strong>{game.version ?? "Sin versión publicada"}</strong>
              </div>
            </article>
          </div>
        </section>

        {game.requirements && (
          <section
            className={styles.requirementsSection}
            aria-labelledby="requirements-title"
          >
            <div className={styles.sectionHeading}>
              <span>COMPATIBILIDAD</span>
              <h2 id="requirements-title">
                Requisitos disponibles
              </h2>
            </div>

            <div className={styles.requirementsGrid}>
              {game.requirements.ram && (
                <article className={styles.requirementCard}>
                  <MemoryStick size={22} aria-hidden="true" />
                  <small>Memoria RAM</small>
                  <strong>{game.requirements.ram}</strong>
                </article>
              )}

              {game.requirements.graphics && (
                <article className={styles.requirementCard}>
                  <Monitor size={22} aria-hidden="true" />
                  <small>Gráficos</small>
                  <strong>{game.requirements.graphics}</strong>
                </article>
              )}

              {game.requirements.storage && (
                <article className={styles.requirementCard}>
                  <HardDrive size={22} aria-hidden="true" />
                  <small>Almacenamiento</small>
                  <strong>{game.requirements.storage}</strong>
                </article>
              )}

              {game.requirements.system && (
                <article className={styles.requirementCard}>
                  <Monitor size={22} aria-hidden="true" />
                  <small>Sistema</small>
                  <strong>{game.requirements.system}</strong>
                </article>
              )}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
