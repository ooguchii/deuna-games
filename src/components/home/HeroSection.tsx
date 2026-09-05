"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Info,
  Pause,
  Play,
  Star,
  Tag,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import FramedVideo from "@/components/ui/FramedVideo";
import GameMedia from "@/components/ui/GameMedia";
import type { HomeHeroPresentation } from "@/data/home-config";
import {
  HOME_HERO_AUTOPLAY_MS,
  formatHomeHeroPosition,
} from "@/lib/home/hero-contract";
import {
  HOME_HERO_VISUAL_POSITIONS,
  homeHeroPositionDisplay,
  homeHeroAnchor,
  homeHeroPositionOffset,
  homeHeroPositionTransform,
  homeHeroSlotCSS,
  fitHomeHeroBounds,
  type HomeHeroVisualPosition,
} from "@/lib/home/hero-layout";
import {
  resolveGameDestinationMediaMode,
  resolveGameHeroVideo,
} from "@/lib/media/game-video-media";
import {
  resolveHeroImageTuning,
  type HeroImageTuning,
} from "@/lib/site/hero-image";
import type { Game } from "@/types/game";

import artworkStyles from "./HeroArtwork.module.css";
import styles from "./HeroSection.module.css";

const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const SWIPE_THRESHOLD = 55;
const HERO_PRIMARY_ACTION = "Ver juego";
const HERO_SECONDARY_ACTION = "Más información";

type HeroFact = {
  kind: "rating" | "developer" | "release" | "platforms" | "version";
  label: string;
};

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
  const viewport = game.heroImage ? game.imageMedia?.hero : game.imageMedia?.cover;
  // The carousel owns its dimensions; gallery aspect metadata cannot resize it.
  return viewport ? { ...viewport, aspect: undefined } : undefined;
}

function classificationLine(game: Game) {
  const values = [game.category, ...(game.genres ?? [])];
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("es");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value.toLocaleUpperCase("es"));
    if (unique.length === 3) break;
  }

  return unique;
}

function heroTitleParts(game: Game) {
  const base = (game.shortTitle ?? game.title).trim();
  const highlight = game.highlightedTitle?.trim() ?? "";
  const comparableBase = base.toLocaleLowerCase("es");
  const comparableHighlight = highlight.toLocaleLowerCase("es");
  const highlightAlreadyIncluded = Boolean(
    comparableHighlight &&
      (comparableBase === comparableHighlight ||
        comparableBase.endsWith(` ${comparableHighlight}`))
  );

  return {
    base,
    highlight: highlightAlreadyIncluded ? "" : highlight,
  };
}

function formatReleaseDate(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const localDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (localDate) {
    const [, day, month, year] = localDate;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsed.valueOf())) {
      return new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  }

  return trimmed;
}

function heroFacts(game: Game): HeroFact[] {
  const facts: HeroFact[] = [];

  if (typeof game.rating === "number") {
    const reviews = game.reviews?.trim();
    facts.push({
      kind: "rating",
      label: `${game.rating.toFixed(1)}${reviews ? ` · ${reviews} reseñas` : ""}`,
    });
  }

  if (game.developer?.trim()) {
    facts.push({ kind: "developer", label: game.developer.trim() });
  }

  const release = formatReleaseDate(game.releaseDate);
  if (release) {
    facts.push({ kind: "release", label: release });
  }

  if (game.platforms?.length) {
    facts.push({ kind: "platforms", label: game.platforms.join(" · ") });
  }

  if (facts.length < 4 && game.version?.trim()) {
    facts.push({ kind: "version", label: `Versión ${game.version.trim()}` });
  }

  return facts.slice(0, 4);
}

