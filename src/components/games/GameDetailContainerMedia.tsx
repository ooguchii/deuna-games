"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import FramedVideo from "@/components/ui/FramedVideo";
import GameMedia from "@/components/ui/GameMedia";
import { normalizeGameImageViewport } from "@/lib/media/image-viewport";
import { normalizeGameVideoViewport } from "@/lib/media/game-video-media";
import type {
  GameDestinationMediaMode,
  GameDetailVideo,
  GameImageViewport,
} from "@/types/game";

import styles from "./GameDetailContainerMedia.module.css";

const FINE_POINTER_MEDIA = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";
const INTERACTION_SCOPE = "[data-game-detail-media-scope]";

type Props = {
  mode: GameDestinationMediaMode;
  imageSrc?: string;
  imageViewport?: GameImageViewport;
  video?: GameDetailVideo;
};

export default function GameDetailContainerMedia({
  mode,
  imageSrc,
  imageViewport,
  video,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fineHover, setFineHover] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [hoverActive, setHoverActive] = useState(false);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);

  useEffect(() => {
    const pointer = window.matchMedia(FINE_POINTER_MEDIA);
    const reduced = window.matchMedia(REDUCED_MOTION_MEDIA);
    const scope = rootRef.current?.closest<HTMLElement>(INTERACTION_SCOPE) ?? null;

    const syncMedia = () => {
      setFineHover(pointer.matches);
      setReducedMotion(reduced.matches);
      if (!pointer.matches || reduced.matches) setHoverActive(false);
    };
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    const startHover = () => {
      if (pointer.matches && !reduced.matches) setHoverActive(true);
    };
    const stopHover = () => setHoverActive(false);
    const onFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (!nextTarget || !scope?.contains(nextTarget as Node)) stopHover();
    };

    syncMedia();
    syncVisibility();
    pointer.addEventListener("change", syncMedia);
    reduced.addEventListener("change", syncMedia);
    document.addEventListener("visibilitychange", syncVisibility);
    scope?.addEventListener("pointerenter", startHover);
    scope?.addEventListener("pointerleave", stopHover);
    scope?.addEventListener("focusin", startHover);
    scope?.addEventListener("focusout", onFocusOut);

    return () => {
      pointer.removeEventListener("change", syncMedia);
      reduced.removeEventListener("change", syncMedia);
      document.removeEventListener("visibilitychange", syncVisibility);
      scope?.removeEventListener("pointerenter", startHover);
      scope?.removeEventListener("pointerleave", stopHover);
      scope?.removeEventListener("focusin", startHover);
      scope?.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const normalizedImageViewport = useMemo(
    () => normalizeGameImageViewport(imageViewport),
    [imageViewport]
  );
  const normalizedVideoViewport = useMemo(
    () => normalizeGameVideoViewport(video?.viewport),
    [video?.viewport]
  );

  const videoConfirmed = Boolean(
    video?.clip &&
      video.viewport.confirmed === true &&
      video.viewport.aspect === "source"
  );
  const videoEnabled = Boolean(
    mode !== "image" &&
      videoConfirmed &&
      !reducedMotion &&
      documentVisible &&
      failedVideo !== video?.clip &&
      (mode === "video" || (fineHover && hoverActive))
  );

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {imageSrc && (
        <div className={styles.imageLayer}>
          <GameMedia
            src={imageSrc}
            alt=""
            sizes="(max-width: 760px) 100vw, 1400px"
            viewport={normalizedImageViewport}
          />
        </div>
      )}

      {videoEnabled && video?.clip && (
        <FramedVideo
          key={video.clip}
          src={video.clip}
          viewport={normalizedVideoViewport}
          className={styles.videoLayer}
          autoPlay
          loop
          controls={false}
          preload="metadata"
          tabIndex={-1}
          onError={() => setFailedVideo(video.clip)}
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