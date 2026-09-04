import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  LayoutTemplate,
  TriangleAlert,
} from "lucide-react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import {
  HOME_HERO_MAX_SLIDES,
  HOME_HERO_VISIBLE_PREVIEWS,
} from "@/lib/home/hero-contract";
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

function CoverDestinationPreview({ game }: { game: Game }) {
  if (!game.coverImage) {
    return (
      <span className={styles.emptyFrame} aria-label="Vista de Portada sin imagen asignada">
        <ImageIcon size={20} aria-hidden="true" />
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
      label={`Portada 4:5 de ${game.title}`}
    />
  );
}

function coverPreviewReady(game: Game) {
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
  const previews = games.slice(
    1,
    Math.min(games.length, HOME_HERO_VISIBLE_PREVIEWS + 1)
  );
  const activeRequirements = evaluateGameMediaRequirements(active);

  return (
    <section className={styles.guide} aria-labelledby="home-hero-layout-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>COMPOSICIÓN REAL DE INICIO</span>
          <h3 id="home-hero-layout-title">Carrusel cinematográfico con profundidad</h3>
          <p>
            El juego activo conserva su recurso Hero y los próximos títulos aparecen como una pila de Portadas 4:5. En escritorio la transición desplaza cada tarjeta hacia su nueva posición; en móvil la pila se simplifica para preservar legibilidad y swipe.
          </p>
        </div>
        <div className={styles.contract}>
          <span>Contrato multimedia</span>
          <strong>Hero · 3:1</strong>
          <strong>Previews · Portada 4:5</strong>
          <strong>Hasta {HOME_HERO_MAX_SLIDES} juegos visibles</strong>
        </div>
      </header>

      <div className={styles.cinematicPreview}>
        <article className={styles.heroPane}>
          <div className={styles.heroFrame}>
            <HeroDestinationPreview game={active} />
            <span className={styles.heroShade} aria-hidden="true" />
            <span className={styles.heroMockCopy} aria-hidden="true">
              <small>{active.category}</small>
              <strong>{active.shortTitle ?? active.title}</strong>
              {active.highlightedTitle && <b>{active.highlightedTitle}</b>}
            </span>
          </div>

          <div className={styles.previewMeta}>
            <div>
              <strong>{active.title}</strong>
              <span>Juego activo · recurso Hero</span>
            </div>
            <Status ready={activeRequirements.hero.cropReady}>
              {activeRequirements.hero.cropReady ? "Hero listo" : "Reconfirmar Hero"}
            </Status>
          </div>

          <div className={styles.actions}>
            <Link href={`/admin/juegos/${encodeURIComponent(active.slug)}?seccion=multimedia`}>
              <LayoutTemplate size={15} aria-hidden="true" />
              Editar Hero
            </Link>
          </div>
        </article>

        <div className={styles.previewStack} aria-label="Próximos juegos del carrusel">
          {previews.length > 0 ? previews.map((game, index) => (
            <article
              key={game.slug}
              className={styles.stackCard}
              style={{ "--stack-index": index } as CSSProperties}
            >
              <div className={styles.coverFrame}>
                <CoverDestinationPreview game={game} />
                <span className={styles.coverShade} aria-hidden="true" />
                <strong>{game.shortTitle ?? game.title}</strong>
              </div>
              <Status ready={coverPreviewReady(game)}>
                {coverPreviewReady(game) ? "Portada lista" : "Falta Portada 4:5"}
              </Status>
            </article>
          )) : (
            <div className={styles.noPreviews}>
              Añade más juegos al Hero para ver la pila cinematográfica.
            </div>
          )}
        </div>
      </div>

      <div className={styles.queue}>
        <div className={styles.queueTitle}>
          <strong>Estado de los juegos del carrusel</strong>
          <span>El orden corresponde a la vista previa publicada de Curaduría.</span>
        </div>
        <ol className={styles.queueList}>
          {games.slice(0, HOME_HERO_MAX_SLIDES).map((game, index) => {
            const requirements = evaluateGameMediaRequirements(game);
            const coverReady = coverPreviewReady(game);
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
                <div className={styles.actions}>
                  <Link href={`/admin/juegos/${encodeURIComponent(game.slug)}?seccion=multimedia`}>
                    Multimedia
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
