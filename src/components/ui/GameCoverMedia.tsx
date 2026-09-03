"use client";

import { useEffect, useState } from "react";

import FramedVideo from "@/components/ui/FramedVideo";
import GameMedia from "@/components/ui/GameMedia";
import {
  resolveGameCoverVideo,
  resolveGameDestinationMediaMode,
} from "@/lib/media/game-video-media";
import type { Game } from "@/types/game";

type Props = {
  game: Game;
  sizes: string;
};

const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

export default function GameCoverMedia({ game, sizes }: Props) {
  const mode = resolveGameDestinationMediaMode(game, "cover");
  const video = resolveGameCoverVideo(game);
  const [hoverActive, setHoverActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_MEDIA);
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const videoActive = Boolean(
    video &&
    !reducedMotion &&
    (mode === "video" || (mode === "hover-video" && hoverActive))
  );

  function startHover() {
    if (
      mode === "hover-video" &&
      window.matchMedia(FINE_HOVER_MEDIA).matches
    ) {
      setHoverActive(true);
    }
  }

  function stopHover() {
    if (mode === "hover-video") setHoverActive(false);
  }

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onMouseEnter={startHover}
      onMouseLeave={stopHover}
    >
      <GameMedia
        src={game.coverImage}
        alt={game.imageAlt}
        sizes={sizes}
        viewport={game.imageMedia?.cover}
      />

      {videoActive && video && (
        <FramedVideo
          key={`${video.src}:${video.viewport.x}:${video.viewport.y}:${video.viewport.zoom}`}
          src={video.src}
          viewport={video.viewport}
          autoPlay
          loop
          controls={false}
          preload="metadata"
          tabIndex={-1}
          frameStyle={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: "transparent",
          }}
        />
      )}
    </div>
  );
}
