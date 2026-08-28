import type { Metadata } from "next";

import Link from "next/link";

import {
  ChevronRight,
  House,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { games } from "@/data/games";
import GameFinderClient from "@/features/game-finder/GameFinderClient";
import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";

import styles from "./page.module.css";

type RequirementsPageProps = {
  searchParams: Promise<{
    juego?: string;
  }>;
};

export const metadata: Metadata = {
  title: "¿Qué puedo jugar con mi PC?",
  description:
    "Detecta el hardware que el navegador pueda identificar o configúralo manualmente para obtener estimaciones orientativas de FPS por juego, resolución y calidad gráfica.",
  alternates: {
    canonical: "/requisitos",
  },
  openGraph: {
    title: `¿Qué puedo jugar con mi PC? | ${siteConfig.name}`,
    description:
      "Descubre juegos para tu PC con detección local, configuración manual y estimaciones orientativas de rendimiento.",
    url: "/requisitos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `¿Qué puedo jugar con mi PC? | ${siteConfig.name}`,
    description:
      "Descubre juegos para tu PC con detección local, configuración manual y estimaciones orientativas de rendimiento.",
  },
};

export default async function RequirementsPage({
  searchParams,
}: RequirementsPageProps) {
  const { juego } = await searchParams;
  const requestedIndex =
    typeof juego === "string"
      ? games.findIndex(
          (game) => game.slug === juego
        )
      : -1;

  const orderedGames =
    requestedIndex > 0
      ? [
          games[requestedIndex],
          ...games.slice(0, requestedIndex),
          ...games.slice(requestedIndex + 1),
        ]
      : games;

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
    name: "¿Qué puedo jugar con mi PC?",
    url: absoluteUrl("/requisitos"),
    description:
      "Herramienta orientativa para comparar un perfil de hardware con juegos del catálogo de DeUna Games.",
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

        <GameFinderClient games={orderedGames} />
      </main>

      <Footer />
    </>
  );
}
