"use client";

import {
  useEffect,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";

import styles from "./HoverPreviewMedia.module.css";

type HoverPreviewMediaProps = {
  imageSrc?: string;
  imageAlt: string;
  sizes: string;
  fallbackClassName?: string;
  previewClip?: string;
  active: boolean;
};

export default function HoverPreviewMedia({
  imageSrc,
  imageAlt,
  sizes,
  fallbackClassName,
  previewClip,
  active,
}: HoverPreviewMediaProps) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);

  return (
    <>
      <GameMedia
        src={imageSrc}
        alt={imageAlt}
        sizes={sizes}
        fallbackClassName={fallbackClassName}
      />

      {active && previewClip && (
        <video
          key={previewClip}
          className={`${styles.video} ${playing ? styles.videoReady : ""}`}
          src={previewClip}
          muted
          loop
          playsInline
          autoPlay
          controls={false}
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
        />
      )}
    </>
  );
}
