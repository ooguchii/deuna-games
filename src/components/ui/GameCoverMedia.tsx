"use client";

import GameMedia from "@/components/ui/GameMedia";
import type { Game } from "@/types/game";

type Props = {
  game: Game;
  sizes: string;
};

export default function GameCoverMedia({ game, sizes }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "#070b11",
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, 80cqh)",
          aspectRatio: "4 / 5",
          overflow: "hidden",
        }}
      >
        <GameMedia
          src={game.coverImage}
          alt={game.mediaAccessibility?.cover ?? game.imageAlt}
          sizes={sizes}
          viewport={game.imageMedia?.cover}
        />
      </div>
    </div>
  );
}