function FactIcon({ kind }: { kind: HeroFact["kind"] }) {
  if (kind === "rating") return <Star size={17} fill="currentColor" aria-hidden="true" />;
  if (kind === "developer") return <Building2 size={17} aria-hidden="true" />;
  if (kind === "release") return <CalendarDays size={17} aria-hidden="true" />;
  if (kind === "platforms") return <Gamepad2 size={17} aria-hidden="true" />;
  return <Tag size={17} aria-hidden="true" />;
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

  if (ambient) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className={styles.ambientImage}
        style={style}
      />
    );
  }

  return (
    <span
      className={`${styles.heroPicture} ${artworkStyles.artworkFrame}`}
      style={style}
    >
      <GameMedia
        src={src}
        alt={alt}
        sizes="(max-width: 680px) 92vw, (max-width: 1100px) 88vw, 78vw"
        priority={active}
        variant="hero"
        viewport={imageViewportForHero(game)}
        imageClassName={styles.heroArtwork}
      />
    </span>
  );
}

function HeroVideoLayer({ game, enabled }: { game: Game; enabled: boolean }) {
  const resolved = resolveGameHeroVideo(game);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  if (!enabled || !resolved || failedSrc === resolved.src || !documentVisible) {
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
        zIndex: 1,
        pointerEvents: "none",
        background: "transparent",
      }}
      onError={() => setFailedSrc(resolved.src)}
    />
  );
}

