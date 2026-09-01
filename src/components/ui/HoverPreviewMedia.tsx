"use client";

import {
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

type PreviewVideoProps = {
  src: string;
};

function PreviewVideo({
  src,
}: PreviewVideoProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <video
      className={`${styles.video} ${playing ? styles.videoReady : ""}`}
      src={src}
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
  );
}

export default function HoverPreviewMedia({
  imageSrc,
  imageAlt,
  sizes,
  fallbackClassName,
  previewClip,
  active,
}: HoverPreviewMediaProps) {
  return (
    <>
      <GameMedia
        src={imageSrc}
        alt={imageAlt}
        sizes={sizes}
        fallbackClassName={fallbackClassName}
      />

      {active && previewClip && (
        <PreviewVideo
          key={previewClip}
          src={previewClip}
        />
      )}
    </>
  );
}
