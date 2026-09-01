"use client";

import {
  useEffect,
  useRef,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    function syncDocumentVisibility() {
      const video = videoRef.current;
      if (!video) return;

      if (document.hidden) {
        video.pause();
        setPlaying(false);
        return;
      }

      void video.play().catch(() => {
        setPlaying(false);
      });
    }

    document.addEventListener(
      "visibilitychange",
      syncDocumentVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        syncDocumentVisibility
      );
      videoRef.current?.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={`${styles.video} ${playing ? styles.videoReady : ""}`}
      src={src}
      muted
      loop
      playsInline
      autoPlay
      controls={false}
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
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
