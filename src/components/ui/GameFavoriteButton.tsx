"use client";

import {
  Heart,
} from "lucide-react";

import {
  useFavoriteGame,
} from "@/features/favorites/favorite-store";

import styles from "./GameFavoriteButton.module.css";

export default function GameFavoriteButton({
  gameSlug,
  gameTitle,
  className,
}: {
  gameSlug: string;
  gameTitle: string;
  className?: string;
}) {
  const {
    favorite,
    pending,
    toggle,
  } = useFavoriteGame(gameSlug);

  return (
    <button
      type="button"
      className={`${styles.button} ${favorite ? styles.active : ""} ${className ?? ""}`}
      aria-label={
        favorite
          ? `Quitar ${gameTitle} de favoritos`
          : `Añadir ${gameTitle} a favoritos`
      }
      aria-pressed={favorite}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => void toggle()}
      data-game-favorite={gameSlug}
    >
      <span className={styles.surface} aria-hidden="true">
        <Heart
          size={19}
          fill={favorite ? "currentColor" : "none"}
        />
      </span>
    </button>
  );
}
