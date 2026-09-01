"use client";

import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Heart,
  Monitor,
  Star,
} from "lucide-react";

import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import HoverPreviewMedia from "@/components/ui/HoverPreviewMedia";
import {
  resolveGameCardPreview,
} from "@/lib/media/game-card-preview";
import {
  activateSharedDirectPlatformHoverPlayer,
  deactivateSharedDirectPlatformHoverPlayer,
} from "@/lib/media/shared-direct-platform-hover-player";
import {
  activateSharedYouTubeHoverPlayer,
  deactivateSharedYouTubeHoverPlayer,
} from "@/lib/media/shared-youtube-hover-player";
import type { Game } from "@/types/game";

import styles from "./UniversalGameCard.module.css";
import tiltStyles from "./UniversalGameCardTilt.module.css";

export type UniversalGameCardVariant =
  | "standard"
  | "recent"
  | "lowSpec"
  | "catalog";

type UniversalGameCardProps = {
  game: Game;
  variant?: UniversalGameCardVariant;
};

type PendingTilt = {
  node: HTMLElement;
  clientX: number;
  clientY: number;
};

type ExternalPreviewKind = "youtube" | "direct";

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
}: UniversalGameCardProps) {
  const previewTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const tiltFrame = useRef<number | null>(null);
  const pendingTilt = useRef<PendingTilt | null>(null);
  const cardRect = useRef<DOMRect | null>(null);
  const pointerEffectsEnabled = useRef(false);
  const externalActive = useRef<ExternalPreviewKind | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [previewActive, setPreviewActive] =
    useState(false);

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
  const resolvedPreview =
    resolveGameCardPreview(game);

  function cancelTiltFrame() {
    if (tiltFrame.current !== null) {
      cancelAnimationFrame(tiltFrame.current);
      tiltFrame.current = null;
    }
    pendingTilt.current = null;
  }

  function deactivateExternalPreview(media: HTMLElement) {
    if (externalActive.current === "youtube") {
      deactivateSharedYouTubeHoverPlayer(media);
    } else if (externalActive.current === "direct") {
      deactivateSharedDirectPlatformHoverPlayer(media);
    }
    externalActive.current = null;
  }

  function cancelPreview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }

    setPreviewActive(false);

    const media = mediaRef.current;
    if (externalActive.current && media) {
      deactivateExternalPreview(media);
    }

    articleRef.current?.style.removeProperty(
      "--tilt-transition-duration"
    );
  }

  function startCard(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const pointerIsFine =
      event.pointerType !== "touch" &&
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    pointerEffectsEnabled.current =
      pointerIsFine && !reducedMotion;
    if (!pointerEffectsEnabled.current) return;

    cardRect.current =
      event.currentTarget.getBoundingClientRect();

    if (
      !resolvedPreview ||
      previewTimer.current ||
      previewActive ||
      externalActive.current
    ) {
      return;
    }

    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;

      if (resolvedPreview.kind === "webm") {
        setPreviewActive(true);
        return;
      }

      const article = articleRef.current;
      const media = mediaRef.current;
      if (!article || !media) return;

      cancelTiltFrame();
      article.style.setProperty(
        "--tilt-transition-duration",
        "0ms"
      );
      resetTilt(article);
      void article.offsetWidth;

      if (resolvedPreview.kind === "youtube") {
        externalActive.current = "youtube";
        activateSharedYouTubeHoverPlayer(
          media,
          resolvedPreview.preview
        );
        return;
      }

      externalActive.current = "direct";
      activateSharedDirectPlatformHoverPlayer(
        media,
        resolvedPreview.preview
      );
    }, PREVIEW_DELAY_MS);
  }

  function scheduleTilt(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (
      !pointerEffectsEnabled.current ||
      externalActive.current
    ) {
      return;
    }

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
    resetTilt(event.currentTarget);
    cancelPreview();
  }

  useEffect(() => {
    const media = mediaRef.current;

    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
      if (tiltFrame.current !== null) {
        cancelAnimationFrame(tiltFrame.current);
      }
      if (externalActive.current && media) {
        deactivateExternalPreview(media);
      }
    };
  }, []);

  return (
    <article
      ref={articleRef}
      className={`${styles.card} ${tiltStyles.tiltCard} ${variantClass}`}
      onPointerEnter={startCard}
      onPointerMove={scheduleTilt}
      onPointerLeave={stopCard}
      onPointerCancel={stopCard}
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
        className={`${styles.link} ${tiltStyles.tiltClip}`}
        aria-label={`Ver ${game.title}`}
      >
        <div
          ref={mediaRef}
          className={`${styles.media} ${tiltStyles.tiltMedia}`}
        >
          <HoverPreviewMedia
            imageSrc={game.coverImage}
            imageAlt={game.imageAlt}
            previewClip={
              resolvedPreview?.kind === "webm"
                ? resolvedPreview.src
                : undefined
            }
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

          <span
            className={styles.favorite}
            aria-hidden="true"
          >
            <Heart size={21} />
          </span>

          <Monitor
            size={18}
            className={styles.platform}
            aria-hidden="true"
          />
        </div>

        <div className={styles.content}>
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
      </Link>
    </article>
  );
}