function MainCardContent({ game }: { game: Game }) {
  const classifications = classificationLine(game);
  const facts = heroFacts(game);
  const title = heroTitleParts(game);

  return (
    <div className={styles.content}>
      {classifications.length > 0 && (
        <div className={styles.classificationLine} aria-label="Clasificación del juego">
          {classifications.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}

      <h2 className={styles.title}>
        <span>{title.base}</span>
        {title.highlight && <strong>{title.highlight}</strong>}
      </h2>

      <p className={styles.description}>{game.description}</p>

      {facts.length > 0 && (
        <div className={styles.facts} aria-label="Información principal del juego">
          {facts.map((fact) => (
            <span className={styles.fact} key={`${fact.kind}-${fact.label}`}>
              <FactIcon kind={fact.kind} />
              <span>{fact.label}</span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <Link href={`/juegos/${game.slug}`} className={styles.primaryButton}>
          <Play size={17} fill="currentColor" aria-hidden="true" />
          {HERO_PRIMARY_ACTION}
        </Link>
        <Link href={`/juegos/${game.slug}`} className={styles.secondaryButton}>
          <Info size={18} aria-hidden="true" />
          {HERO_SECONDARY_ACTION}
        </Link>
      </div>
    </div>
  );
}

function deviceVariables(
  presentation: HomeHeroPresentation,
  totalGames: number
) {
  const variables: Record<string, string | number> = {
    "--hero-slide-offset": presentation.direction === "reverse" ? "-90px" : "90px",
    "--hero-editor-radius": `${presentation.radius}px`,
    "--hero-editor-duration": `${presentation.durationMs}ms`,
    "--hero-editor-easing": presentation.easing,
    "--hero-editor-shadow": presentation.shadow / 100,
    "--hero-editor-glow": presentation.glow / 100,
    "--hero-editor-overlay": presentation.overlay / 100,
    "--hero-editor-border": `${presentation.borderWidth}px`,
    "--hero-autoplay-ms": `${presentation.autoplayMs || HOME_HERO_AUTOPLAY_MS}ms`,
  };

  for (const device of ["desktop", "tablet", "mobile"] as const) {
    const responsive = presentation.responsive[device];
    variables[`--hero-${device}-anchor`] = homeHeroAnchor(responsive);
    variables[`--hero-${device}-card-width`] = `${responsive.cardWidth}px`;
    variables[`--hero-${device}-card-height`] = `${responsive.cardHeight}px`;
    variables[`--hero-${device}-gap`] = `${responsive.gap}px`;
    variables[`--hero-${device}-perspective`] = `${responsive.perspective}px`;

    for (const position of HOME_HERO_VISUAL_POSITIONS) {
      variables[`--hero-${device}-display-${position}`] = homeHeroPositionDisplay(
        position,
        responsive,
        presentation.direction,
        totalGames
      );
      variables[`--hero-${device}-slot-${position}`] = homeHeroSlotCSS(position);
    }
  }

  return variables as CSSProperties;
}

export default function HeroSection({
  games,
  presentation,
  imageEffect = false,
  imageTuning,
  autoplaySuspended = false,
  onSelectPosition,
}: {
  games: Game[];
  presentation: HomeHeroPresentation;
  imageEffect?: boolean;
  imageTuning?: Partial<HeroImageTuning>;
  autoplaySuspended?: boolean;
  onSelectPosition?: (position: HomeHeroVisualPosition) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const lastWheel = useRef(0);
  const autoplayClock = useRef({ key: "", remaining: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);

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
  const tuningOverlayOpacity = resolvedTuning.overlayStrength / 100;

  const normalizedActiveIndex = games.length
    ? ((activeIndex % games.length) + games.length) % games.length
    : 0;
  const activeGame = games[normalizedActiveIndex] ?? games[0];
  const isPaused = (hovered && presentation.pauseOnHover) || focused || manualPaused || reducedMotion || !documentVisible || autoplaySuspended;
  const autoplayDelay = !presentation.autoplay || presentation.autoplayMs === 0
    ? null
    : presentation.autoplayMs || HOME_HERO_AUTOPLAY_MS;
  const direction = presentation.direction === "reverse" ? -1 : 1;
  const rootStyle = useMemo(
    () => deviceVariables(presentation, games.length),
    [games.length, presentation]
  );

  const moveBy = useCallback((delta: number) => {
    setActiveIndex((current) => {
      if (!games.length) return 0;
      const normalized = ((current % games.length) + games.length) % games.length;
      const next = normalized + delta;
      if (!presentation.loop) return Math.max(0, Math.min(games.length - 1, next));
      return (next + games.length) % games.length;
    });
  }, [games.length, presentation.loop]);

  const nextSlide = useCallback(() => moveBy(direction), [direction, moveBy]);
  const previousSlide = useCallback(() => moveBy(-direction), [direction, moveBy]);

  useEffect(() => {
    const media = (rootRef.current?.ownerDocument.defaultView ?? window).matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const doc = rootRef.current?.ownerDocument ?? document;
    const update = () => setDocumentVisible(!doc.hidden);
    update();
    doc.addEventListener("visibilitychange", update);
    return () => doc.removeEventListener("visibilitychange", update);
  }, []);

  const atAutoplayEnd = !presentation.loop && normalizedActiveIndex === (direction === 1 ? games.length - 1 : 0);
  useEffect(() => {
    const key = `${activeGame?.id}-${autoplayDelay}-${direction}`;
    if (autoplayClock.current.key !== key) autoplayClock.current = { key, remaining: autoplayDelay ?? 0 };
    if (isPaused || atAutoplayEnd || games.length <= 1 || autoplayDelay === null) return;
    const started = performance.now();
    const timer = window.setTimeout(nextSlide, autoplayClock.current.remaining);
    return () => {
      window.clearTimeout(timer);
      autoplayClock.current.remaining = Math.max(0, autoplayClock.current.remaining - (performance.now() - started));
    };
  }, [activeGame?.id, autoplayDelay, direction, games.length, isPaused, atAutoplayEnd, nextSlide]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !presentation.wheel) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < 12) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel.current < Math.max(350, presentation.durationMs)) return;
      lastWheel.current = now;
      moveBy(event.deltaY > 0 ? direction : -direction);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [direction, moveBy, presentation.durationMs, presentation.wheel]);

  useLayoutEffect(() => {
    const fit = fitRef.current;
    const root = rootRef.current;
    const viewport = fit?.parentElement;
    if (!fit || !root || !viewport) return;
    const update = () => {
      fit.style.transform = "none";
      const origin = viewport.getBoundingClientRect();
      const cards = Array.from(fit.querySelectorAll<HTMLElement>("[data-position]")).filter((card) => card.getClientRects().length > 0);
      if (!cards.length || !origin.width || !origin.height) return;
      const screenWidth = root.ownerDocument.defaultView?.innerWidth ?? 1440;
      const device = screenWidth <= 680 ? "mobile" : screenWidth <= 1100 ? "tablet" : "desktop";
      // On phones the neighbors are edge previews; fitting them all would make
      // the main title and actions too small to read or tap.
      const fittedCards = device === "mobile" ? cards.filter((card) => card.dataset.position === "main") : cards;
      const bounds = fittedCards.map((card) => card.getBoundingClientRect());
      const fitted = fitHomeHeroBounds({
        left: Math.min(...bounds.map((box) => box.left)) - origin.left,
        top: Math.min(...bounds.map((box) => box.top)) - origin.top,
        right: Math.max(...bounds.map((box) => box.right)) - origin.left,
        bottom: Math.max(...bounds.map((box) => box.bottom)) - origin.top,
      }, origin.width, origin.height, presentation.responsive[device].alignment);
      fit.style.transform = `translate(${fitted.x}px, ${fitted.y}px) scale(${fitted.scale})`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    const view = root.ownerDocument.defaultView;
    view?.addEventListener("resize", update);
    return () => { observer.disconnect(); view?.removeEventListener("resize", update); };
  }, [presentation, games.length, normalizedActiveIndex]);

  if (!activeGame) return null;

  const heroMode = resolveGameDestinationMediaMode(activeGame, "hero");
  const hoverPlayback = heroMode === "hover-video";
  const videoShouldRender =
    !reducedMotion &&
    heroMode !== "image" &&
    (!hoverPlayback || hoverPreviewActive);

  function cardAt(position: HomeHeroVisualPosition) {
    const offset = homeHeroPositionOffset(position);
    const rawIndex = normalizedActiveIndex + offset;
    if (!presentation.loop && (rawIndex < 0 || rawIndex >= games.length)) {
      return null;
    }
    const index = ((rawIndex % games.length) + games.length) % games.length;
    return { game: games[index], index };
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!presentation.keyboard) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextSlide();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previousSlide();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (!event.isPrimary || event.button !== 0) return;
    if ((event.pointerType === "mouse" && presentation.drag) || (event.pointerType !== "mouse" && presentation.touch)) {
      pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
  }

  function resetPointer() {
    pointerStart.current = null;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = Math.abs(start.x - event.clientX);
    const dy = Math.abs(start.y - event.clientY);
    if (dy > dx && dy > 12) { resetPointer(); return; }
    if (dx >= SWIPE_THRESHOLD && dx > dy) {
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const difference = start.x - event.clientX;
    const vertical = Math.abs(start.y - event.clientY);
    resetPointer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (Math.abs(difference) < SWIPE_THRESHOLD || vertical >= Math.abs(difference)) return;
    suppressClick.current = true;
    if (difference > 0) nextSlide();
    else previousSlide();
  }

  function startHoverPreview() {
    if (hoverPlayback && canUseFineHover()) setHoverPreviewActive(true);
    setHovered(true);
  }

  function stopHoverPreview() {
    if (hoverPlayback) setHoverPreviewActive(false);
    setHovered(false);
  }

  return (
    <section
      ref={rootRef}
      className={styles.heroSection}
      data-composition={presentation.composition}
      data-transition={presentation.transition}
      aria-label="Juegos destacados"
      aria-roledescription="carrusel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={rootStyle}
      onMouseEnter={startHoverPreview}
      onMouseLeave={stopHoverPreview}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false);
      }}
    >
      <h1 className={styles.srOnly}>Juegos destacados</h1>

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

      {games.length > 1 && (
        <div className={styles.positionCounter} aria-live="polite">
          <strong>{String(normalizedActiveIndex + 1).padStart(2, "0")}</strong>
          <span>/ {String(games.length).padStart(2, "0")}</span>
        </div>
      )}

      <div
        className={styles.carouselViewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={resetPointer}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        }}
        onPointerCancel={resetPointer}
      >
        <div ref={fitRef} className={styles.stageFit}>
        <div className={styles.stage}>
          {HOME_HERO_VISUAL_POSITIONS.map((position) => {
            const entry = cardAt(position);
            if (!entry) return null;
            const { game, index } = entry;
            const positionStyle = presentation.positions[position];
            const isMain = position === "main";

            return (
              <article
                key={`${normalizedActiveIndex}-${position}-${game.id}`}
                className={styles.heroCard}
                data-position={position}
                data-main={isMain || undefined}
                onClick={() => onSelectPosition?.(position)}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} de ${games.length}: ${game.title}`}
                style={{
                  opacity: positionStyle.opacity / 100,
                  filter: `blur(${positionStyle.blur}px) brightness(${positionStyle.brightness}%) contrast(${positionStyle.contrast}%) saturate(${positionStyle.saturation}%)`,
                  transform: homeHeroPositionTransform(positionStyle),
                }}
              >
                <div className={styles.cardSurface}>
                  <div className={styles.media}>
                    {game.heroImage || game.coverImage ? (
                      <ResponsiveArtwork
                        game={game}
                        alt={isMain ? game.mediaAccessibility?.hero ?? game.imageAlt : ""}
                        active={isMain}
                        style={artworkStyle}
                      />
                    ) : (
                      <div className={styles.mediaFallback} aria-hidden="true" />
                    )}

                    {isMain && <HeroVideoLayer game={game} enabled={videoShouldRender} />}

                    {imageEffect && isMain && (
                      <div
                        className={styles.tuningOverlay}
                        style={{ opacity: tuningOverlayOpacity }}
                        aria-hidden="true"
                      />
                    )}
                    <div className={styles.editorOverlay} aria-hidden="true" />
                    {isMain && <div className={styles.readabilityOverlay} aria-hidden="true" />}
                  </div>

                  {isMain ? (
                    <>
                      {game.badge && <span className={styles.featuredBadge}>{game.badge}</span>}
                      <MainCardContent game={game} />
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.sideSelect}
                      aria-label={`Mostrar ${game.title}`}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span>
                        <strong>{game.shortTitle ?? game.title}</strong>
                        <small>{game.category}</small>
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        </div>
      </div>

      {games.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            aria-label="Juego anterior"
            onClick={previousSlide}
            disabled={!presentation.loop && normalizedActiveIndex === (direction === 1 ? 0 : games.length - 1)}
          >
            <ChevronLeft size={29} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            aria-label="Juego siguiente"
            onClick={nextSlide}
            disabled={!presentation.loop && normalizedActiveIndex === (direction === 1 ? games.length - 1 : 0)}
          >
            <ChevronRight size={29} aria-hidden="true" />
          </button>

          <div className={styles.controls}>
            <div className={styles.segments} aria-label="Elegir juego del carrusel">
              {games.map((game, index) => (
                <button
                  key={game.id}
                  type="button"
                  className={index === normalizedActiveIndex ? styles.activeSegment : ""}
                  aria-label={`Mostrar ${game.title}`}
                  aria-current={index === normalizedActiveIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>

            {presentation.autoplay && presentation.autoplayMs !== 0 && (
              <button
                type="button"
                className={styles.pauseButton}
                aria-label={manualPaused ? "Reanudar carrusel automático" : "Pausar carrusel automático"}
                aria-pressed={manualPaused}
                onClick={() => setManualPaused((current) => !current)}
              >
                {manualPaused ? (
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Pause size={12} fill="currentColor" aria-hidden="true" />
                )}
                <span>{manualPaused ? "Reanudar" : "Pausar"}</span>
              </button>
            )}

            {autoplayDelay !== null && (
              <div className={styles.progress} aria-hidden="true">
                <span
                  key={`${normalizedActiveIndex}-${autoplayDelay}-${direction}`}
                  className={styles.progressBar}
                  style={{ animationPlayState: isPaused || atAutoplayEnd ? "paused" : "running" }}
                />
              </div>
            )}
          </div>
        </>
      )}

      <span className={styles.srOnly} aria-hidden="true">
        {formatHomeHeroPosition(normalizedActiveIndex, games.length)}
      </span>
    </section>
  );
}
