"use client";

import {
  Move,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SkipBack,
} from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_VIEWPORT_ZOOM,
  MIN_PREVIEW_VIEWPORT_ZOOM,
  PREVIEW_QUALITY_OPTIONS,
  PREVIEW_VIEWPORT_ASPECT_OPTIONS,
  parsePreviewTrimWindow,
  parsePreviewViewport,
  resolvePreviewViewportCrop,
  type PreviewQualityId,
  type PreviewTrimWindow,
  type PreviewViewport,
} from "@/lib/media/preview-video-policy";

import styles from "./VideoTrimEditor.module.css";

const MIN_SELECTION_SECONDS = 0.1;
const KEYBOARD_STEP_SECONDS = 0.1;
const KEYBOARD_LARGE_STEP_SECONDS = 1;
const VIEWPORT_KEYBOARD_STEP = 0.02;
const VIEWPORT_KEYBOARD_LARGE_STEP = 0.1;

type DragEdge = "start" | "end";

type PendingDrag = {
  edge: DragEdge;
  value: number;
};

type VideoBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ViewportDrag = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  travelX: number;
  travelY: number;
};

type VideoTrimEditorProps = {
  src: string;
  sourceLabel: string;
  quality: PreviewQualityId;
  viewport: PreviewViewport;
  qualityDisabled?: boolean;
  onQualityChange: (quality: PreviewQualityId) => void;
  onViewportChange: (viewport: PreviewViewport) => void;
  onTrimChange: (
    trim: PreviewTrimWindow | null
  ) => void;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function roundSeconds(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function roundViewport(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00.0";
  }

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;

  return `${String(minutes).padStart(2, "0")}:${seconds
    .toFixed(1)
    .padStart(4, "0")}`;
}

function normalizeViewport(viewport: PreviewViewport) {
  return parsePreviewViewport(
    String(viewport.x),
    String(viewport.y),
    String(viewport.zoom),
    viewport.aspect
  );
}

export default function VideoTrimEditor({
  src,
  sourceLabel,
  quality,
  viewport,
  qualityDisabled = false,
  onQualityChange,
  onViewportChange,
  onTrimChange,
}: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const viewportDragFrameRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<PreviewViewport | null>(null);
  const viewportDragRef = useRef<ViewportDrag | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [videoBox, setVideoBox] = useState<VideoBox | null>(null);
  const [viewportDraft, setViewportDraft] = useState<PreviewViewport>(
    normalizeViewport(viewport) ?? DEFAULT_PREVIEW_VIEWPORT
  );

  const trim = useMemo(
    () =>
      parsePreviewTrimWindow(
        String(startSeconds),
        String(endSeconds)
      ),
    [startSeconds, endSeconds]
  );

  const sourceCrop = useMemo(
    () => resolvePreviewViewportCrop(
      sourceWidth,
      sourceHeight,
      viewportDraft
    ),
    [sourceHeight, sourceWidth, viewportDraft]
  );

  const viewportRect = useMemo(() => {
    if (
      !sourceCrop ||
      !videoBox ||
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      return null;
    }

    return {
      left:
        videoBox.left +
        (sourceCrop.x / sourceWidth) * videoBox.width,
      top:
        videoBox.top +
        (sourceCrop.y / sourceHeight) * videoBox.height,
      width:
        (sourceCrop.width / sourceWidth) * videoBox.width,
      height:
        (sourceCrop.height / sourceHeight) * videoBox.height,
    };
  }, [sourceCrop, sourceHeight, sourceWidth, videoBox]);

  useEffect(() => {
    onTrimChange(trim);
  }, [onTrimChange, trim]);

  useEffect(() => {
    const stage = previewStageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return;

    const syncVideoBox = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        setVideoBox(null);
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const elementWidth = videoRect.width;
      const elementHeight = videoRect.height;
      const sourceRatio = video.videoWidth / video.videoHeight;
      const elementRatio = elementWidth / elementHeight;

      let renderedWidth = elementWidth;
      let renderedHeight = elementHeight;

      if (elementRatio > sourceRatio) {
        renderedWidth = elementHeight * sourceRatio;
      } else {
        renderedHeight = elementWidth / sourceRatio;
      }

      setVideoBox({
        left:
          videoRect.left - stageRect.left +
          (elementWidth - renderedWidth) / 2,
        top:
          videoRect.top - stageRect.top +
          (elementHeight - renderedHeight) / 2,
        width: renderedWidth,
        height: renderedHeight,
      });
    };

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(syncVideoBox);
    observer?.observe(stage);
    observer?.observe(video);
    video.addEventListener("loadedmetadata", syncVideoBox);
    syncVideoBox();

    return () => {
      observer?.disconnect();
      video.removeEventListener("loadedmetadata", syncVideoBox);
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
      if (viewportDragFrameRef.current !== null) {
        cancelAnimationFrame(viewportDragFrameRef.current);
      }
      pendingDragRef.current = null;
      pendingViewportRef.current = null;
      viewportDragRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = resultCanvasRef.current;
    if (!video || !canvas || !sourceCrop || video.readyState < 2) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const ratio = sourceCrop.width / sourceCrop.height;
      const maxWidth = 320;
      const maxHeight = 220;
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }

      canvas.width = Math.max(2, Math.round(width));
      canvas.height = Math.max(2, Math.round(height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.drawImage(
        video,
        sourceCrop.x,
        sourceCrop.y,
        sourceCrop.width,
        sourceCrop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [currentTime, sourceCrop]);

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || duration <= 0) return;

    const next = clamp(
      roundSeconds(value),
      0,
      duration
    );
    video.currentTime = next;
    setCurrentTime(next);
  }

  function updateStart(
    value: number,
    syncVideo = true
  ) {
    if (duration <= 0 || endSeconds <= 0) return;

    const minimum = Math.max(
      0,
      endSeconds - MAX_PREVIEW_DURATION_SECONDS
    );
    const maximum = Math.max(
      minimum,
      endSeconds - MIN_SELECTION_SECONDS
    );
    const next = roundSeconds(
      clamp(value, minimum, maximum)
    );

    setStartSeconds(next);
    setLoopSelection(false);
    if (syncVideo) seek(next);
  }

  function updateEnd(
    value: number,
    syncVideo = true
  ) {
    if (duration <= 0) return;

    const minimum = Math.min(
      duration,
      startSeconds + MIN_SELECTION_SECONDS
    );
    const maximum = Math.min(
      duration,
      startSeconds + MAX_PREVIEW_DURATION_SECONDS
    );
    const next = roundSeconds(
      clamp(value, minimum, maximum)
    );

    setEndSeconds(next);
    setLoopSelection(false);
    if (syncVideo) seek(next);
  }

  function markStartAtPlayhead() {
    if (duration <= 0) return;

    const desired = clamp(
      currentTime,
      0,
      Math.max(0, duration - MIN_SELECTION_SECONDS)
    );
    let nextEnd = endSeconds;

    if (nextEnd <= desired) {
      nextEnd = Math.min(
        duration,
        desired + Math.min(
          MAX_PREVIEW_DURATION_SECONDS,
          Math.max(
            MIN_SELECTION_SECONDS,
            duration - desired
          )
        )
      );
      setEndSeconds(roundSeconds(nextEnd));
    }

    if (
      nextEnd - desired >
      MAX_PREVIEW_DURATION_SECONDS
    ) {
      nextEnd = Math.min(
        duration,
        desired + MAX_PREVIEW_DURATION_SECONDS
      );
      setEndSeconds(roundSeconds(nextEnd));
    }

    setStartSeconds(roundSeconds(desired));
    setLoopSelection(false);
  }

  function markEndAtPlayhead() {
    if (duration <= 0) return;

    const desired = clamp(
      currentTime,
      MIN_SELECTION_SECONDS,
      duration
    );
    let nextStart = startSeconds;

    if (desired <= nextStart) {
      nextStart = Math.max(
        0,
        desired - MIN_SELECTION_SECONDS
      );
      setStartSeconds(roundSeconds(nextStart));
    }

    if (
      desired - nextStart >
      MAX_PREVIEW_DURATION_SECONDS
    ) {
      nextStart = Math.max(
        0,
        desired - MAX_PREVIEW_DURATION_SECONDS
      );
      setStartSeconds(roundSeconds(nextStart));
    }

    setEndSeconds(roundSeconds(desired));
    setLoopSelection(false);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    setLoopSelection(false);

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function previewSelection() {
    const video = videoRef.current;
    if (!video || !trim) return;

    video.currentTime = trim.startSeconds;
    setCurrentTime(trim.startSeconds);
    setLoopSelection(true);
    void video.play();
  }

  function positionFromPointer(
    event: PointerEvent<HTMLElement>
  ) {
    const timeline = timelineRef.current;
    if (!timeline || duration <= 0) return 0;

    const rect = timeline.getBoundingClientRect();
    const ratio = clamp(
      (event.clientX - rect.left) / rect.width,
      0,
      1
    );

    return roundSeconds(ratio * duration);
  }

  function handleTimelinePointerDown(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (event.target !== event.currentTarget) return;
    seek(positionFromPointer(event));
  }

  function applyDrag(edge: DragEdge, value: number) {
    if (edge === "start") {
      updateStart(value, false);
    } else {
      updateEnd(value, false);
    }
  }

  function clearPendingDrag() {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRef.current = null;
  }

  function scheduleDrag(edge: DragEdge, value: number) {
    pendingDragRef.current = { edge, value };
    if (dragFrameRef.current !== null) return;

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragRef.current;
      pendingDragRef.current = null;
      if (pending) applyDrag(pending.edge, pending.value);
    });
  }

  function handlePointerMove(
    event: PointerEvent<HTMLButtonElement>,
    edge: DragEdge
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    scheduleDrag(edge, positionFromPointer(event));
  }

  function finishPointerDrag(
    event: PointerEvent<HTMLButtonElement>,
    edge: DragEdge
  ) {
    clearPendingDrag();

    const value = positionFromPointer(event);
    if (edge === "start") {
      updateStart(value, true);
    } else {
      updateEnd(value, true);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointerDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    clearPendingDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSliderKey(
    event: KeyboardEvent<HTMLButtonElement>,
    edge: DragEdge
  ) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight"
    ) {
      return;
    }

    event.preventDefault();
    const direction =
      event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey
      ? KEYBOARD_LARGE_STEP_SECONDS
      : KEYBOARD_STEP_SECONDS;

    if (edge === "start") {
      updateStart(
        startSeconds + direction * step
      );
    } else {
      updateEnd(
        endSeconds + direction * step
      );
    }
  }

  function commitViewport(next: PreviewViewport) {
    const normalized = normalizeViewport(next);
    if (!normalized) return;
    setViewportDraft(normalized);
    onViewportChange(normalized);
  }

  function scheduleViewportDraft(next: PreviewViewport) {
    pendingViewportRef.current = normalizeViewport(next);
    if (viewportDragFrameRef.current !== null) return;

    viewportDragFrameRef.current = requestAnimationFrame(() => {
      viewportDragFrameRef.current = null;
      const pending = pendingViewportRef.current;
      pendingViewportRef.current = null;
      if (pending) setViewportDraft(pending);
    });
  }

  function viewportFromPointer(
    event: PointerEvent<HTMLButtonElement>
  ) {
    const drag = viewportDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;

    return {
      ...viewportDraft,
      x: drag.travelX <= 0
        ? 0.5
        : roundViewport(clamp(
            drag.startX +
              (event.clientX - drag.startClientX) / drag.travelX,
            0,
            1
          )),
      y: drag.travelY <= 0
        ? 0.5
        : roundViewport(clamp(
            drag.startY +
              (event.clientY - drag.startClientY) / drag.travelY,
            0,
            1
          )),
    };
  }

  function startViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (!videoBox || !viewportRect || qualityDisabled) return;
    event.stopPropagation();
    videoRef.current?.pause();
    setLoopSelection(false);
    viewportDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: viewportDraft.x,
      startY: viewportDraft.y,
      travelX: Math.max(0, videoBox.width - viewportRect.width),
      travelY: Math.max(0, videoBox.height - viewportRect.height),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = viewportFromPointer(event);
    if (next) scheduleViewportDraft(next);
  }

  function finishViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = viewportFromPointer(event);
    if (viewportDragFrameRef.current !== null) {
      cancelAnimationFrame(viewportDragFrameRef.current);
      viewportDragFrameRef.current = null;
    }
    pendingViewportRef.current = null;
    viewportDragRef.current = null;
    if (next) commitViewport(next);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function cancelViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (viewportDragFrameRef.current !== null) {
      cancelAnimationFrame(viewportDragFrameRef.current);
      viewportDragFrameRef.current = null;
    }
    pendingViewportRef.current = null;
    viewportDragRef.current = null;
    onViewportChange(viewportDraft);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleViewportKey(
    event: KeyboardEvent<HTMLButtonElement>
  ) {
    const horizontal =
      event.key === "ArrowLeft" || event.key === "ArrowRight";
    const vertical =
      event.key === "ArrowUp" || event.key === "ArrowDown";
    if (!horizontal && !vertical) return;

    event.preventDefault();
    const step = event.shiftKey
      ? VIEWPORT_KEYBOARD_LARGE_STEP
      : VIEWPORT_KEYBOARD_STEP;
    const next = { ...viewportDraft };

    if (event.key === "ArrowLeft") next.x -= step;
    if (event.key === "ArrowRight") next.x += step;
    if (event.key === "ArrowUp") next.y -= step;
    if (event.key === "ArrowDown") next.y += step;
    next.x = roundViewport(clamp(next.x, 0, 1));
    next.y = roundViewport(clamp(next.y, 0, 1));
    commitViewport(next);
  }

  function quickViewport(side: "left" | "center" | "right") {
    const x = side === "left" ? 0 : side === "right" ? 1 : 0.5;
    commitViewport({
      ...viewportDraft,
      x,
      y: 0.5,
      zoom:
        side === "center"
          ? viewportDraft.zoom
          : Math.max(2, viewportDraft.zoom),
    });
  }

  const startPercent = duration > 0
    ? (startSeconds / duration) * 100
    : 0;
  const endPercent = duration > 0
    ? (endSeconds / duration) * 100
    : 0;
  const playheadPercent = duration > 0
    ? (currentTime / duration) * 100
    : 0;

  return (
    <div className={styles.editor}>
      <div className={styles.previewWorkspace}>
        <div ref={previewStageRef} className={styles.previewStage}>
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            controls={false}
            onClick={togglePlayback}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              const nextDuration = video.duration;

              if (
                !Number.isFinite(nextDuration) ||
                nextDuration < MIN_SELECTION_SECONDS ||
                video.videoWidth <= 0 ||
                video.videoHeight <= 0
              ) {
                setMediaError(
                  "El video no informa una duración o dimensiones válidas para editar."
                );
                onTrimChange(null);
                return;
              }

              const safeDuration = roundSeconds(nextDuration);
              const initialEnd = roundSeconds(
                Math.min(
                  safeDuration,
                  MAX_PREVIEW_DURATION_SECONDS
                )
              );

              setSourceWidth(video.videoWidth);
              setSourceHeight(video.videoHeight);
              setDuration(safeDuration);
              setCurrentTime(0);
              setStartSeconds(0);
              setEndSeconds(initialEnd);
              setMediaError(null);
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              const next = roundSeconds(video.currentTime);

              if (
                loopSelection &&
                trim &&
                next >= trim.endSeconds - 0.02
              ) {
                video.currentTime = trim.startSeconds;
                setCurrentTime(trim.startSeconds);
                if (video.paused) void video.play();
                return;
              }

              setCurrentTime(next);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setLoopSelection(false);
            }}
            onError={() => {
              setMediaError(
                "No se pudo reproducir esta fuente para seleccionar el recorte."
              );
              onTrimChange(null);
            }}
          />

          {viewportRect && (
            <>
              <div
                className={styles.viewportFrame}
                style={{
                  left: viewportRect.left,
                  top: viewportRect.top,
                  width: viewportRect.width,
                  height: viewportRect.height,
                }}
                aria-hidden="true"
              >
                <span className={`${styles.viewportCorner} ${styles.viewportCornerTopLeft}`} />
                <span className={`${styles.viewportCorner} ${styles.viewportCornerTopRight}`} />
                <span className={`${styles.viewportCorner} ${styles.viewportCornerBottomLeft}`} />
                <span className={`${styles.viewportCorner} ${styles.viewportCornerBottomRight}`} />
              </div>
              <button
                type="button"
                className={styles.viewportMoveHandle}
                style={{
                  left: viewportRect.left + viewportRect.width / 2,
                  top: viewportRect.top + viewportRect.height / 2,
                }}
                disabled={qualityDisabled}
                aria-label="Mover el área visible del video"
                title="Arrastra para elegir qué zona del video será visible"
                onPointerDown={startViewportDrag}
                onPointerMove={moveViewportDrag}
                onPointerUp={finishViewportDrag}
                onPointerCancel={cancelViewportDrag}
                onKeyDown={handleViewportKey}
              >
                <Move size={19} aria-hidden="true" />
              </button>
            </>
          )}

          <button
            type="button"
            className={`${styles.centerPlay} ${viewportRect ? styles.centerPlayViewport : ""}`}
            onClick={togglePlayback}
            aria-label={
              playing ? "Pausar video" : "Reproducir video"
            }
          >
            {playing ? (
              <Pause size={22} aria-hidden="true" />
            ) : (
              <Play size={22} aria-hidden="true" />
            )}
          </button>
        </div>

        <aside className={styles.viewportPanel} aria-label="Área visible del video">
          <div className={styles.viewportPanelHeading}>
            <div>
              <span>ÁREA VISIBLE</span>
              <strong>Elige qué parte se verá</strong>
            </div>
            <small>
              Lo que quede dentro del marco será lo que se codifique en el WebM final.
            </small>
          </div>

          <div className={styles.viewportPositionGrid}>
            <label>
              <span>Posición X</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(viewportDraft.x * 100)}
                disabled={qualityDisabled}
                onChange={(event) => commitViewport({
                  ...viewportDraft,
                  x: clamp(Number(event.target.value) / 100, 0, 1),
                })}
              />
            </label>
            <label>
              <span>Posición Y</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(viewportDraft.y * 100)}
                disabled={qualityDisabled}
                onChange={(event) => commitViewport({
                  ...viewportDraft,
                  y: clamp(Number(event.target.value) / 100, 0, 1),
                })}
              />
            </label>
          </div>

          <label className={styles.viewportControl}>
            <span>
              Zoom
              <strong>{Math.round(viewportDraft.zoom * 100)}%</strong>
            </span>
            <input
              type="range"
              min={MIN_PREVIEW_VIEWPORT_ZOOM * 100}
              max={MAX_PREVIEW_VIEWPORT_ZOOM * 100}
              step="5"
              value={Math.round(viewportDraft.zoom * 100)}
              disabled={qualityDisabled}
              onChange={(event) => commitViewport({
                ...viewportDraft,
                zoom: Number(event.target.value) / 100,
              })}
            />
          </label>

          <label className={styles.viewportControl}>
            <span>Relación del encuadre</span>
            <select
              value={viewportDraft.aspect}
              disabled={qualityDisabled}
              onChange={(event) => commitViewport({
                ...viewportDraft,
                aspect: event.target.value as PreviewViewport["aspect"],
              })}
            >
              {PREVIEW_VIEWPORT_ASPECT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.viewportPresets} aria-label="Posiciones rápidas de encuadre">
            <button
              type="button"
              disabled={qualityDisabled}
              onClick={() => quickViewport("left")}
            >
              Izquierda
            </button>
            <button
              type="button"
              disabled={qualityDisabled}
              onClick={() => quickViewport("center")}
            >
              Centro
            </button>
            <button
              type="button"
              disabled={qualityDisabled}
              onClick={() => quickViewport("right")}
            >
              Derecha
            </button>
          </div>

          <button
            type="button"
            className={styles.viewportReset}
            disabled={qualityDisabled}
            onClick={() => commitViewport({ ...DEFAULT_PREVIEW_VIEWPORT })}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Restablecer encuadre
          </button>

          <div className={styles.viewportResult}>
            <span>Resultado final · fotograma actual</span>
            <div>
              <canvas
                ref={resultCanvasRef}
                role="img"
                aria-label="Vista previa del área visible elegida"
              >
                Vista previa del encuadre seleccionado.
              </canvas>
            </div>
            <small>
              Para mostrar sólo una zona, aumenta el zoom y arrastra el control central. Los botones Izquierda/Derecha aplican al menos 200% de zoom.
            </small>
          </div>
        </aside>
      </div>

      <div className={styles.sourceRow}>
        <span>{sourceLabel}</span>
        <strong>
          {duration > 0
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : "Cargando duración…"}
        </strong>
      </div>

      {mediaError ? (
        <div className={styles.error} role="alert">
          {mediaError}
        </div>
      ) : (
        <>
          <div
            ref={timelineRef}
            className={styles.timeline}
            onPointerDown={handleTimelinePointerDown}
            aria-label="Línea de tiempo del video"
          >
            <div className={styles.timelineBase} />

            <div
              className={styles.selection}
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(
                  0,
                  endPercent - startPercent
                )}%`,
              }}
              aria-hidden="true"
            />

            <div
              className={styles.playhead}
              style={{
                left: `${playheadPercent}%`,
              }}
              aria-hidden="true"
            />

            <button
              type="button"
              role="slider"
              aria-orientation="horizontal"
              className={`${styles.handle} ${styles.handleStart}`}
              style={{ left: `${startPercent}%` }}
              aria-label={`Inicio del recorte: ${formatTime(startSeconds)}`}
              aria-valuemin={0}
              aria-valuemax={Math.max(
                0,
                endSeconds - MIN_SELECTION_SECONDS
              )}
              aria-valuenow={startSeconds}
              aria-valuetext={formatTime(startSeconds)}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(
                  event.pointerId
                );
              }}
              onPointerMove={(event) =>
                handlePointerMove(event, "start")
              }
              onPointerUp={(event) =>
                finishPointerDrag(event, "start")
              }
              onPointerCancel={cancelPointerDrag}
              onKeyDown={(event) =>
                handleSliderKey(event, "start")
              }
            >
              <span>IN</span>
            </button>

            <button
              type="button"
              role="slider"
              aria-orientation="horizontal"
              className={`${styles.handle} ${styles.handleEnd}`}
              style={{ left: `${endPercent}%` }}
              aria-label={`Final del recorte: ${formatTime(endSeconds)}`}
              aria-valuemin={Math.min(
                duration,
                startSeconds + MIN_SELECTION_SECONDS
              )}
              aria-valuemax={Math.min(
                duration,
                startSeconds + MAX_PREVIEW_DURATION_SECONDS
              )}
              aria-valuenow={endSeconds}
              aria-valuetext={formatTime(endSeconds)}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(
                  event.pointerId
                );
              }}
              onPointerMove={(event) =>
                handlePointerMove(event, "end")
              }
              onPointerUp={(event) =>
                finishPointerDrag(event, "end")
              }
              onPointerCancel={cancelPointerDrag}
              onKeyDown={(event) =>
                handleSliderKey(event, "end")
              }
            >
              <span>OUT</span>
            </button>
          </div>

          <div className={styles.trimSummary}>
            <div>
              <span>IN</span>
              <strong>{formatTime(startSeconds)}</strong>
            </div>
            <div className={styles.selectionDuration}>
              <Scissors size={15} aria-hidden="true" />
              <strong>
                {trim
                  ? `${trim.durationSeconds.toFixed(1)} s seleccionados`
                  : "Recorte inválido"}
              </strong>
            </div>
            <div>
              <span>OUT</span>
              <strong>{formatTime(endSeconds)}</strong>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              onClick={togglePlayback}
              disabled={duration <= 0}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              {playing ? "Pausar" : "Reproducir"}
            </button>

            <button
              type="button"
              onClick={previewSelection}
              disabled={!trim}
            >
              <SkipBack size={16} aria-hidden="true" />
              Reproducir recorte
            </button>

            <button
              type="button"
              onClick={markStartAtPlayhead}
              disabled={duration <= 0}
            >
              Marcar IN aquí
            </button>

            <button
              type="button"
              onClick={markEndAtPlayhead}
              disabled={duration <= 0}
            >
              Marcar OUT aquí
            </button>
          </div>

          <fieldset
            className={styles.qualityPanel}
            disabled={qualityDisabled}
          >
            <legend>Calidad del preview guardado</legend>
            <p>
              La fuente remota sigue usando extracción parcial. Este ajuste controla el WebM final; si un tramo supera el límite de 3 MB, DeUna reduce calidad automáticamente antes de fallar.
            </p>
            <div className={styles.qualityGrid}>
              {PREVIEW_QUALITY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`${styles.qualityOption} ${quality === option.id ? styles.qualityOptionActive : ""}`}
                >
                  <input
                    type="radio"
                    name="preview-quality"
                    value={option.id}
                    checked={quality === option.id}
                    onChange={() => onQualityChange(option.id)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>
                      Hasta {option.targetWidth} px · {option.targetFps} FPS
                    </small>
                  </span>
                  <em>{option.detail}</em>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.numericControls}>
            <label>
              <span>Inicio exacto (s)</span>
              <input
                type="number"
                min="0"
                max={Math.max(
                  0,
                  endSeconds - MIN_SELECTION_SECONDS
                )}
                step="0.1"
                value={startSeconds}
                onChange={(event) =>
                  updateStart(
                    Number(event.target.value)
                  )
                }
              />
            </label>

            <label>
              <span>Final exacto (s)</span>
              <input
                type="number"
                min={Math.min(
                  duration,
                  startSeconds + MIN_SELECTION_SECONDS
                )}
                max={Math.min(
                  duration,
                  startSeconds + MAX_PREVIEW_DURATION_SECONDS
                )}
                step="0.1"
                value={endSeconds}
                onChange={(event) =>
                  updateEnd(
                    Number(event.target.value)
                  )
                }
              />
            </label>
          </div>

          <p className={styles.help}>
            Arrastra IN y OUT sobre la línea de tiempo. Durante el arrastre sólo se mueve la selección; el video busca la posición al soltar para evitar solicitudes remotas innecesarias. El recorte puede durar hasta 30 segundos. El encuadre visual se procesa únicamente al guardar.
          </p>
        </>
      )}
    </div>
  );
}
