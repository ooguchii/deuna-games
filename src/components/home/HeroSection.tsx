"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import FramedVideo from "@/components/ui/FramedVideo";
import type { HomeCopy } from "@/data/home-config";
import { normalizeGameImageViewport } from "@/lib/media/image-viewport";
import {
  resolveGameDestinationMediaMode,
  resolveGameHeroVideo,
} from "@/lib/media/game-video-media";
import {
  resolveHeroImageTuning,
  type HeroImageTuning,
} from "@/lib/site/hero-image";
import type { Game, GameImageViewport } from "@/types/game";

import artworkStyles from "./HeroArtwork.module.css";
import styles from "./HeroSection.module.css";

const AUTOPLAY_TIME = 6500;
const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const SWIPE_THRESHOLD = 55;

type ResponsiveArtworkProps = {
  game: Game;
  alt: string;
  active?: boolean;
  ambient?: boolean;
  style?: CSSProperties;
};

function canUseFineHover() {
  return typeof window !== "undefined" && window.matchMedia(FINE_HOVER_MEDIA).matches;
}

function imageViewportForHero(game: Game) {
  return game.heroImage
    ? game.imageMedia?.hero
    : game.imageMedia?.cover;
}

function imagePosition(viewport: GameImageViewport | undefined) {
  const framed = normalizeGameImageViewport(viewport);
  return {
    framed,
    position: `${(framed.x * 100).toFixed(2)}% ${(framed.y * 100).toFixed(2)}%`,
  };
}

