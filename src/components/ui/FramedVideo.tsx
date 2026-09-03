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
  resolveFramedMediaLayout,
  type FramedMediaLayout,
} from "@/lib/media/framed-media-layout";
import type { GameVideoViewport } from "@/types/game";

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
  const [layout, setLayout] = useState<FramedMediaLayout | null>(null);

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

    const resolvedLayout = resolveFramedMediaLayout(
      video.videoWidth,
      video.videoHeight,
      viewport,
      bounds.width,
      bounds.height
    );
    if (resolvedLayout) setLayout(resolvedLayout);
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
