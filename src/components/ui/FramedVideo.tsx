"use client";

import {
  type CSSProperties,
  type VideoHTMLAttributes,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  resolvePreviewViewportCrop,
} from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

type VideoLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "style" | "width" | "height"
> & {
  src: string;
  viewport: GameVideoViewport;
  className?: string;
  frameStyle?: CSSProperties;
};

export default function FramedVideo({
  src,
  viewport,
  className,
  frameStyle,
  onLoadedMetadata,
  ...videoProps
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<VideoLayout | null>(null);

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

    const crop = resolvePreviewViewportCrop(
      video.videoWidth,
      video.videoHeight,
      viewport
    );
    if (!crop) return;

    // El crop es sólo una ventana lógica. Escalamos el fotograma completo para
    // que esa ventana cubra el destino y desplazamos el video hasta centrarla.
    // No existe segundo archivo ni recodificación para Card/Hero.
    const scale = Math.max(
      bounds.width / crop.width,
      bounds.height / crop.height
    );
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const cropCenterX = crop.x + crop.width / 2;
    const cropCenterY = crop.y + crop.height / 2;

    setLayout({
      width,
      height,
      left: bounds.width / 2 - cropCenterX * scale,
      top: bounds.height / 2 - cropCenterY * scale,
    });
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
    <div
      ref={frameRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        ...frameStyle,
      }}
      aria-hidden="true"
    >
      <video
        {...videoProps}
        ref={videoRef}
        src={src}
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(event) => {
          updateLayout();
          onLoadedMetadata?.(event);
        }}
        style={{
          position: "absolute",
          maxWidth: "none",
          maxHeight: "none",
          width: layout?.width ?? "100%",
          height: layout?.height ?? "100%",
          left: layout?.left ?? 0,
          top: layout?.top ?? 0,
          objectFit: layout ? "fill" : "cover",
          opacity: layout ? 1 : 0,
        }}
      />
    </div>
  );
}
