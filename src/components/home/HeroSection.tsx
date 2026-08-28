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
  forwardRef,
  type KeyboardEvent,
  type PointerEvent,
  type TransitionEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { heroGames as games } from "@/data/home";
import type { Game } from "@/types/game";

import artworkStyles from "./HeroArtwork.module.css";
import styles from "./HeroSection.module.css";

const AUTOPLAY_TIME = 6500;
const MOBILE_ART_MEDIA = "(max-width: 520px)";

type TrackSlide = {
  key: string;
  game: Game;
  logicalIndex: number;
  clone: boolean;
};

type ResponsiveArtworkProps = {
  game: Game;
  alt: string;
  active?: boolean;
  ambient?: boolean;
};

function ResponsiveArtwork({
  game,
  alt,
  active = false,
  ambient = false,
}: ResponsiveArtworkProps) {
  const desktopSrc = game.heroImage ?? game.coverImage;
  const mobileSrc = game.coverImage ?? game.heroImage;
  const fallbackSrc = desktopSrc ?? mobileSrc;

  if (!fallbackSrc) {
    return null;
  }

  const artworkClassName = ambient
    ? styles.ambientImage
    : `${styles.heroArtwork} ${artworkStyles.artwork} ${
        active ? artworkStyles.activeArtwork : ""
      }`;

  return (
    <picture className={ambient ? undefined : styles.heroPicture}>
      {mobileSrc && mobileSrc !== desktopSrc && (
        <source media={MOBILE_ART_MEDIA} srcSet={mobileSrc} />
      )}

      {/*
       * Las imágenes del catálogo ya están preoptimizadas en WebP.
       * picture evita descargar hero + cover simultáneamente y deja
       * que el navegador elija una sola variante por viewport.
       */}
      <img
        src={fallbackSrc}
        alt={alt}
        className={artworkClassName}
        loading={active ? "eager" : "lazy"}
        fetchPriority={active ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

type HeroSlideProps = {
  game: Game;
  logicalIndex: number;
  total: number;
  clone?: boolean;
  active?: boolean;
};

const HeroSlide = forwardRef<HTMLElement, HeroSlideProps>(
  function HeroSlide(
    {
      game,
      logicalIndex,
      total,
      clone = false,
      active = false,
    },
    ref
  ) {
    const accessible = active && !clone;
    const hasArtwork = Boolean(game.heroImage || game.coverImage);

    return (
      <article
        ref={ref}
        className={`${styles.slide} ${active ? styles.activeSlide : ""}`}
        role={accessible ? "group" : undefined}
        aria-roledescription={accessible ? "slide" : undefined}
        aria-label={accessible ? `${logicalIndex + 1} de ${total}` : undefined}
        aria-hidden={!accessible}
      >
        <div className={styles.media}>
          {hasArtwork ? (
            <ResponsiveArtwork
              game={game}
              alt={accessible ? game.imageAlt : ""}
              active={active}
            />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true" />
          )}

          <div className={styles.mediaOverlay} />

          {!active && (
            <div className={styles.previewOverlay} aria-hidden="true" />
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.badges}>
            {game.badge && (
              <span className={styles.primaryBadge}>{game.badge}</span>
            )}

            <span className={styles.secondaryBadge}>
              {game.category.toUpperCase()}
            </span>
          </div>

          <h2 className={styles.title}>
            <span>{game.shortTitle ?? game.title}</span>
            {game.highlightedTitle && <strong>{game.highlightedTitle}</strong>}
          </h2>

          <p className={styles.description}>{game.description}</p>

          <div className={styles.actions}>
            <Link
              href={`/juegos/${game.slug}`}
              className={styles.primaryButton}
              tabIndex={accessible ? 0 : -1}
            >
              <Play size={17} fill="currentColor" />
              Ver juego
            </Link>

            <Link
              href={`/juegos/${game.slug}`}
              className={styles.secondaryButton}
              tabIndex={accessible ? 0 : -1}
            >
              <Info size={18} />
              Más información
            </Link>
          </div>
        </div>
      </article>
    );
  }
);

function logicalIndexFromPhysical(physicalIndex: number) {
  if (physicalIndex === 0) {
    return games.length - 1;
  }

  if (physicalIndex === games.length + 1) {
    return 0;
  }

  return physicalIndex - 1;
}

export default function HeroSection() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const pointerStartX = useRef<number | null>(null);
  const resizeFrameOneRef = useRef<number | null>(null);
  const resizeFrameTwoRef = useRef<number | null>(null);

  const trackSlides = useMemo<TrackSlide[]>(() => {
    const first = games[0]!;
    const last = games[games.length - 1]!;

    return [
      {
        key: "clone-last",
        game: last,
        logicalIndex: games.length - 1,
        clone: true,
      },
      ...games.map((game, index) => ({
        key: game.id,
        game,
        logicalIndex: index,
        clone: false,
      })),
      {
        key: "clone-first",
        game: first,
        logicalIndex: 0,
        clone: true,
      },
    ];
  }, []);

  const [physicalIndex, setPhysicalIndex] = useState(1);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeIndex = logicalIndexFromPhysical(physicalIndex);
  const activeGame = games[activeIndex]!;
  const nextGame = games[(activeIndex + 1) % games.length]!;
  const isPaused = paused || manualPaused || reducedMotion;

  const measureSlides = useCallback(() => {
    const viewport = viewportRef.current;
    const firstRealSlide = slideRefs.current[1];

    if (!viewport || !firstRealSlide) {
      return;
    }

    const computedStyle = window.getComputedStyle(viewport);
    const gap =
      Number.parseFloat(computedStyle.getPropertyValue("--slide-gap")) || 0;
    const slideWidth = firstRealSlide.getBoundingClientRect().width;

    setStep(slideWidth + gap);
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    function cancelResizeFrames() {
      if (resizeFrameOneRef.current !== null) {
        cancelAnimationFrame(resizeFrameOneRef.current);
      }

      if (resizeFrameTwoRef.current !== null) {
        cancelAnimationFrame(resizeFrameTwoRef.current);
      }

      resizeFrameOneRef.current = null;
      resizeFrameTwoRef.current = null;
    }

    function snapAfterResize() {
      cancelResizeFrames();
      setJumping(true);
      setAnimating(false);

      setPhysicalIndex((current) => {
        if (current === 0) {
          return games.length;
        }

        if (current === games.length + 1) {
          return 1;
        }

        return current;
      });

      measureSlides();

      resizeFrameOneRef.current = requestAnimationFrame(() => {
        resizeFrameTwoRef.current = requestAnimationFrame(() => {
          setJumping(false);
          resizeFrameOneRef.current = null;
          resizeFrameTwoRef.current = null;
        });
      });
    }

    snapAfterResize();

    const observer = new ResizeObserver(snapAfterResize);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      cancelResizeFrames();
    };
  }, [measureSlides]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updatePreference = () => {
      setReducedMotion(media.matches);
    };

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => {
      media.removeEventListener("change", updatePreference);
    };
  }, []);

  const moveToPhysical = useCallback(
    (target: number) => {
      if (!ready || animating || jumping) {
        return;
      }

      if (reducedMotion) {
        let normalizedTarget = target;

        if (target === 0) {
          normalizedTarget = games.length;
        }

        if (target === games.length + 1) {
          normalizedTarget = 1;
        }

        setPhysicalIndex(normalizedTarget);
        return;
      }

      setAnimating(true);
      setPhysicalIndex(target);
    },
    [animating, jumping, ready, reducedMotion]
  );

  const nextSlide = useCallback(() => {
    moveToPhysical(physicalIndex + 1);
  }, [moveToPhysical, physicalIndex]);

  const previousSlide = useCallback(() => {
    moveToPhysical(physicalIndex - 1);
  }, [moveToPhysical, physicalIndex]);

  const goToSlide = useCallback(
    (logicalIndex: number) => {
      if (logicalIndex === activeIndex || animating || jumping) {
        return;
      }

      moveToPhysical(logicalIndex + 1);
    },
    [activeIndex, animating, jumping, moveToPhysical]
  );

  function finishCloneJump(target: number) {
    setJumping(true);
    setPhysicalIndex(target);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setJumping(false);
        setAnimating(false);
      });
    });
  }

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (
      event.target !== trackRef.current ||
      event.propertyName !== "transform"
    ) {
      return;
    }

    if (physicalIndex === 0) {
      finishCloneJump(games.length);
      return;
    }

    if (physicalIndex === games.length + 1) {
      finishCloneJump(1);
      return;
    }

    setAnimating(false);
  }

  useEffect(() => {
    if (isPaused || !ready || animating || jumping) {
      return;
    }

    const timer = window.setTimeout(nextSlide, AUTOPLAY_TIME);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, animating, isPaused, jumping, nextSlide, ready]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextSlide();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previousSlide();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") {
      return;
    }

    pointerStartX.current = event.clientX;
  }

  function resetPointer() {
    pointerStartX.current = null;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) {
      return;
    }

    const difference = pointerStartX.current - event.clientX;
    resetPointer();

    if (Math.abs(difference) < 55) {
      return;
    }

    if (difference > 0) {
      nextSlide();
      return;
    }

    previousSlide();
  }

  const transform =
    step > 0
      ? `translateX(-${physicalIndex * step}px)`
      : "translateX(0)";

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

        if (
          !nextTarget ||
          !event.currentTarget.contains(nextTarget as Node)
        ) {
          setPaused(false);
        }
      }}
    >
      <h1 className={styles.srOnly}>
        Descubre juegos para PC en DeUna Games
      </h1>

      <div className={styles.ambientBackdrop} aria-hidden="true">
        <div key={activeGame.id} className={styles.ambientFrame}>
          <ResponsiveArtwork game={activeGame} alt="" active ambient />
        </div>
        <div className={styles.ambientShade} />
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={resetPointer}
      >
        <div
          ref={trackRef}
          className={`${styles.track} ${
            jumping ? styles.noTransition : ""
          } ${ready ? styles.trackReady : ""}`}
          style={{ transform }}
          onTransitionEnd={handleTransitionEnd}
        >
          {trackSlides.map((trackSlide, trackIndex) => (
            <HeroSlide
              key={trackSlide.key}
              ref={(element) => {
                slideRefs.current[trackIndex] = element;
              }}
              game={trackSlide.game}
              logicalIndex={trackSlide.logicalIndex}
              total={games.length}
              clone={trackSlide.clone}
              active={trackIndex === physicalIndex}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        aria-label="Juego anterior"
        onClick={previousSlide}
      >
        <ChevronLeft size={23} />
      </button>

      <button
        type="button"
        className={styles.previewAdvance}
        aria-label={`Mostrar ${nextGame.title}`}
        onClick={nextSlide}
      />

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        aria-label={`Mostrar ${nextGame.title}`}
        onClick={nextSlide}
      >
        <ChevronRight size={23} />
      </button>

      <div className={styles.controls}>
        <div className={styles.dots}>
          {games.map((game, index) => (
            <button
              key={game.id}
              type="button"
              className={index === activeIndex ? styles.activeDot : ""}
              aria-label={`Mostrar ${game.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.pauseButton}
          aria-label={
            manualPaused
              ? "Reanudar carrusel automático"
              : "Pausar carrusel automático"
          }
          aria-pressed={manualPaused}
          onClick={() => setManualPaused((current) => !current)}
        >
          {manualPaused ? (
            <Play size={13} fill="currentColor" />
          ) : (
            <Pause size={13} fill="currentColor" />
          )}
          <span>{manualPaused ? "Reanudar" : "Pausar"}</span>
        </button>

        <div className={styles.progress} aria-hidden="true">
          <span
            key={activeIndex}
            className={styles.progressBar}
            style={{
              animationPlayState: isPaused ? "paused" : "running",
            }}
          />
        </div>
      </div>
    </section>
  );
}
