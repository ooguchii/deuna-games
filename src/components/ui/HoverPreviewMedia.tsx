"use client";

import {
  useEffect,
  useState,
} from "react";

import FramedVideo from "@/components/ui/FramedVideo";
import GameMedia from "@/components/ui/GameMedia";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  GameImageViewport,
  GameVideoViewport,
} from "@/types/game";

import styles from "./HoverPreviewMedia.module.css";

type HoverPreviewMediaProps = {
  imageSrc?: string;
  imageAlt: string;
  imageViewport?: GameImageViewport;
  sizes: string;
  fallbackClassName?: string;
  previewClip?: string;
  previewViewport?: GameVideoViewport;
  active: boolean;
};

type PreviewVideoProps = {
  src: string;
  viewport: GameVideoViewport;
};

function PreviewVideo({
  src,
  viewport,
}: PreviewVideoProps) {
  const [playing, setPlaying] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const syncDocumentVisibility = () => {
      setDocumentVisible(!document.hidden);
      if (document.hidden) setPlaying(false);
    };

    syncDocumentVisibility();
    document.addEventListener(
      "visibilitychange",
      syncDocumentVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        syncDocumentVisibility
      );
    };
  }, []);

  if (!documentVisible) return null;

  return (
    <FramedVideo
      className={`${styles.video} ${playing ? styles.videoReady : ""}`}
      src={src}
      viewport={viewport}
      muted
      loop
      autoPlay
      controls={false}
      preload="none"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onWaiting={() => setPlaying(false)}
      onStalled={() => setPlaying(false)}
      onError={() => setPlaying(false)}
    />
  );
}

export default function HoverPreviewMedia({
  imageSrc,
  imageAlt,
  imageViewport,
  sizes,
  fallbackClassName,
  previewClip,
  previewViewport = DEFAULT_PREVIEW_VIEWPORT,
  active,
}: HoverPreviewMediaProps) {
  return (
    <>
      <GameMedia
        src={imageSrc}
        alt={imageAlt}
        viewport={imageViewport}
        sizes={sizes}
        fallbackClassName={fallbackClassName}
      />

      {active && previewClip && (
        <PreviewVideo
          key={`${previewClip}:${previewViewport.x}:${previewViewport.y}:${previewViewport.zoom}:${previewViewport.aspect}`}
          src={previewClip}
          viewport={previewViewport}
        />
      )}
    </>
  );
}
