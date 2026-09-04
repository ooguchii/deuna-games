"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  resolveFramedMediaLayout,
  type FramedMediaLayout,
} from "@/lib/media/framed-media-layout";
import type { GameVideoViewport } from "@/types/game";

import styles from "./GameGalleryVideo.module.css";

type Props = {
  src: string;
  viewport: GameVideoViewport;
  label: string;
};

export default function GameGalleryVideo({
  src,
  viewport,
  label,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<FramedMediaLayout | null>(null);
  const [failed, setFailed] = useState(false);

  const updateLayout = useCallback(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (
      !frame ||
      !video ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    setLayout(
      resolveFramedMediaLayout(
        video.videoWidth,
        video.videoHeight,
        viewport,
        bounds.width,
        bounds.height
      )
    );
  }, [viewport]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateLayout);
    observer?.observe(frame);
    updateLayout();
    return () => observer?.disconnect();
  }, [src, updateLayout]);

  return (
    <div ref={frameRef} className={styles.frame}>
      {!failed ? (
        <video
          ref={videoRef}
          className={styles.video}
          src={src}
          controls
          preload="metadata"
          playsInline
          muted
          disablePictureInPicture
          disableRemotePlayback
          aria-label={label}
          onLoadedMetadata={updateLayout}
          onError={() => setFailed(true)}
          style={{
            width: layout?.width ?? "100%",
            height: layout?.height ?? "100%",
            left: layout?.left ?? 0,
            top: layout?.top ?? 0,
            objectFit: layout ? "fill" : "contain",
          }}
        />
      ) : (
        <div className={styles.fallback} role="status">
          No se pudo cargar este video de la galería.
        </div>
      )}
    </div>
  );
}
