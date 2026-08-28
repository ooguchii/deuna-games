import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  House,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import RequirementsExplorer from "@/components/requirements/RequirementsExplorer";
import {
  games,
  getGameBySlug,
} from "@/data/games";
import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";
import type { Game } from "@/types/game";

import styles from "./page.module.css";

const demoSlugs = [
  "forza-horizon-5",
  "god-of-war-ragnarok",
  "elden-ring",
  "red-dead-redemption-2",
  "cyberpunk-2077",
  "hogwarts-legacy",
  "helldivers-2",
  "portal-2",
] as const;

const demoGames = demoSlugs
  .map((slug) => getGameBySlug(slug))
  .filter((game): game is Game => Boolean(game));

export const metadata: Metadata = {
  title: "¿Qué puedo jugar?",
  description:
    "Explora una demostración de compatibilidad y descubre qué juegos podrían funcionar mejor según el perfil de tu PC.",
  alternates: {
    canonical: "/requisitos",
  },
  openGraph: {
    type: "website",
    url: "/requisitos",
    siteName: siteConfig.name,
    title: "¿Qué puedo jugar? | DeUna Games",
    description:
      "Compara perfiles de hardware de ejemplo y explora juegos según su rendimiento estimado.",
  },
};

export default function RequirementsPage() {
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "¿Qué puedo jugar?",
    url: absoluteUrl("/requisitos"),
    description:
      "Demostración de compatibilidad de juegos según perfiles de hardware.",
    inLanguage: siteConfig.language,
  };

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(pageJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd),
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
          <span aria-current="page">
            ¿Qué puedo jugar?
          </span>
        </nav>

        <RequirementsExplorer
          games={demoGames.length > 0 ? demoGames : games.slice(0, 8)}
        />
      </main>

      <Footer />
    </>
  );
}
