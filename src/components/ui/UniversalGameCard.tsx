"use client";

import type { Game } from "@/types/game";

import GameFavoriteButton from "./GameFavoriteButton";
import UniversalGameCardBase, {
  type UniversalGameCardVariant,
} from "./UniversalGameCardBase";
import styles from "./FavoriteUniversalGameCard.module.css";

export type { UniversalGameCardVariant } from "./UniversalGameCardBase";

export default function UniversalGameCard({
  game,
  variant = "standard",
}: {
  game: Game;
  variant?: UniversalGameCardVariant;
}) {
  return (
    <UniversalGameCardBase
      game={game}
      variant={variant}
      overlayAction={(
        <GameFavoriteButton
          gameSlug={game.slug}
          gameTitle={game.title}
          className={styles.favorite}
        />
      )}
    />
  );
}