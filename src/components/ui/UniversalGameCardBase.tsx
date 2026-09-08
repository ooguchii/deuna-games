"use client";

import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Monitor,
  Star,
} from "lucide-react";

import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";
import HoverPreviewMedia from "@/components/ui/HoverPreviewMedia";
import {
  DEFAULT_GLOBAL_GAME_CARD_PRESENTATION,
  type GameCardPresentationMode,
} from "@/lib/media/game-card-presentation";
import {
  resolveGameCardPreview,
} from "@/lib/media/game-card-preview";
import {
  resolveGameCardVideo,
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type { Game } from "@/types/game";

import styles from "./UniversalGameCard.module.css";
import presentationStyles from "./UniversalGameCardPresentation.module.css";
import tiltStyles from "./UniversalGameCardTilt.module.css";

export type UniversalGameCardVariant =
  | "standard"
  | "recent"
  | "lowSpec"
  | "catalog";

export type UniversalGameCardProps = {
  game: Game;
  variant?: UniversalGameCardVariant;
  presentation?: GameCardPresentationMode;
  overlayAction?: ReactNode;
  supplementalContent?: ReactNode;
};

type PendingTilt = {
  node: HTMLElement;
  clientX: number;
  clientY: number;
};

const PREVIEW_DELAY_MS = 420;
const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

const fallbackClassBySlug: Record<string, string> = {
  "god-of-war-ragnarok": "godOfWar",
  "elden-ring": "eldenRing",
  "forza-horizon-5": "forza",
  "resident-evil-4": "residentEvil",
  "hogwarts-legacy": "hogwarts",
  "cyberpunk-2077": "cyberpunk",
  "baldurs-gate-3": "baldursGate",
  "red-dead-redemption-2": "redDead",
  "lies-of-p": "liesOfP",
  "armored-core-vi": "armoredCore",
  "stellar-blade": "stellarBlade",
  "palworld": "palworld",
  "enshrouded": "enshrouded",
  "helldivers-2": "helldivers",
  "the-talos-principle-2": "talos",
  "minecraft-java-edition": "minecraft",
  "left-4-dead-2": "left4Dead",
  "gta-san-andreas": "gta",
  "terraria": "terraria",
  "half-life-2": "halfLife",
  "portal-2": "portal",
  "stardew-valley": "stardew",
};

function getMediaBadge(
  game: Game,
  variant: UniversalGameCardVariant
) {
  if (variant === "recent") {
    return {
      label: "NUEVO",
      tone: "brand" as const,
    };
  }

  if (variant === "catalog") {
    return {
      label: game.category,
      tone: "brand" as const,
    };
  }

  return null;
}

function resetTilt(node: HTMLElement) {
  node.style.setProperty("--tilt-x", "0deg");
  node.style.setProperty("--tilt-y", "0deg");
  node.style.setProperty("--pointer-x", "50%");
  node.style.setProperty("--pointer-y", "50%");
  node.style.setProperty("--image-x", "0px");
  node.style.setProperty("--image-y", "0px");
}

function applyTilt(
  node: HTMLElement,
  clientX: number,
  clientY: number,
  rect: DOMRect
) {
  const x = Math.min(
    Math.max((clientX - rect.left) / rect.width, 0),
    1
  );
  const y = Math.min(
    Math.max((clientY - rect.top) / rect.height, 0),
    1
  );

  const rotateY = (x - 0.5) * 8;
  const rotateX = (0.5 - y) * 7;

  node.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
  node.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
  node.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
  node.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
  node.style.setProperty("--image-x", `${((x - 0.5) * -8).toFixed(2)}px`);
  node.style.setProperty("--image-y", `${((y - 0.5) * -6).toFixed(2)}px`);
}

function Rating({ game }: { game: Game }) {
  return (
    <div className={styles.rating}>
      <Star size={17} fill="currentColor" aria-hidden="true" />
      <strong>{game.rating ?? "—"}</strong>
      {game.reviews && <span>({game.reviews})</span>}
    </div>
  );
}

function LowSpecDetails({ game }: { game: Game }) {
  const requirements = game.requirements;
  const minimum = requirements?.minimum;
  const ram = requirements?.ram ?? minimum?.ram ?? "—";
  const graphics = requirements?.graphics ?? minimum?.graphics ?? "—";
  const system = requirements?.system ?? minimum?.system ?? "—";

  return (
    <>
      <span className={styles.lowSpecBadge}>BAJOS RECURSOS</span>
      <div className={styles.requirements}>
        <div>
          <span className={styles.requirementIcon}>R</span>
          <p>RAM: <strong>{ram}</strong></p>
        </div>
        <div>
          <span className={styles.requirementIcon}>G</span>
          <p>Gráfica: <strong>{graphics}</strong></p>
        </div>
        <div>
          <span className={styles.requirementIcon}>SO</span>
          <p>Sistema: <strong>{system}</strong></p>
        </div>
      </div>
    </>
  );
}

export default function UniversalGameCardBase({
  game,
  variant = "standard",
  presentation = DEFAULT_GLOBAL_GAME_CARD_PRESENTATION,
  overlayAction,
  supplementalContent,
}: UniversalGameCardProps) {
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiltFrame = useRef<number | null>(null);
  const pendingTilt = useRef<PendingTilt | null>(null);
  const cardRect = useRef<DOMRect | null>(null);
  const pointerEffectsEnabled = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [posterRevealed, setPosterRevealed] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const mediaBadge = getMediaBadge(game, variant);
  const fallbackClass = fallbackClassBySlug[game.slug];
  const isCatalog = variant === "catalog";
  const isRecent = variant === "recent";
  const isLowSpec = variant === "lowSpec";
  const variantClass = styles[
    `variant${variant[0].toUpperCase()}${variant.slice(1)}`
  ];
  const presentationClass = presentation === "poster"
    ? presentationStyles.presentationPoster
    : "";

  const cardMode = resolveGameDestinationMediaMode(game, "card");
  const modePreview = resolveGameCardPreview(game);
  const explicitCardVideo = resolveGameCardVideo(game);
  const cardImage = game.cardImage ?? game.coverImage;
  const cardViewport = game.imageMedia?.card ?? game.imageMedia?.cover;
  const posterImage = game.coverImage ?? cardImage;
  const posterViewport = game.imageMedia?.cover ?? cardViewport;
  const posterAlt = game.mediaAccessibility?.cover ?? game.mediaAccessibility?.card ?? game.imageAlt;
  const detailAlt = game.mediaAccessibility?.card ?? game.imageAlt;

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_MEDIA);
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = articleRef.current;
    if (!node || presentation !== "detail-video") {
      setInViewport(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(Boolean(entry?.isIntersecting)),
      { rootMargin: "120px 0px", threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [presentation]);

  function cancelTiltFrame() {
    if (tiltFrame.current !== null) {
      cancelAnimationFrame(tiltFrame.current);
      tiltFrame.current = null;
    }
    pendingTilt.current = null;
  }

  function cancelPreview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewActive(false);
  }

  function schedulePosterVideo() {
    if (
      presentation !== "poster" ||
      cardMode === "image" ||
      !modePreview ||
      reducedMotion ||
      previewTimer.current ||
      previewActive
    ) {
      return;
    }

    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      setPreviewActive(true);
    }, PREVIEW_DELAY_MS);
  }

  function startCard(event: ReactPointerEvent<HTMLElement>) {
    const pointerIsFine =
      event.pointerType !== "touch" &&
      window.matchMedia(FINE_HOVER_MEDIA).matches;

    pointerEffectsEnabled.current = pointerIsFine && !reducedMotion;
    if (pointerEffectsEnabled.current) {
      cardRect.current = event.currentTarget.getBoundingClientRect();
    }

    if (presentation === "poster" && pointerIsFine) {
      setPosterRevealed(true);
      schedulePosterVideo();
    }
  }

  function scheduleTilt(event: ReactPointerEvent<HTMLElement>) {
    if (!pointerEffectsEnabled.current) return;

    pendingTilt.current = {
      node: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (tiltFrame.current !== null) return;

    tiltFrame.current = requestAnimationFrame(() => {
      tiltFrame.current = null;
      const pending = pendingTilt.current;
      const rect = cardRect.current;
      pendingTilt.current = null;
      if (!pending || !rect) return;
      applyTilt(pending.node, pending.clientX, pending.clientY, rect);
    });
  }

  function stopCard(event: ReactPointerEvent<HTMLElement>) {
    cancelTiltFrame();
    cardRect.current = null;
    pointerEffectsEnabled.current = false;
    resetTilt(event.currentTarget);
    if (presentation === "poster") {
      setPosterRevealed(false);
      cancelPreview();
    }
  }

  function focusCard() {
    if (presentation !== "poster") return;
    setPosterRevealed(true);
    if (cardMode !== "image" && modePreview && !reducedMotion) {
      setPreviewActive(true);
    }
  }

  function blurCard(event: ReactFocusEvent<HTMLElement>) {
    if (
      presentation !== "poster" ||
      (event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget))
    ) {
      return;
    }
    setPosterRevealed(false);
    cancelPreview();
  }

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
    };
  }, []);

  const detailVideo = presentation === "detail-video"
    ? explicitCardVideo
    : modePreview;
  const detailVideoActive = Boolean(
    detailVideo &&
    !reducedMotion &&
    (presentation === "detail-video"
      ? inViewport
      : presentation === "poster" && posterRevealed && previewActive)
  );

  const detailSurface = (
    <div className={presentationStyles.detailSurface}>
      <div className={`${styles.media} ${presentationStyles.detailMedia} ${tiltStyles.tiltMedia}`}>
        <HoverPreviewMedia
          imageSrc={cardImage}
          imageAlt={presentation === "poster" ? "" : detailAlt}
          imageViewport={cardViewport}
          previewClip={detailVideo?.src}
          previewViewport={detailVideo?.viewport}
          active={detailVideoActive}
          sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
          fallbackClassName={fallbackClass ? styles[fallbackClass] : undefined}
        />

        <div className={styles.mediaOverlay} aria-hidden="true" />
        <div className={tiltStyles.spotlight} aria-hidden="true" />

        {mediaBadge && (
          <span
            className={`${styles.mediaBadge} ${
              mediaBadge.tone === "brand" ? styles.mediaBadgeBrand : ""
            }`}
            data-brand-badge={mediaBadge.tone === "brand" ? "true" : undefined}
          >
            {mediaBadge.label}
          </span>
        )}

        <Monitor size={18} className={styles.platform} aria-hidden="true" />
      </div>

      <div className={`${styles.content} ${presentationStyles.detailContent}`}>
        <div className={styles.titleRow}>
          <h3>{game.title}</h3>

          {isRecent && game.version && (
            <span className={styles.version}>{game.version}</span>
          )}

          {isCatalog && <ChevronRight size={17} aria-hidden="true" />}
        </div>

        {isCatalog && (
          <p className={styles.description}>{game.description}</p>
        )}

        {isLowSpec && <LowSpecDetails game={game} />}

        <Rating game={game} />

        {isRecent && game.addedAt && (
          <div className={styles.date}>
            <CalendarDays size={15} aria-hidden="true" />
            <span>Añadido el {game.addedAt}</span>
          </div>
        )}

        {supplementalContent}
      </div>
    </div>
  );

  return (
    <article
      ref={articleRef}
      className={`${styles.card} ${tiltStyles.tiltCard} ${variantClass} ${presentationClass}`}
      data-card-presentation={presentation}
      data-card-variant={variant}
      data-poster-revealed={posterRevealed ? "true" : "false"}
      onPointerEnter={startCard}
      onPointerMove={scheduleTilt}
      onPointerLeave={stopCard}
      onPointerCancel={stopCard}
      onFocusCapture={focusCard}
      onBlurCapture={blurCard}
      style={
        {
          "--tilt-x": "0deg",
          "--tilt-y": "0deg",
          "--pointer-x": "50%",
          "--pointer-y": "50%",
          "--image-x": "0px",
          "--image-y": "0px",
        } as CSSProperties
      }
    >
      <Link
        href={`/juegos/${game.slug}`}
        className={`${styles.link} ${tiltStyles.tiltClip} ${presentation === "poster" ? presentationStyles.posterLink : ""}`}
        aria-label={`Ver ${game.title}`}
      >
        {presentation === "poster" ? (
          <>
            <div className={presentationStyles.posterSurface}>
              <GameMedia
                src={posterImage}
                alt={posterAlt}
                viewport={posterViewport}
                sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
                fallbackClassName={fallbackClass ? styles[fallbackClass] : undefined}
              />
              <div className={presentationStyles.posterShade} aria-hidden="true" />
              {mediaBadge && (
                <span className={`${styles.mediaBadge} ${presentationStyles.posterBadge} ${mediaBadge.tone === "brand" ? styles.mediaBadgeBrand : ""}`}>
                  {mediaBadge.label}
                </span>
              )}
              <span className={presentationStyles.posterHint} aria-hidden="true">
                Ver información
              </span>
            </div>
            <div className={presentationStyles.posterDetailLayer}>
              {detailSurface}
            </div>
          </>
        ) : detailSurface}
      </Link>

      {overlayAction}
    </article>
  );
}