function ResponsiveArtwork({
  game,
  alt,
  active = false,
  ambient = false,
  style,
}: ResponsiveArtworkProps) {
  const src = game.heroImage ?? game.coverImage;

  if (!src) return null;

  const artworkClassName = ambient
    ? styles.ambientImage
    : `${styles.heroArtwork} ${artworkStyles.artwork} ${
        active ? artworkStyles.activeArtwork : ""
      }`;
  const framing = ambient
    ? null
    : imagePosition(imageViewportForHero(game));
  const artworkInlineStyle = framing
    ? ({
        ...style,
        "--hero-image-zoom": framing.framed.zoom,
        "--hero-image-position": framing.position,
        "--hero-mobile-image-zoom": framing.framed.zoom,
        "--hero-mobile-image-position": framing.position,
      } as CSSProperties)
    : style;

  return (
    <picture className={ambient ? undefined : styles.heroPicture}>
      <img
        src={src}
        alt={alt}
        className={artworkClassName}
        style={artworkInlineStyle}
        loading={active ? "eager" : "lazy"}
        fetchPriority={active ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

function NextArtwork({ game }: { game: Game }) {
  const src = game.coverImage;
  if (!src) return <span className={styles.nextFallback} aria-hidden="true" />;

  const framing = imagePosition(game.imageMedia?.cover);
  const inlineStyle = {
    "--next-image-zoom": framing.framed.zoom,
    "--next-image-position": framing.position,
  } as CSSProperties;

  return (
    <span className={styles.nextArtworkFrame} style={inlineStyle} aria-hidden="true">
      <img src={src} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

function HeroVideoLayer({
  game,
  enabled,
}: {
  game: Game;
  enabled: boolean;
}) {
  const resolved = resolveGameHeroVideo(game);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  if (
    !enabled ||
    !resolved ||
    failedSrc === resolved.src ||
    !documentVisible
  ) {
    return null;
  }

  return (
    <FramedVideo
      key={resolved.src}
      src={resolved.src}
      viewport={resolved.viewport}
      autoPlay
      loop
      controls={false}
      preload="metadata"
      tabIndex={-1}
      frameStyle={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "transparent",
      }}
      onError={() => setFailedSrc(resolved.src)}
    />
  );
}

type HeroSlideProps = {
  game: Game;
  copy: HomeCopy["hero"];
  logicalIndex: number;
  total: number;
  imageEffect: boolean;
  artworkStyle: CSSProperties;
  overlayOpacity: number;
  reducedMotion: boolean;
};

function HeroSlide({
  game,
  copy,
  logicalIndex,
  total,
  imageEffect,
  artworkStyle,
  overlayOpacity,
  reducedMotion,
}: HeroSlideProps) {
  const accessible = true;
  const hasArtwork = Boolean(game.heroImage || game.coverImage);
  const heroMode = resolveGameDestinationMediaMode(game, "hero");
  const hoverPlayback = heroMode === "hover-video";
  const videoModeEnabled = heroMode !== "image";
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const videoEnabled = !reducedMotion;
  const videoShouldRender =
    videoEnabled &&
    videoModeEnabled &&
    (!hoverPlayback || hoverPreviewActive);

  function startHoverPreview() {
    if (hoverPlayback && accessible && canUseFineHover()) {
      setHoverPreviewActive(true);
    }
  }

  function stopHoverPreview() {
    if (hoverPlayback) setHoverPreviewActive(false);
  }

  return (
    <article
      key={game.id}
      className={styles.mainCard}
      role="group"
      aria-roledescription="slide"
      aria-label={`${logicalIndex + 1} de ${total}`}
      onMouseEnter={startHoverPreview}
      onMouseLeave={stopHoverPreview}
      onFocusCapture={startHoverPreview}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
          stopHoverPreview();
        }
      }}
    >
      <div className={styles.media}>
        {hasArtwork ? (
          <ResponsiveArtwork
            game={game}
            alt={game.mediaAccessibility?.hero ?? game.imageAlt}
            active
            style={artworkStyle}
          />
        ) : (
          <div className={styles.mediaFallback} aria-hidden="true" />
        )}

        <HeroVideoLayer game={game} enabled={videoShouldRender} />

        {imageEffect && (
          <div
            className={styles.mediaOverlay}
            style={{ opacity: overlayOpacity }}
            aria-hidden="true"
          />
        )}
        <div className={styles.readabilityOverlay} aria-hidden="true" />
      </div>

      <div className={styles.content}>
        <div className={styles.badges}>
          {game.badge && <span className={styles.primaryBadge}>{game.badge}</span>}
          <span className={styles.secondaryBadge}>{game.category.toUpperCase()}</span>
        </div>

        <h2 className={styles.title}>
          <span>{game.shortTitle ?? game.title}</span>
          {game.highlightedTitle && <strong>{game.highlightedTitle}</strong>}
        </h2>

        <p className={styles.description}>{game.description}</p>

        <div className={styles.actions}>
          <Link href={`/juegos/${game.slug}`} className={styles.primaryButton}>
            <Play size={16} fill="currentColor" />
            {copy.primaryCta}
          </Link>
          <Link href={`/juegos/${game.slug}`} className={styles.secondaryButton}>
            <Info size={17} />
            {copy.secondaryCta}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function HeroSection({
  games,
  copy,
  imageEffect = false,
  imageTuning,
}: {
  games: Game[];
  copy: HomeCopy["hero"];
  imageEffect?: boolean;
  imageTuning?: Partial<HeroImageTuning>;
}) {
  const pointerStartX = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const resolvedTuning = useMemo(
    () => resolveHeroImageTuning(imageTuning),
    [imageTuning]
  );
  const artworkStyle = useMemo<CSSProperties>(
    () => ({
      filter: `brightness(${resolvedTuning.brightness}%) saturate(${resolvedTuning.saturation}%) contrast(${resolvedTuning.contrast}%)`,
    }),
    [resolvedTuning]
  );
  const ambientArtworkStyle = useMemo<CSSProperties>(() => {
    const ambientBrightness = Math.round(resolvedTuning.brightness * 0.72);
    const ambientSaturation = Math.min(240, Math.round(resolvedTuning.saturation * 1.2));
    const scale = 1.12 + resolvedTuning.ambientBlur / 450;
    return {
      opacity: resolvedTuning.ambientOpacity / 100,
      filter: `blur(${resolvedTuning.ambientBlur}px) saturate(${ambientSaturation}%) brightness(${ambientBrightness}%) contrast(${resolvedTuning.contrast}%)`,
      transform: `scale(${scale.toFixed(3)})`,
    };
  }, [resolvedTuning]);
  const overlayOpacity = resolvedTuning.overlayStrength / 100;

  const activeGame = games[activeIndex] ?? games[0];
  const nextIndex = games.length ? (activeIndex + 1) % games.length : 0;
  const nextGame = games[nextIndex] ?? activeGame;
  const isPaused = paused || manualPaused || reducedMotion;

  const moveBy = useCallback((delta: number) => {
    setActiveIndex((current) => {
      if (!games.length) return 0;
      return (current + delta + games.length) % games.length;
    });
  }, [games.length]);
  const nextSlide = useCallback(() => moveBy(1), [moveBy]);
  const previousSlide = useCallback(() => moveBy(-1), [moveBy]);

  useEffect(() => {
    setActiveIndex((current) => games.length ? Math.min(current, games.length - 1) : 0);
  }, [games.length]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isPaused || games.length <= 1) return;
    const timer = window.setTimeout(nextSlide, AUTOPLAY_TIME);
    return () => window.clearTimeout(timer);
  }, [activeIndex, games.length, isPaused, nextSlide]);

  if (!activeGame) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextSlide();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previousSlide();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") pointerStartX.current = event.clientX;
  }

  function resetPointer() {
    pointerStartX.current = null;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) return;
    const difference = pointerStartX.current - event.clientX;
    resetPointer();
    if (Math.abs(difference) < SWIPE_THRESHOLD) return;
    if (difference > 0) nextSlide();
    else previousSlide();
  }

  return (
    <section
      className={styles.heroSection}
      aria-label="Juegos destacados"
      aria-roledescription="carrusel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <h1 className={styles.srOnly}>{copy.accessibleTitle}</h1>

      {imageEffect && (
        <div className={styles.ambientBackdrop} aria-hidden="true">
          <div key={activeGame.id} className={styles.ambientFrame}>
            <ResponsiveArtwork
              game={activeGame}
              alt=""
              active
              ambient
              style={ambientArtworkStyle}
            />
          </div>
          <div className={styles.ambientShade} />
        </div>
      )}

      <div
        className={styles.heroGrid}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={resetPointer}
      >
        <div className={styles.mainStage}>
          <HeroSlide
            key={activeGame.id}
            game={activeGame}
            copy={copy}
            logicalIndex={activeIndex}
            total={games.length}
            imageEffect={imageEffect}
            artworkStyle={artworkStyle}
            overlayOpacity={overlayOpacity}
            reducedMotion={reducedMotion}
          />

          {games.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowLeft}`}
                aria-label="Juego anterior"
                onClick={previousSlide}
              >
                <ChevronLeft size={21} />
              </button>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowRight}`}
                aria-label={`Mostrar ${nextGame.title}`}
                onClick={nextSlide}
              >
                <ChevronRight size={21} />
              </button>
            </>
          )}

          <div className={styles.controls}>
            <div className={styles.dots}>
              {games.map((game, index) => (
                <button
                  key={game.id}
                  type="button"
                  className={index === activeIndex ? styles.activeDot : ""}
                  aria-label={`Mostrar ${game.title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>

            <button
              type="button"
              className={styles.pauseButton}
              aria-label={manualPaused ? "Reanudar carrusel automático" : "Pausar carrusel automático"}
              aria-pressed={manualPaused}
              onClick={() => setManualPaused((current) => !current)}
            >
              {manualPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
              <span>{manualPaused ? "Reanudar" : "Pausar"}</span>
            </button>

            <div className={styles.progress} aria-hidden="true">
              <span
                key={activeIndex}
                className={styles.progressBar}
                style={{ animationPlayState: isPaused ? "paused" : "running" }}
              />
            </div>
          </div>
        </div>

        {games.length > 1 && (
          <button
            type="button"
            className={styles.nextCard}
            aria-label={`Siguiente juego: ${nextGame.title}`}
            onClick={nextSlide}
          >
            <NextArtwork game={nextGame} />
            <span className={styles.nextShade} aria-hidden="true" />
            <span className={styles.nextCopy}>
              <small>SIGUIENTE</small>
              <strong>{nextGame.shortTitle ?? nextGame.title}</strong>
              <span>{nextGame.category}</span>
            </span>
            <span className={styles.nextArrow} aria-hidden="true">
              <ChevronRight size={20} />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
