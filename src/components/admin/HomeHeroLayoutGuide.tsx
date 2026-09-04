import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  LayoutTemplate,
  TriangleAlert,
} from "lucide-react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import {
  evaluateGameMediaRequirements,
  isImageCropConfirmed,
  LEGACY_DESTINATION_IMAGE_ASPECTS,
  REQUIRED_DESTINATION_ASPECTS,
} from "@/lib/media/game-media-requirements";
import {
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type { Game } from "@/types/game";

import styles from "./HomeHeroLayoutGuide.module.css";

function HeroDestinationPreview({ game }: { game: Game }) {
  const mode = resolveGameDestinationMediaMode(game, "hero");
  const video = game.videoMedia?.hero;

  if (mode === "video" && video?.clip) {
    return (
      <AdminMediaThumbnail
        kind="video"
        src={video.clip}
        mode="destination"
        viewport={video.viewport}
        frameAspect={3}
        sizes="900px"
        label={`Hero 3:1 de ${game.title}`}
      />
    );
  }

  const src = game.heroImage ?? game.coverImage;
  if (!src) {
    return (
      <span className={styles.emptyFrame} aria-label="Hero sin imagen asignada">
        <ImageIcon size={24} aria-hidden="true" />
      </span>
    );
  }

  return (
    <AdminMediaThumbnail
      kind="image"
      src={src}
      mode="destination"
      viewport={game.heroImage ? game.imageMedia?.hero : game.imageMedia?.cover}
      frameAspect={3}
      sizes="900px"
      label={`Hero 3:1 de ${game.title}`}
    />
  );
}

function NextDestinationPreview({ game }: { game: Game }) {
  if (!game.coverImage) {
    return (
      <span className={styles.emptyFrame} aria-label="Vista Siguiente sin imagen de Portada">
        <ImageIcon size={24} aria-hidden="true" />
      </span>
    );
  }

  return (
    <AdminMediaThumbnail
      kind="image"
      src={game.coverImage}
      mode="destination"
      viewport={game.imageMedia?.cover}
      frameAspect={4 / 5}
      sizes="220px"
      label={`Portada 4:5 de ${game.title} como vista Siguiente`}
    />
  );
}

function nextPreviewReady(game: Game) {
  return Boolean(
    game.coverImage &&
    isImageCropConfirmed(
      game.imageMedia?.cover,
      REQUIRED_DESTINATION_ASPECTS.cover,
      LEGACY_DESTINATION_IMAGE_ASPECTS.cover
    )
  );
}

function Status({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <span className={styles.status} data-ready={ready}>
      {ready ? <CheckCircle2 size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default function HomeHeroLayoutGuide({ games }: { games: Game[] }) {
  if (games.length === 0) return null;

  const active = games[0];
  const next = games[1] ?? games[0];
  const activeRequirements = evaluateGameMediaRequirements(active);
  const nextCoverReady = nextPreviewReady(next);

  return (
    <section className={styles.guide} aria-labelledby="home-hero-layout-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>COMPOSICIÓN REAL DE INICIO</span>
          <h3 id="home-hero-layout-title">Hero compacto y vista Siguiente</h3>
          <p>
            El Hero principal usa un recorte panorámico 3:1. La tarjeta pequeña de la derecha ya no es un pedazo del siguiente Hero: usa exclusivamente la imagen de Portada 4:5 del siguiente juego.
          </p>
        </div>
        <div className={styles.contract}>
          <span>Contrato visual</span>
          <strong>Hero 3:1</strong>
          <strong>Siguiente 4:5</strong>
        </div>
      </header>

      <div className={styles.composition}>
        <article className={styles.previewCard} data-kind="hero">
          <div className={styles.previewFrame} data-kind="hero">
            <HeroDestinationPreview game={active} />
          </div>
          <div className={styles.previewMeta}>
            <div>
              <strong>{active.title}</strong>
              <span>Hero principal · 3:1</span>
            </div>
            <Status ready={activeRequirements.hero.cropReady}>
              {activeRequirements.hero.cropReady ? "Recorte listo" : "Reconfirmar"}
            </Status>
          </div>
          <div className={styles.actions}>
            <Link href={`/admin/juegos/${encodeURIComponent(active.slug)}?seccion=multimedia`}>
              <LayoutTemplate size={15} aria-hidden="true" />
              Editar Hero 3:1
            </Link>
          </div>
        </article>

        <article className={styles.previewCard} data-kind="next">
          <div className={styles.previewFrame} data-kind="next">
            <NextDestinationPreview game={next} />
          </div>
          <div className={styles.previewMeta}>
            <div>
              <strong>{next.title}</strong>
              <span>Siguiente · Portada 4:5</span>
            </div>
          </div>
          <Status ready={nextCoverReady}>
            {nextCoverReady ? "Vista lista" : "Falta Portada 4:5"}
          </Status>
          <div className={styles.actions}>
            <Link href={`/admin/juegos/${encodeURIComponent(next.slug)}?seccion=multimedia`}>
              Editar Portada
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>

      <div className={styles.queue}>
        <div className={styles.queueTitle}>
          <strong>Estado de los juegos del carrusel</strong>
          <span>El orden corresponde a la vista previa de Curaduría.</span>
        </div>
        <ol className={styles.queueList}>
          {games.slice(0, 4).map((game, index) => {
            const requirements = evaluateGameMediaRequirements(game);
            const coverReady = nextPreviewReady(game);
            return (
              <li key={game.slug}>
                <strong>{index + 1}. {game.title}</strong>
                <div className={styles.queueChecks}>
                  <span data-ready={requirements.hero.cropReady}>
                    {requirements.hero.cropReady ? <CheckCircle2 size={12} aria-hidden="true" /> : <TriangleAlert size={12} aria-hidden="true" />}
                    Hero 3:1
                  </span>
                  <span data-ready={coverReady}>
                    {coverReady ? <CheckCircle2 size={12} aria-hidden="true" /> : <TriangleAlert size={12} aria-hidden="true" />}
                    Portada 4:5
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
