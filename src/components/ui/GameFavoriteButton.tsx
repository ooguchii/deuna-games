"use client";

import {
  Heart,
} from "lucide-react";
import {
  type CSSProperties,
  useState,
} from "react";

import {
  useFavoriteGame,
} from "@/features/favorites/favorite-store";

import ScreenReaderStatus from "./ScreenReaderStatus";

export default function GameFavoriteButton({
  gameSlug,
  gameTitle,
  className,
  style,
  onFavoriteChange,
}: {
  gameSlug: string;
  gameTitle: string;
  className?: string;
  style?: CSSProperties;
  onFavoriteChange?: (favorite: boolean) => void;
}) {
  const {
    favorite,
    pending,
    toggle,
  } = useFavoriteGame(gameSlug);
  const [status, setStatus] = useState("");

  async function handleToggle() {
    const nextFavorite = !favorite;
    setStatus("");

    const saved = await toggle();

    if (saved) {
      onFavoriteChange?.(nextFavorite);
    }

    setStatus(
      saved
        ? nextFavorite
          ? `${gameTitle} añadido a favoritos.`
          : `${gameTitle} quitado de favoritos.`
        : `No se pudo actualizar el favorito de ${gameTitle}.`
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        aria-label={
          favorite
            ? `Quitar ${gameTitle} de favoritos`
            : `Añadir ${gameTitle} a favoritos`
        }
        aria-pressed={favorite}
        aria-busy={pending || undefined}
        disabled={pending}
        onClick={() => void handleToggle()}
        data-game-favorite={gameSlug}
      >
        <span aria-hidden="true">
          <Heart
            size={19}
            fill={favorite ? "currentColor" : "none"}
          />
        </span>
      </button>
      <ScreenReaderStatus>{status}</ScreenReaderStatus>
    </>
  );
}
