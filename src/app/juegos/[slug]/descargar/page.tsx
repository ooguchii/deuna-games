import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  Download,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import {
  games,
  getGameBySlug,
} from "@/data/games";
import {
  resolveGameDownload,
} from "@/lib/games/download";

import styles from "./page.module.css";

type DownloadPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = true;

export function generateStaticParams() {
  return games
    .filter((game) => Boolean(resolveGameDownload(game)))
    .map((game) => ({
      slug: game.slug,
    }));
}

export async function generateMetadata({
  params,
}: DownloadPageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  const download = game
    ? resolveGameDownload(game)
    : null;

  if (!game || !download) {
    return {
      title: game
        ? game.title
        : "Juego no encontrado",
      alternates: game
        ? {
            canonical: `/juegos/${game.slug}`,
          }
        : undefined,
      robots: {
        index: false,
        follow: Boolean(game),
      },
    };
  }

  return {
    title: `Descargar ${game.title}`,
    description:
      `Acceso a la versión disponible de ${game.title} en DeUna Games.`,
    alternates: {
      canonical: `/juegos/${game.slug}`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function DownloadPage({
  params,
}: DownloadPageProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  const download = resolveGameDownload(game);

  if (!download) {
    redirect(`/juegos/${game.slug}`);
  }

  return (
    <>
      <Header />

      <main
        id="main-content"
        className={styles.main}
      >
        <section
          className={styles.card}
          aria-labelledby="download-title"
        >
          <span className={styles.icon}>
            <Download size={28} aria-hidden="true" />
          </span>

          <span className={styles.eyebrow}>
            DESCARGA DISPONIBLE
          </span>

          <h1 id="download-title">
            {game.title}
          </h1>

          <p>
            Esta página centraliza el acceso a la versión
            actualmente configurada para el juego.
          </p>

          <div className={styles.notice}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              El destino se obtiene únicamente de la configuración
              del juego, no de la entrada de actualización.
            </span>
          </div>

          <a
            href={download.href}
            className={styles.primary}
            rel={download.external ? "noopener noreferrer" : undefined}
          >
            {download.label}
            {download.external ? (
              <ExternalLink size={17} aria-hidden="true" />
            ) : (
              <Download size={17} aria-hidden="true" />
            )}
          </a>
        </section>
      </main>

      <Footer />
    </>
  );
}
