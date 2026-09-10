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
  resolveGameCardArtwork,
} from "@/lib/media/game-card-artwork";
import {
  resolveGameCardPreview,
} from "@/lib/media/game-card-preview";
import {
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type { Game } from "@/types/game";

import styles from "./UniversalGameCard.module.css";
import tiltStyles from "./UniversalGameCardTilt.module.css";
import presentationStyles from "./UniversalGameCardPresentation.module.css";

export type UniversalGameCardVariant =
  | "standard"
  | "recent"
  | "lowSpec"
  | "catalog";

type UniversalGameCardProps = {
  game: Game;
  variant?: UniversalGameCardVariant;
  overlayAction?: ReactNode;
};

type PendingTilt = {
  node: HTMLElement;
  clientX: number;
  clientY: number;
};

const PREVIEW_DELAY_MS = 1_000;

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

  node.style.setProperty(
    "--tilt-x",
    `${rotateX.toFixed(2)}deg`
  );
  node.style.setProperty(
    "--tilt-y",
    `${rotateY.toFixed(2)}deg`
  );
  node.style.setProperty(
    "--pointer-x",
    `${(x * 100).toFixed(1)}%`
  );
  node.style.setProperty(
    "--pointer-y",
    `${(y * 100).toFixed(1)}%`
  );
  node.style.setProperty(
    "--image-x",
    `${((x - 0.5) * -8).toFixed(2)}px`
  );
  node.style.setProperty(
    "--image-y",
    `${((y - 0.5) * -6).toFixed(2)}px`
  );
}

function Rating({ game }: { game: Game }) {
  return (
    <div className={styles.rating}>
      <Star
        size={17}
        fill="currentColor"
        aria-hidden="true"
      />
      <strong>{game.rating ?? "—"}</strong>
      {game.reviews && (
        <span>({game.reviews})</span>
      )}
    </div>
  );
}

function LowSpecDetails({ game }: { game: Game }) {
  const requirements = game.requirements;
  const minimum = requirements?.minimum;
  const ram =
    requirements?.ram ?? minimum?.ram ?? "—";
  const graphics =
    requirements?.graphics ??
    minimum?.graphics ??
    "—";
  const system =
    requirements?.system ?? minimum?.system ?? "—";

  return (
    <>
      <span className={styles.lowSpecBadge}>
        BAJOS RECURSOS
      </span>
      <div className={styles.requirements}>
        <div>
          <span className={styles.requirementIcon}>R</span>
          <p>
            RAM: <strong>{ram}</strong>
          </p>
        </div>
        <div>
          <span className={styles.requirementIcon}>G</span>
          <p>
            Gráfica: <strong>{graphics}</strong>
          </p>
        </div>
        <div>
          <span className={styles.requirementIcon}>SO</span>
          <p>
            Sistema: <strong>{system}</strong>
          </p>
        </div>
      </div>
    </>
  );
}

