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
  const sourceAspect = viewport.aspect === "source";

  const updateLayout = useCallback(() => {
    if (sourceAspect) return;

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
  }, [sourceAspect, viewport]);

  useLayoutEffect(() => {
    if (sourceAspect) return;

    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateLayout);
    observer?.observe(frame);
    updateLayout();
    return () => observer?.disconnect();
  }, [sourceAspect, src, updateLayout]);

  return (
    <div
      ref={frameRef}
      className={sourceAspect ? styles.sourceFrame : styles.frame}
    >
      {!failed ? (
        <video
          ref={videoRef}
          className={sourceAspect ? styles.sourceVideo : styles.video}
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
          style={sourceAspect
            ? undefined
            : {
                width: layout?.width ?? "100%",
                height: layout?.height ?? "100%",
                left: layout?.left ?? 0,
                top: layout?.top ?? 0,
                objectFit: layout ? "fill" : "contain",
              }}
        />
      ) : (
        <div className={sourceAspect ? styles.sourceFallback : styles.fallback} role="status">
          No se pudo cargar este video de la galería.
        </div>
      )}
    </div>
  );
}
