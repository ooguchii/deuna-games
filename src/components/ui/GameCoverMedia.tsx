"use client";

import GameMedia from "@/components/ui/GameMedia";
import { resolveGameCoverImage } from "@/lib/media/game-card-presentation";
import type { Game } from "@/types/game";

type Props = {
  game: Game;
  sizes: string;
  alt?: string;
  fallbackClassName?: string;
};

export default function GameCoverMedia({
  game,
  sizes,
  alt,
  fallbackClassName,
}: Props) {
  const coverImage = resolveGameCoverImage(game);

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
          src={coverImage}
          alt={alt ?? game.mediaAccessibility?.cover ?? game.imageAlt}
          sizes={sizes}
          viewport={game.imageMedia?.cover}
          fallbackClassName={fallbackClassName}
        />
      </div>
    </div>
  );
}
