"use client";

import Image from "next/image";
import {
  CheckCircle2,
  ImageIcon,
  MonitorPlay,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";
import {
  getAdminVideoFrameSnapshot,
  requestAdminVideoFrame,
  retryAdminVideoFrame,
  subscribeAdminVideoFrame,
  type AdminVideoFrameSnapshot,
} from "@/lib/media/admin-video-frame-cache";
import {
  resolveFramedMediaLayout,
  type FramedMediaLayout,
} from "@/lib/media/framed-media-layout";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  GameImageViewport,
  GameVideoViewport,
} from "@/types/game";

import styles from "./AdminMediaThumbnail.module.css";

type CommonProps = {
  src: string;
  mode: "source" | "destination";
  frameAspect?: number;
  label?: string;
  badge?: string;
  className?: string;
  sizes?: string;
  playIndicator?: boolean;
  allowRetry?: boolean;
};

type ImageProps = CommonProps & {
  kind: "image";
  viewport?: GameImageViewport;
};

type VideoProps = CommonProps & {
  kind: "video";
  viewport?: GameVideoViewport;
};

type Props = ImageProps | VideoProps;

const IDLE_FRAME: AdminVideoFrameSnapshot = {
  status: "idle",
  url: null,
  width: 0,
  height: 0,
  error: null,
};

function useAdminVideoFrame(src: string | null) {
  const [frame, setFrame] = useState<AdminVideoFrameSnapshot>(() => (
    src && typeof window !== "undefined"
      ? getAdminVideoFrameSnapshot(src)
      : IDLE_FRAME
  ));
  const frameRef = useRef(frame);
  const intersectionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    if (!src) return;
    return subscribeAdminVideoFrame(src, (next) => {
      frameRef.current = next;
      setFrame(next);
    });
  }, [src]);

  useEffect(() => {
    if (!src) return;
    const node = intersectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      requestAdminVideoFrame(src);
      return;
    }

    let wasNearViewport = false;
    const observer = new IntersectionObserver(
      (records) => {
        const nearViewport = records.some((record) => record.isIntersecting);
        if (nearViewport && !wasNearViewport) {
          if (frameRef.current.status === "error") {
            retryAdminVideoFrame(src);
          } else {
            requestAdminVideoFrame(src);
          }
        }
        wasNearViewport = nearViewport;
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  return { frame, intersectionRef };
}

function useVideoLayout(
  frame: AdminVideoFrameSnapshot,
  viewport: GameVideoViewport
) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<FramedMediaLayout | null>(null);

  const updateLayout = useCallback(() => {
    const element = frameRef.current;
    if (!element || frame.width <= 0 || frame.height <= 0) {
      setLayout(null);
      return;
    }
    const bounds = element.getBoundingClientRect();
    setLayout(resolveFramedMediaLayout(
      frame.width,
      frame.height,
      viewport,
      bounds.width,
      bounds.height
    ));
  }, [frame.height, frame.width, viewport]);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateLayout);
    observer?.observe(element);
    updateLayout();
    return () => observer?.disconnect();
  }, [frame.url, updateLayout]);

  return { frameRef, layout };
}

function ThumbnailBadge({ children }: { children?: string }) {
  if (!children) return null;
  return <span className={styles.badge}>{children}</span>;
}

export default function AdminMediaThumbnail(props: Props) {
  const {
    src,
    mode,
    frameAspect,
    label,
    badge,
    className,
    sizes = "96px",
    allowRetry = false,
  } = props;
  const isVideo = props.kind === "video";
  const videoSrc = isVideo ? src : null;
  const { frame, intersectionRef } = useAdminVideoFrame(videoSrc);
  const videoViewport = isVideo
    ? props.viewport ?? DEFAULT_PREVIEW_VIEWPORT
    : DEFAULT_PREVIEW_VIEWPORT;
  const { frameRef, layout } = useVideoLayout(frame, videoViewport);
  const frameStyle = frameAspect
    ? ({ "--admin-media-thumbnail-aspect": String(frameAspect) } as CSSProperties)
    : undefined;
  const showPlayIndicator = props.playIndicator ?? isVideo;

  return (
    <span
      ref={intersectionRef}
      className={`${styles.root} ${className ?? ""}`}
      data-admin-media-mode={mode}
      data-admin-media-kind={props.kind}
      data-frame-status={isVideo ? frame.status : "ready"}
      role={label ? "group" : undefined}
      aria-label={label}
      title={label}
    >
      <span
        ref={frameRef}
        className={`${styles.frame} ${frameAspect ? styles.aspectFrame : styles.sourceFrame}`}
        style={frameStyle}
      >
        {props.kind === "image" ? (
          mode === "destination" ? (
            <GameMedia
              src={src}
              alt=""
              sizes={sizes}
              viewport={props.viewport}
            />
          ) : (
            <Image
              src={src}
              alt=""
              fill
              sizes={sizes}
              className={styles.sourceImage}
            />
          )
        ) : frame.status === "ready" && frame.url ? (
          mode === "source" ? (
            <Image
              src={frame.url}
              alt=""
              fill
              sizes={sizes}
              unoptimized
              draggable={false}
              className={styles.sourceImage}
            />
          ) : layout ? (
            <Image
              src={frame.url}
              alt=""
              width={frame.width}
              height={frame.height}
              unoptimized
              draggable={false}
              className={styles.destinationVideoFrame}
              style={{
                width: layout.width,
                height: layout.height,
                left: layout.left,
                top: layout.top,
              }}
            />
          ) : (
            <span className={styles.pendingState} aria-hidden="true">
              <MonitorPlay size={18} />
              <span className={styles.skeleton} />
            </span>
          )
        ) : frame.status === "error" ? (
          <span className={styles.errorState}>
            <TriangleAlert size={15} aria-hidden="true" />
            <span>Vista no disponible</span>
            {allowRetry && (
              <button
                type="button"
                onClick={() => retryAdminVideoFrame(src)}
                aria-label="Reintentar la vista temporal del video"
              >
                <RefreshCw size={13} aria-hidden="true" />
                Reintentar
              </button>
            )}
          </span>
        ) : (
          <span className={styles.pendingState} aria-hidden="true">
            {isVideo ? <MonitorPlay size={18} /> : <ImageIcon size={18} />}
            <span className={styles.skeleton} />
          </span>
        )}

        <ThumbnailBadge>{badge}</ThumbnailBadge>
        {isVideo && frame.status === "ready" && (
          <>
            {showPlayIndicator && (
              <span className={styles.playIndicator} aria-hidden="true">
                <MonitorPlay size={12} />
              </span>
            )}
            <span className={styles.verification} title="Vista comprobada">
              <CheckCircle2 size={12} aria-hidden="true" />
              <span className={styles.verificationText}>Vista comprobada</span>
            </span>
          </>
        )}
        {isVideo && frame.status === "error" && (
          <span className={styles.screenReaderStatus} role="status">
            No se pudo generar la vista temporal del video. La asignación no cambió.
          </span>
        )}
      </span>
    </span>
  );
}
