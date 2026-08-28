import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Heart,
  Monitor,
  Star,
} from "lucide-react";

import GameMedia from "@/components/ui/GameMedia";
import type { Game } from "@/types/game";

import styles from "./UniversalGameCard.module.css";

export type UniversalGameCardVariant =
  | "standard"
  | "recent"
  | "lowSpec"
  | "catalog";

type UniversalGameCardProps = {
  game: Game;
  variant?: UniversalGameCardVariant;
};

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

  return (
    <article
      className={`${styles.card} ${
        styles[
          `variant${variant[0]
            .toUpperCase()}${variant.slice(
            1
          )}`
        ]
      }`}
    >
      <Link
        href={`/juegos/${game.slug}`}
        className={styles.link}
        aria-label={`Ver ${game.title}`}
      >
        <div
          className={styles.media}
        >
          <GameMedia
            src={game.coverImage}
            alt={game.imageAlt}
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

          {mediaBadge && (
            <span
              className={`${styles.mediaBadge} ${
                mediaBadge.tone ===
                "brand"
                  ? styles.mediaBadgeBrand
                  : ""
              }`}
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
