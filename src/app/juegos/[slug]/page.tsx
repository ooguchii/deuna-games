import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Download,
  Gamepad2,
  HardDrive,
  House,
  Info,
  Monitor,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import GameMedia from "@/components/ui/GameMedia";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import {
  games,
  getGameBySlug,
} from "@/data/games";
import {
  resolvedGameUpdates,
} from "@/data/updates";
import {
  resolveGameDownload,
} from "@/lib/games/download";
import {
  absoluteUrl,
  siteConfig,
} from "@/lib/site";
import { safeJsonLd } from "@/lib/safe-json-ld";
import type {
  GameHardwareRequirements,
} from "@/types/game";

import GameCompatibilityCard from "./GameCompatibilityCard";
import styles from "./page.module.css";

type GameDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type RequirementRow = {
  label: string;
  minimum?: string;
  recommended?: string;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return games.map((game) => ({
    slug: game.slug,
  }));
}

function legacyRequirements(
  requirements: GameHardwareRequirements
): GameHardwareRequirements {
  return {
    system: requirements.system,
    processor: requirements.processor,
    ram: requirements.ram,
    graphics: requirements.graphics,
    storage: requirements.storage,
  };
}

function buildRequirementRows(
  minimum: GameHardwareRequirements | undefined,
  recommended: GameHardwareRequirements | undefined
): RequirementRow[] {
  const fields: Array<{
    key: keyof GameHardwareRequirements;
    label: string;
  }> = [
    { key: "system", label: "Sistema operativo" },
    { key: "processor", label: "Procesador" },
    { key: "ram", label: "Memoria RAM" },
    { key: "graphics", label: "Gráficos" },
    { key: "storage", label: "Almacenamiento" },
  ];

  return fields
    .map(({ key, label }) => ({
      label,
      minimum: minimum?.[key],
      recommended: recommended?.[key],
    }))
    .filter(
      (row) => row.minimum || row.recommended
    );
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

  const download = resolveGameDownload(game);
  const requirements = game.requirements;
  const minimum = requirements
    ? requirements.minimum ??
      legacyRequirements(requirements)
    : undefined;
  const recommended = requirements?.recommended;
  const requirementRows = buildRequirementRows(
    minimum,
    recommended
  );

  const gameUpdates = resolvedGameUpdates
    .filter(
      (update) =>
        update.game.slug === game.slug
    )
    .slice(0, 3);

  const relatedGames = games
    .filter(
      (candidate) =>
        candidate.slug !== game.slug &&
        candidate.category === game.category
    )
    .slice(0, 4);

  const gallery = Array.from(
    new Set(
      [
        ...(game.screenshots ?? []),
        game.heroImage,
        game.coverImage,
      ].filter(
        (item): item is string =>
          typeof item === "string" &&
          item.length > 0
      )
    )
  ).slice(0, 5);

  const platforms =
    game.platforms?.length
      ? game.platforms
      : ["PC"];
  const genres =
    game.genres?.length
      ? game.genres
      : [game.category];

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
    genre: genres,
    gamePlatform: platforms,
    operatingSystem:
      minimum?.system ??
      recommended?.system,
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

            <div className={styles.heroContent}>
              <div className={styles.heroBadges}>
                <span className={styles.category}>
                  {game.category}
                </span>
                {platforms.map((platform) => (
                  <span
                    key={platform}
                    className={styles.platformBadge}
                  >
                    {platform}
                  </span>
                ))}
              </div>

              <h1 id="game-title">{game.title}</h1>

              <div className={styles.tagList}>
                {[...genres, ...(game.tags ?? [])]
                  .slice(0, 5)
                  .map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
              </div>

              <p className={styles.description}>
                {game.description}
              </p>

              <div className={styles.actions}>
                {download ? (
                  <Link
                    href={`/juegos/${game.slug}/descargar`}
                    className={styles.primaryAction}
                  >
                    <Download size={18} aria-hidden="true" />
                    Descargar
                  </Link>
                ) : (
                  <Link
                    href="#compatibility"
                    className={styles.primaryAction}
                  >
                    <Monitor size={18} aria-hidden="true" />
                    ¿Me funciona?
                  </Link>
                )}

                <Link
                  href="#compatibility"
                  className={styles.secondaryAction}
                >
                  <Monitor size={18} aria-hidden="true" />
                  Ver compatibilidad
                </Link>
              </div>
            </div>

            <aside
              className={styles.heroFacts}
              aria-label="Información rápida"
            >
              <div>
                <RefreshCcw size={17} aria-hidden="true" />
                <span>Versión</span>
                <strong>{game.version ?? "Sin publicar"}</strong>
              </div>
              <div>
                <HardDrive size={17} aria-hidden="true" />
                <span>Tamaño</span>
                <strong>
                  {download?.sizeGb
                    ? `${download.sizeGb} GB`
                    : minimum?.storage ??
                      recommended?.storage ??
                      "Sin dato"}
                </strong>
              </div>
              <div>
                <Gamepad2 size={17} aria-hidden="true" />
                <span>Plataforma</span>
                <strong>{platforms.join(", ")}</strong>
              </div>
            </aside>
          </div>
        </section>

        <nav
          className={styles.sectionNav}
          aria-label="Secciones del juego"
        >
          <a href="#information"><Info size={16} aria-hidden="true" />Información</a>
          {requirementRows.length > 0 && (
            <a href="#requirements"><Monitor size={16} aria-hidden="true" />Requisitos</a>
          )}
          {gallery.length > 0 && (
            <a href="#gallery"><Gamepad2 size={16} aria-hidden="true" />Galería</a>
          )}
          {download && (
            <a href="#installation"><Download size={16} aria-hidden="true" />Instalación</a>
          )}
          {gameUpdates.length > 0 && (
            <a href="#versions"><RefreshCcw size={16} aria-hidden="true" />Versiones</a>
          )}
        </nav>

        <section
          id="information"
          className={styles.informationLayout}
          aria-labelledby="game-info-title"
        >
          <article className={styles.informationPanel}>
            <div className={styles.sectionHeading}>
              <span>INFORMACIÓN</span>
              <h2 id="game-info-title">Acerca del juego</h2>
            </div>

            <p className={styles.longDescription}>
              {game.description}
            </p>

            <dl className={styles.detailList}>
              {game.developer && (
                <div><dt>Desarrollador</dt><dd>{game.developer}</dd></div>
              )}
              {game.publisher && (
                <div><dt>Editor</dt><dd>{game.publisher}</dd></div>
              )}
              {game.releaseDate && (
                <div><dt>Lanzamiento</dt><dd>{game.releaseDate}</dd></div>
              )}
              <div><dt>Género</dt><dd>{genres.join(", ")}</dd></div>
              <div><dt>Plataforma</dt><dd>{platforms.join(", ")}</dd></div>
            </dl>
          </article>

          <div id="compatibility">
            <GameCompatibilityCard slug={game.slug} />
          </div>
        </section>

        {requirementRows.length > 0 && (
          <section
            id="requirements"
            className={styles.sectionPanel}
            aria-labelledby="requirements-title"
          >
            <div className={styles.sectionHeading}>
              <span>REQUISITOS</span>
              <h2 id="requirements-title">Requisitos del sistema</h2>
            </div>

            <div className={styles.requirementsTableWrap}>
              <table className={styles.requirementsTable}>
                <thead>
                  <tr>
                    <th scope="col">Componente</th>
                    <th scope="col">Mínimos</th>
                    <th scope="col">Recomendados</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.minimum ?? "Sin dato"}</td>
                      <td>{row.recommended ?? "Sin dato"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section
            id="gallery"
            className={styles.sectionPanel}
            aria-labelledby="gallery-title"
          >
            <div className={styles.sectionHeading}>
              <span>GALERÍA</span>
              <h2 id="gallery-title">Capturas e imágenes</h2>
            </div>

            <div className={styles.galleryGrid}>
              {gallery.map((image, index) => (
                <figure
                  key={image}
                  className={styles.galleryItem}
                >
                  <GameMedia
                    src={image}
                    alt={`${game.title} — imagen ${index + 1}`}
                    sizes="(max-width: 700px) 100vw, 33vw"
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

        {download && (
          <section
            id="installation"
            className={styles.installationPanel}
            aria-labelledby="installation-title"
          >
            <div className={styles.installationIcon}>
              <ShieldCheck size={23} aria-hidden="true" />
            </div>
            <div>
              <span>INSTALACIÓN</span>
              <h2 id="installation-title">Descarga desde una fuente configurada</h2>
              <p>
                Elige una fuente disponible, abre el destino correspondiente y sigue las instrucciones publicadas junto con tu juego.
              </p>
            </div>
            <Link
              href={`/juegos/${game.slug}/descargar`}
              className={styles.installationAction}
            >
              Ver opciones de descarga
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        )}

        {gameUpdates.length > 0 && (
          <section
            id="versions"
            className={styles.sectionPanel}
            aria-labelledby="versions-title"
          >
            <div className={styles.sectionTopline}>
              <div className={styles.sectionHeading}>
                <span>VERSIONES</span>
                <h2 id="versions-title">Versiones recientes</h2>
              </div>
              <Link
                href={`/actualizaciones?juego=${encodeURIComponent(game.slug)}`}
              >
                Ver todas
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className={styles.versionList}>
              {gameUpdates.map((update, index) => (
                <article
                  key={update.id}
                  className={styles.versionRow}
                >
                  <div>
                    <strong>{update.version}</strong>
                    {index === 0 && <span>Actual</span>}
                  </div>
                  <p>{update.summary}</p>
                  <time dateTime={update.publishedAt}>
                    <CalendarDays size={14} aria-hidden="true" />
                    {new Intl.DateTimeFormat("es", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(update.publishedAt))}
                  </time>
                </article>
              ))}
            </div>
          </section>
        )}

        {relatedGames.length > 0 && (
          <section
            className={styles.relatedSection}
            aria-labelledby="related-title"
          >
            <div className={styles.sectionTopline}>
              <div className={styles.sectionHeading}>
                <span>DESCUBRIR</span>
                <h2 id="related-title">Juegos relacionados</h2>
              </div>
              <Link href={`/juegos?categoria=${encodeURIComponent(game.category)}`}>
                Explorar más
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className={styles.relatedGrid}>
              {relatedGames.map((related) => (
                <UniversalGameCard
                  key={related.slug}
                  game={related}
                  variant="standard"
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