export default function UniversalGameCard({
  game,
  variant = "standard",
  overlayAction,
}: UniversalGameCardProps) {
  const previewTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const tiltFrame = useRef<number | null>(null);
  const pendingTilt = useRef<PendingTilt | null>(null);
  const cardRect = useRef<DOMRect | null>(null);
  const pointerEffectsEnabled = useRef(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);

  const mediaBadge = getMediaBadge(game, variant);
  const fallbackClass =
    fallbackClassBySlug[game.slug];
  const isCatalog = variant === "catalog";
  const isRecent = variant === "recent";
  const isLowSpec = variant === "lowSpec";
  const variantClass =
    styles[
      `variant${variant[0].toUpperCase()}${variant.slice(1)}`
    ];
  const cardMode = resolveGameDestinationMediaMode(game, "card");
  const resolvedPreview = resolveGameCardPreview(game);
  const artwork = resolveGameCardArtwork(game);
  const richActive = pointerActive || focusActive;

  function cancelTiltFrame() {
    if (tiltFrame.current !== null) {
      cancelAnimationFrame(tiltFrame.current);
      tiltFrame.current = null;
    }
    pendingTilt.current = null;
  }

  function activatePointerEffects(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const pointerSupportsEffects =
      event.pointerType === "mouse" ||
      event.pointerType === "pen";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!pointerSupportsEffects || reducedMotion) {
      if (pointerEffectsEnabled.current) {
        cancelTiltFrame();
        cardRect.current = null;
        resetTilt(event.currentTarget);
      }
      pointerEffectsEnabled.current = false;
      event.currentTarget.removeAttribute("data-tilt-active");
      setPointerActive(false);
      return false;
    }

    pointerEffectsEnabled.current = true;
    setPointerActive(true);
    event.currentTarget.setAttribute(
      "data-tilt-active",
      "true"
    );
    if (!cardRect.current) {
      cardRect.current =
        event.currentTarget.getBoundingClientRect();
    }
    return true;
  }

  function startCard(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (!activatePointerEffects(event)) return;

    cardRect.current =
      event.currentTarget.getBoundingClientRect();
  }

  function scheduleTilt(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (!activatePointerEffects(event)) return;

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

      applyTilt(
        pending.node,
        pending.clientX,
        pending.clientY,
        rect
      );
    });
  }

  function stopCard(
    event: ReactPointerEvent<HTMLElement>
  ) {
    cancelTiltFrame();
    cardRect.current = null;
    pointerEffectsEnabled.current = false;
    setPointerActive(false);
    event.currentTarget.removeAttribute("data-tilt-active");
    resetTilt(event.currentTarget);
  }

  useEffect(() => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewActive(false);

    if (!richActive || !resolvedPreview?.src || cardMode === "image") {
      return;
    }

    if (cardMode === "video") {
      setPreviewActive(true);
      return;
    }

    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      setPreviewActive(true);
    }, PREVIEW_DELAY_MS);

    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
        previewTimer.current = null;
      }
    };
  }, [cardMode, resolvedPreview?.src, richActive]);

  useEffect(() => {
    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
      if (tiltFrame.current !== null) {
        cancelAnimationFrame(tiltFrame.current);
      }
    };
  }, []);

  return (
    <article
      className={`${styles.card} ${tiltStyles.tiltCard} ${presentationStyles.shell} ${variantClass}`}
      onPointerEnter={startCard}
      onPointerMove={scheduleTilt}
      onPointerLeave={stopCard}
      onPointerCancel={stopCard}
      data-rich-active={richActive ? "true" : "false"}
      data-game-card-shell="4:5"
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
        className={`${styles.link} ${tiltStyles.tiltClip} ${presentationStyles.presentationLink}`}
        aria-label={`Ver ${game.title}`}
        onFocus={() => setFocusActive(true)}
        onBlur={() => setFocusActive(false)}
      >
        <div
          className={presentationStyles.coverFace}
          aria-hidden="true"
          data-game-card-face="cover"
        >
          <GameMedia
            src={artwork.coverImage}
            alt=""
            viewport={artwork.coverViewport}
            sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
            fallbackClassName={
              fallbackClass
                ? styles[fallbackClass]
                : undefined
            }
            className={presentationStyles.coverMedia}
          />
        </div>

        <div
          className={presentationStyles.richFace}
          data-game-card-face="rich"
        >
          <div
            className={`${styles.media} ${tiltStyles.tiltMedia} ${presentationStyles.richMedia}`}
          >
            <HoverPreviewMedia
              imageSrc={artwork.cardImage}
              imageAlt={game.mediaAccessibility?.card ?? game.imageAlt}
              imageViewport={artwork.cardViewport}
              previewClip={resolvedPreview?.src}
              previewViewport={resolvedPreview?.viewport}
              active={previewActive}
              sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
              fallbackClassName={
                fallbackClass
                  ? styles[fallbackClass]
                  : undefined
              }
            />

            <div
              className={styles.mediaOverlay}
              aria-hidden="true"
            />
            <div
              className={tiltStyles.spotlight}
              aria-hidden="true"
            />

            {mediaBadge && (
              <span
                className={`${styles.mediaBadge} ${
                  mediaBadge.tone === "brand"
                    ? styles.mediaBadgeBrand
                    : ""
                }`}
                data-brand-badge={
                  mediaBadge.tone === "brand"
                    ? "true"
                    : undefined
                }
              >
                {mediaBadge.label}
              </span>
            )}

            <Monitor
              size={18}
              className={styles.platform}
              aria-hidden="true"
            />
          </div>

          <div className={`${styles.content} ${presentationStyles.richContent}`}>
            <div className={styles.titleRow}>
              <h3>{game.title}</h3>

              {isRecent && game.version && (
                <span className={styles.version}>
                  {game.version}
                </span>
              )}

              {isCatalog && (
                <ChevronRight
                  size={17}
                  aria-hidden="true"
                />
              )}
            </div>

            {isCatalog && (
              <p className={styles.description}>
                {game.description}
              </p>
            )}

            {isLowSpec && (
              <LowSpecDetails game={game} />
            )}

            <Rating game={game} />

            {isRecent && game.addedAt && (
              <div className={styles.date}>
                <CalendarDays
                  size={15}
                  aria-hidden="true"
                />
                <span>Añadido el {game.addedAt}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {overlayAction}
    </article>
  );
}
