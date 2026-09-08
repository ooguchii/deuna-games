"use client";

import type { ReactNode } from "react";

import type { GameCardPresentationMode } from "@/lib/media/game-card-presentation";
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
  presentation,
  supplementalContent,
}: {
  game: Game;
  variant?: UniversalGameCardVariant;
  presentation?: GameCardPresentationMode;
  supplementalContent?: ReactNode;
}) {
  return (
    <UniversalGameCardBase
      game={game}
      variant={variant}
      presentation={presentation}
      supplementalContent={supplementalContent}
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
