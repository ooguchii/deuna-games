import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Gauge,
  HardDrive,
  ImageIcon,
  Monitor,
  Star,
} from "lucide-react";
import { notFound } from "next/navigation";

import GameMedia from "@/components/ui/GameMedia";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import {
  resolveGameDownload,
} from "@/lib/games/download";
import type {
  GameDownloadSourceStatus,
  GameHardwareRequirements,
} from "@/types/game";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type RequirementRow = {
  label: string;
  minimum?: string;
  recommended?: string;
};

const downloadStatusLabels: Record<
  GameDownloadSourceStatus,
  string
> = {
  available: "Disponible",
  down: "Caído",
  maintenance: "Mantenimiento",
};

function legacyMinimum(
  requirements: GameHardwareRequirements | undefined
) {
  if (!requirements) return undefined;

  const minimum: GameHardwareRequirements = {
    system: requirements.system,
    processor: requirements.processor,
    ram: requirements.ram,
    graphics: requirements.graphics,
    storage: requirements.storage,
  };

  return Object.values(minimum).some(Boolean)
    ? minimum
    : undefined;
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

function downloadHost(href: string) {
  if (href.startsWith("/")) return "Ruta interna";

  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "Dirección configurada";
  }
}

export default async function AdminGamePreviewPage({
  params,
}: PageProps) {
  await verifyAdminSession();
  const { slug } = await params;
  const item = await getEditorialItem("game", slug);

  if (!item) notFound();

  const game = item.payload;
  const download = resolveGameDownload(game);
  const requirements = game.requirements;
  const minimum =
    requirements?.minimum ??
    legacyMinimum(requirements);
  const recommended = requirements?.recommended;
  const requirementRows = buildRequirementRows(
    minimum,
    recommended
  );
  const platforms =
    game.platforms?.length
      ? game.platforms
      : ["PC"];
  const genres =
    game.genres?.length
      ? game.genres
      : [game.category];
  const visibleTags = Array.from(
    new Set([
      ...genres,
      ...(game.tags ?? []),
    ])
  ).slice(0, 8);
  const gallery = Array.from(
    new Set([
      ...(game.screenshots ?? []),
      ...(game.heroImage ? [game.heroImage] : []),
    ])
  ).slice(0, 8);
  const sources = download?.sources ?? [];

  return (
    <>
      <div className={styles.topbar}>
        <Link
          href={`/admin/juegos/${encodeURIComponent(slug)}`}
          className={styles.backLink}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al editor
        </Link>
        <Link
          href={`/juegos/${encodeURIComponent(slug)}`}
          className={styles.publicLink}
          target="_blank"
          rel="noreferrer"
        >
          Ficha pública actual
          <ExternalLink size={14} aria-hidden="true" />
        </Link>
      </div>

      <header className={styles.previewHeader}>
        <div>
          <span>VISTA PREVIA EDITORIAL</span>
          <h1>{game.title}</h1>
          <p>
            Esta pantalla usa el borrador de PostgreSQL, no el contenido público actual.
          </p>
        </div>
        <div className={styles.revisionState}>
          <strong>Revisión {item.revision}</strong>
          <span>
            {item.status === "synced"
              ? "Sin cambios"
              : "Borrador modificado"}
          </span>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBackground} aria-hidden="true">
          <GameMedia
            src={game.heroImage ?? game.coverImage}
            alt=""
            sizes="100vw"
            variant="hero"
            priority
          />
          <div className={styles.heroShade} />
        </div>

        <div className={styles.heroInner}>
          <div className={styles.cover}>
            <GameMedia
              src={game.coverImage}
              alt={game.imageAlt}
              sizes="220px"
            />
          </div>

          <div className={styles.heroCopy}>
            <div className={styles.chips}>
              <span>{game.category}</span>
              {platforms.map((platform) => (
                <span key={platform}>{platform}</span>
              ))}
            </div>

            <h2>{game.title}</h2>

            {visibleTags.length > 0 && (
              <div className={styles.tags}>
                {visibleTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}

            <p>{game.description}</p>

            {(game.rating || game.reviews) && (
              <div className={styles.rating}>
                <Star
                  size={17}
                  fill="currentColor"
                  aria-hidden="true"
                />
                {game.rating && <strong>{game.rating}</strong>}
                {game.reviews && (
                  <span>{game.reviews} valoraciones</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.factGrid}>
        <article>
          <Monitor size={18} aria-hidden="true" />
          <span>Plataformas</span>
          <strong>{platforms.join(", ")}</strong>
        </article>
        <article>
          <Gauge size={18} aria-hidden="true" />
          <span>Versión</span>
          <strong>{game.version ?? "A confirmar"}</strong>
        </article>
        <article>
          <HardDrive size={18} aria-hidden="true" />
          <span>Tamaño</span>
          <strong>
            {download?.sizeGb
              ? `${download.sizeGb} GB`
              : minimum?.storage ?? "A confirmar"}
          </strong>
        </article>
        <article>
          <Download size={18} aria-hidden="true" />
          <span>Fuentes visibles</span>
          <strong>{sources.length}</strong>
        </article>
      </section>

      <section className={styles.twoColumns}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span>INFORMACIÓN</span>
            <h2>Datos de la ficha</h2>
          </div>

          <dl className={styles.details}>
            <div>
              <dt>Desarrollador</dt>
              <dd>{game.developer ?? "Sin definir"}</dd>
            </div>
            <div>
              <dt>Editor</dt>
              <dd>{game.publisher ?? "Sin definir"}</dd>
            </div>
            <div>
              <dt>Lanzamiento</dt>
              <dd>{game.releaseDate ?? "Sin definir"}</dd>
            </div>
            <div>
              <dt>Géneros</dt>
              <dd>{genres.join(", ")}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span>PUBLICACIÓN</span>
            <h2>Estado del borrador</h2>
          </div>

          <div className={styles.publishGate}>
            <strong>
              {item.status === "synced"
                ? "El borrador coincide con la fuente importada."
                : "Hay cambios pendientes de publicación."}
            </strong>
            <p>
              El botón Publicar todavía permanece deshabilitado hasta incorporar un snapshot publicado, auditoría de publicación y mecanismo de reversión.
            </p>
            <button type="button" disabled>
              Publicar borrador
            </button>
          </div>
        </article>
      </section>

      {requirementRows.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span>REQUISITOS</span>
            <h2>Comparación del sistema</h2>
          </div>

          <div className={styles.requirementsTable}>
            <div className={styles.requirementsHead}>
              <strong>Componente</strong>
              <strong>Mínimo</strong>
              <strong>Recomendado</strong>
            </div>
            {requirementRows.map((row) => (
              <div
                key={row.label}
                className={styles.requirementsRow}
              >
                <strong>{row.label}</strong>
                <span>{row.minimum ?? "—"}</span>
                <span>{row.recommended ?? "—"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.twoColumns}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span>MULTIMEDIA</span>
            <h2>Galería del borrador</h2>
          </div>

          {gallery.length > 0 ? (
            <div className={styles.gallery}>
              {gallery.map((image, index) => (
                <div key={image} className={styles.galleryItem}>
                  <GameMedia
                    src={image}
                    alt={`Vista previa ${index + 1} de ${game.title}`}
                    sizes="(max-width: 900px) 50vw, 240px"
                    variant="hero"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <ImageIcon size={22} aria-hidden="true" />
              No hay capturas configuradas.
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span>DESCARGAS</span>
            <h2>Fuentes visibles</h2>
          </div>

          {sources.length > 0 ? (
            <div className={styles.sources}>
              {sources.map((source) => (
                <div key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{downloadHost(source.href)}</span>
                  </div>
                  <span>
                    {downloadStatusLabels[source.status]} · {source.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Download size={22} aria-hidden="true" />
              No hay fuentes activas en este borrador.
            </div>
          )}
        </article>
      </section>
    </>
  );
}
