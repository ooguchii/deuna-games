"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Globe2,
  Info,
  Pause,
  Play,
  UsersRound,
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
import GameMedia from "@/components/ui/GameMedia";
import type {
  HomeCopy,
  HomeHeroPresentation,
} from "@/data/home-config";
import {
  formatHomeHeroPosition,
  HOME_HERO_AUTOPLAY_MS,
  HOME_HERO_VISIBLE_PREVIEWS,
} from "@/lib/home/hero-contract";
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

const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const SWIPE_THRESHOLD = 55;

const audienceTagPattern =
  /(un jugador|single.?player|multijugador|multiplayer|cooperativo|co-op|coop)/i;

type ResponsiveArtworkProps = {
  game: Game;
  alt: string;
  active?: boolean;
  ambient?: boolean;
  style?: CSSProperties;
};

type HeroFact = {
  kind: "players" | "platforms" | "world";
  label: string;
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

function classificationLine(game: Game) {
  const values = [
    game.category,
    ...(game.genres ?? []),
    ...(game.tags ?? []),
  ];
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

function heroFacts(game: Game): HeroFact[] {
  const facts: HeroFact[] = [];
  const tags = (game.tags ?? []).filter((tag) => tag.trim());
  const audience = tags.find((tag) => audienceTagPattern.test(tag));

  if (audience) {
    facts.push({ kind: "players", label: audience });
  }

  if (game.platforms?.length) {
    facts.push({
      kind: "platforms",
      label: game.platforms.join(" · "),
    });
  }

  const world = tags.find((tag) => tag !== audience);
  if (world) {
    facts.push({ kind: "world", label: world });
  } else if (game.genres?.[0] && game.genres[0] !== game.category) {
    facts.push({ kind: "world", label: game.genres[0] });
  }

  return facts.slice(0, 3);
}

function FactIcon({ kind }: { kind: HeroFact["kind"] }) {
  if (kind === "players") return <UsersRound size={19} aria-hidden="true" />;
  if (kind === "platforms") return <Gamepad2 size={19} aria-hidden="true" />;
  return <Globe2 size={19} aria-hidden="true" />;
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
        sizes="(max-width: 980px) calc(100vw - 24px), 1320px"
        priority={active}
        variant="hero"
        viewport={imageViewportForHero(game)}
        imageClassName={styles.heroArtwork}
      />
    </span>
  );
}

function PreviewArtwork({ game }: { game: Game }) {
  const src = game.coverImage;

  if (!src) {
    return <span className={styles.previewFallback} aria-hidden="true" />;
  }

  const framing = imagePosition(game.imageMedia?.cover);
  const inlineStyle = {
    "--preview-image-zoom": framing.framed.zoom,
    "--preview-image-position": framing.position,
  } as CSSProperties;

  return (
    <span className={styles.previewArtwork} style={inlineStyle} aria-hidden="true">
      <Image src={src} alt="" fill sizes="260px" />
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
  const classifications = classificationLine(game);
  const facts = heroFacts(game);
  const title = heroTitleParts(game);

  function startHoverPreview() {
    if (hoverPlayback && canUseFineHover()) {
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
      aria-label={`${logicalIndex + 1} de ${total}: ${game.title}`}
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

      {game.badge && (
        <span className={styles.featuredBadge}>{game.badge}</span>
      )}

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

        <div className={styles.actions}>
          <Link href={`/juegos/${game.slug}`} className={styles.primaryButton}>
            <Play size={17} fill="currentColor" />
            {copy.primaryCta}
          </Link>
          <Link href={`/juegos/${game.slug}`} className={styles.secondaryButton}>
            <Info size={18} />
            {copy.secondaryCta}
          </Link>
        </div>

        {facts.length > 0 && (
          <div className={styles.facts} aria-label="Datos rápidos del juego">
            {facts.map((fact) => (
              <span className={styles.fact} key={`${fact.kind}-${fact.label}`}>
                <FactIcon kind={fact.kind} />
                <span>{fact.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PreviewCard({
  game,
  depth,
  onSelect,
}: {
  game: Game;
  depth: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.previewCard}
      data-depth={depth}
      style={{ "--preview-depth": depth } as CSSProperties}
      aria-label={`Mostrar ${game.title}`}
      onClick={onSelect}
    >
      <PreviewArtwork game={game} />
      <span className={styles.previewShade} aria-hidden="true" />
      <span className={styles.previewCopy}>
        <strong>{game.shortTitle ?? game.title}</strong>
        <small>{game.category}</small>
      </span>
    </button>
  );
}

export default function HeroSection({
  games,
  copy,
  presentation,
  imageEffect = false,
  imageTuning,
}: {
  games: Game[];
  copy: HomeCopy["hero"];
  presentation: HomeHeroPresentation;
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

  const normalizedActiveIndex = games.length
    ? activeIndex % games.length
    : 0;
  const activeGame = games[normalizedActiveIndex] ?? games[0];
  const isPaused = paused || manualPaused || reducedMotion;
  const autoplayDelay = presentation.autoplayMs === 0
    ? null
    : presentation.autoplayMs || HOME_HERO_AUTOPLAY_MS;

  const previewEntries = useMemo(() => {
    if (games.length <= 1) return [];
    const count = Math.min(
      presentation.previewCount,
      HOME_HERO_VISIBLE_PREVIEWS,
      games.length - 1
    );
    return Array.from({ length: count }, (_, depth) => {
      const index = (normalizedActiveIndex + depth + 1) % games.length;
      return { game: games[index], index, depth };
    });
  }, [games, normalizedActiveIndex, presentation.previewCount]);

  const moveBy = useCallback((delta: number) => {
    setActiveIndex((current) => {
      if (!games.length) return 0;
      const normalized = current % games.length;
      return (normalized + delta + games.length) % games.length;
    });
  }, [games.length]);
  const nextSlide = useCallback(() => moveBy(1), [moveBy]);
  const previousSlide = useCallback(() => moveBy(-1), [moveBy]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isPaused || games.length <= 1 || autoplayDelay === null) return;
    const timer = window.setTimeout(nextSlide, autoplayDelay);
    return () => window.clearTimeout(timer);
  }, [activeGame?.id, autoplayDelay, games.length, isPaused, nextSlide]);

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
      data-composition={presentation.composition}
      data-motion={presentation.motion}
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
          <i aria-hidden="true" />
        </div>
      )}

      <div
        className={styles.cinematicStage}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={resetPointer}
      >
        <div className={styles.mainStage}>
          <HeroSlide
            key={activeGame.id}
            game={activeGame}
            copy={copy}
            logicalIndex={normalizedActiveIndex}
            total={games.length}
            imageEffect={imageEffect}
            artworkStyle={artworkStyle}
            overlayOpacity={overlayOpacity}
            reducedMotion={reducedMotion}
          />
        </div>

        {previewEntries.length > 0 && (
          <div className={styles.previewRail} aria-label="Próximos juegos">
            {previewEntries.map(({ game, index, depth }) => (
              <PreviewCard
                key={game.id}
                game={game}
                depth={depth}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      {games.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            aria-label="Juego anterior"
            onClick={previousSlide}
          >
            <ChevronLeft size={29} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            aria-label="Juego siguiente"
            onClick={nextSlide}
          >
            <ChevronRight size={29} />
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
                key={normalizedActiveIndex}
                className={styles.progressBar}
                style={{ animationPlayState: isPaused ? "paused" : "running" }}
              />
            </div>
          </div>
        </>
      )}

      <span className={styles.srOnly} aria-hidden="true">
        {formatHomeHeroPosition(normalizedActiveIndex, games.length)}
      </span>
    </section>
  );
}
