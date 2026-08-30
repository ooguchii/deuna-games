import type { Metadata } from "next";

import Link from "next/link";

import {
  ChevronRight,
  House,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import GameFinderClient from "@/features/game-finder/GameFinderClient";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import { safeJsonLd } from "@/lib/safe-json-ld";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type RequirementsSearchParams = {
  juego?: string;
};

type RequirementsPageProps = {
  searchParams: Promise<RequirementsSearchParams>;
};

const title = "¿Qué puedo jugar con mi PC?";
const description =
  "Detecta el hardware que el navegador pueda identificar o configúralo manualmente para obtener estimaciones orientativas de FPS por juego, resolución y calidad gráfica.";

export async function generateMetadata({
  searchParams,
}: RequirementsPageProps): Promise<Metadata> {
  const [params, games, config] = await Promise.all([
    searchParams,
    getPublicGames(),
    getPublicSiteConfig(),
  ]);
  const hasFocusedGame =
    typeof params.juego === "string" &&
    games.some((game) => game.slug === params.juego);

  return {
    title,
    description,
    alternates: {
      canonical: "/requisitos",
    },
    robots: hasFocusedGame
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      title: `${title} | ${config.name}`,
      description:
        "Descubre juegos para tu PC con detección local, configuración manual y estimaciones orientativas de rendimiento.",
      url: "/requisitos",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${config.name}`,
      description:
        "Descubre juegos para tu PC con detección local, configuración manual y estimaciones orientativas de rendimiento.",
    },
  };
}

export default async function RequirementsPage({
  searchParams,
}: RequirementsPageProps) {
  const [{ juego }, games, config] = await Promise.all([
    searchParams,
    getPublicGames(),
    getPublicSiteConfig(),
  ]);
  const focusedSlug =
    typeof juego === "string" &&
    games.some((game) => game.slug === juego)
      ? juego
      : undefined;
  const performanceCalibrations = Object.fromEntries(
    games.flatMap((game) =>
      game.performance
        ? [[game.slug, game.performance] as const]
        : []
    )
  );

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
        name: "¿Qué puedo jugar?",
        item: absoluteUrl("/requisitos"),
      },
    ],
  };

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: absoluteUrl("/requisitos"),
    description:
      `Herramienta orientativa para comparar un perfil de hardware con juegos del catálogo de ${config.name}.`,
    inLanguage: config.language,
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
          __html: safeJsonLd(pageJsonLd),
        }}
      />

      <Header />

      <main id="main-content" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Migas de pan">
          <Link href="/">
            <House size={13} aria-hidden="true" />
            Inicio
          </Link>

          <ChevronRight size={13} aria-hidden="true" />

          <span aria-current="page">¿Qué puedo jugar?</span>
        </nav>

        <script
          id="deuna-performance-calibrations"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(performanceCalibrations),
          }}
        />

        <GameFinderClient
          games={games}
          focusedSlug={focusedSlug}
        />
      </main>

      <Footer />
    </>
  );
}
