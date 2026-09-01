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

const PREVIEW_DELAY_MS = 2_000;

const fallbackClassBySlug:
  Record<string, string> = {
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

function stopTilt(
  event: ReactPointerEvent<HTMLElement>
) {
  const node = event.currentTarget;

  node.style.setProperty("--tilt-x", "0deg");
  node.style.setProperty("--tilt-y", "0deg");
  node.style.setProperty("--pointer-x", "50%");
  node.style.setProperty("--pointer-y", "50%");
  node.style.setProperty("--image-x", "0px");
  node.style.setProperty("--image-y", "0px");
}

function updateTilt(
  event: ReactPointerEvent<HTMLElement>
) {
  if (event.pointerType === "touch") return;

  const node = event.currentTarget;
  const rect = node.getBoundingClientRect();
  const x = Math.min(
    Math.max(
      (event.clientX - rect.left) / rect.width,
      0
    ),
    1
  );
  const y = Math.min(
    Math.max(
      (event.clientY - rect.top) / rect.height,
      0
    ),
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

function Rating({
  game,
}: {
  game: Game;
}) {
  return (
    <div className={styles.rating}>
      <Star
        size={17}
        fill="currentColor"
        aria-hidden="true"
      />

      <strong>
        {game.rating ?? "—"}
      </strong>

      {game.reviews && (
        <span>
          ({game.reviews})
        </span>
      )}
    </div>
  );
}

function LowSpecDetails({
  game,
}: {
  game: Game;
}) {
  const requirements =
    game.requirements;
  const minimum =
    requirements?.minimum;
  const ram =
    requirements?.ram ??
    minimum?.ram ??
    "—";
  const graphics =
    requirements?.graphics ??
    minimum?.graphics ??
    "—";
  const system =
    requirements?.system ??
    minimum?.system ??
    "—";

  return (
    <>
      <span
        className={styles.lowSpecBadge}
      >
        BAJOS RECURSOS
      </span>

      <div
        className={styles.requirements}
      >
        <div>
          <span
            className={
              styles.requirementIcon
            }
          >
            R
          </span>

          <p>
            RAM:{" "}
            <strong>{ram}</strong>
          </p>
        </div>

        <div>
          <span
            className={
              styles.requirementIcon
            }
          >
            G
          </span>

          <p>
            Gráfica:{" "}
            <strong>{graphics}</strong>
          </p>
        </div>

        <div>
          <span
            className={
              styles.requirementIcon
            }
          >
            SO
          </span>

          <p>
            Sistema:{" "}
            <strong>{system}</strong>
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
  const [previewActive, setPreviewActive] =
    useState(false);
  const mediaBadge =
    getMediaBadge(
      game,
      variant
    );

  const fallbackClass =
    fallbackClassBySlug[
      game.slug
    ];

  const isCatalog =
    variant === "catalog";

  const isRecent =
    variant === "recent";

  const isLowSpec =
    variant === "lowSpec";

  const variantClass =
    styles[
      `variant${variant[0]
        .toUpperCase()}${variant.slice(
        1
      )}`
    ];

  function cancelPreview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewActive(false);
  }

  function schedulePreview(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (
      !game.previewClip ||
      event.pointerType === "touch" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    if (previewTimer.current || previewActive) return;

    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      setPreviewActive(true);
    }, PREVIEW_DELAY_MS);
  }

  function stopCard(
    event: ReactPointerEvent<HTMLElement>
  ) {
    stopTilt(event);
    cancelPreview();
  }

  useEffect(() => {
    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    };
  }, []);

  return (
    <article
      className={`${styles.card} ${tiltStyles.tiltCard} ${variantClass}`}
      onPointerEnter={schedulePreview}
      onPointerMove={updateTilt}
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
          className={`${styles.media} ${tiltStyles.tiltMedia}`}
        >
          <HoverPreviewMedia
            imageSrc={game.coverImage}
            imageAlt={game.imageAlt}
            previewClip={game.previewClip}
            active={previewActive}
            sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
            fallbackClassName={
              fallbackClass
                ? styles[
                    fallbackClass
                  ]
                : undefined
            }
          />

          <div
            className={
              styles.mediaOverlay
            }
            aria-hidden="true"
          />

          <div
            className={
              tiltStyles.spotlight
            }
            aria-hidden="true"
          />

          {mediaBadge && (
            <span
              className={`${styles.mediaBadge} ${
                mediaBadge.tone ===
                "brand"
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
            className={
              styles.favorite
            }
            aria-hidden="true"
          >
            <Heart size={21} />
          </span>

          <Monitor
            size={18}
            className={
              styles.platform
            }
            aria-hidden="true"
          />
        </div>

        <div
          className={styles.content}
        >
          <div
            className={
              styles.titleRow
            }
          >
            <h3>
              {game.title}
            </h3>

            {isRecent &&
              game.version && (
                <span
                  className={
                    styles.version
                  }
                >
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
            <p
              className={
                styles.description
              }
            >
              {game.description}
            </p>
          )}

          {isLowSpec && (
            <LowSpecDetails
              game={game}
            />
          )}

          <Rating game={game} />

          {isRecent &&
            game.addedAt && (
              <div
                className={
                  styles.date
                }
              >
                <CalendarDays
                  size={15}
                  aria-hidden="true"
                />

                <span>
                  Añadido el{" "}
                  {game.addedAt}
                </span>
              </div>
            )}
        </div>
      </Link>
    </article>
  );
}
