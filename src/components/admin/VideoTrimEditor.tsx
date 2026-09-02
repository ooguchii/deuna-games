"use client";

import {
  Pause,
  Play,
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
  MAX_PREVIEW_DURATION_SECONDS,
  PREVIEW_QUALITY_OPTIONS,
  parsePreviewTrimWindow,
  type PreviewQualityId,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

import styles from "./VideoTrimEditor.module.css";

const MIN_SELECTION_SECONDS = 0.1;
const KEYBOARD_STEP_SECONDS = 0.1;
const KEYBOARD_LARGE_STEP_SECONDS = 1;

type DragEdge = "start" | "end";

type PendingDrag = {
  edge: DragEdge;
  value: number;
};

type VideoTrimEditorProps = {
  src: string;
  sourceLabel: string;
  quality: PreviewQualityId;
  qualityDisabled?: boolean;
  onQualityChange: (quality: PreviewQualityId) => void;
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

export default function VideoTrimEditor({
  src,
  sourceLabel,
  quality,
  qualityDisabled = false,
  onQualityChange,
  onTrimChange,
}: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const trim = useMemo(
    () =>
      parsePreviewTrimWindow(
        String(startSeconds),
        String(endSeconds)
      ),
    [startSeconds, endSeconds]
  );

  useEffect(() => {
    onTrimChange(trim);
  }, [onTrimChange, trim]);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
      pendingDragRef.current = null;
    };
  }, []);

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
    // pointercancel puede llegar sin coordenadas fiables (cambio de ventana,
    // gesto del SO, etc.). Conservamos el último estado visual aplicado y no
    // provocamos un seek remoto inesperado.
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
      <div className={styles.previewStage}>
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
            const nextDuration =
              event.currentTarget.duration;

            if (
              !Number.isFinite(nextDuration) ||
              nextDuration < MIN_SELECTION_SECONDS
            ) {
              setMediaError(
                "El video no informa una duración válida para recortar."
              );
              onTrimChange(null);
              return;
            }

            const safeDuration = roundSeconds(
              nextDuration
            );
            const initialEnd = roundSeconds(
              Math.min(
                safeDuration,
                MAX_PREVIEW_DURATION_SECONDS
              )
            );

            setDuration(safeDuration);
            setCurrentTime(0);
            setStartSeconds(0);
            setEndSeconds(initialEnd);
            setMediaError(null);
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            const next = roundSeconds(
              video.currentTime
            );

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

        <button
          type="button"
          className={styles.centerPlay}
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
            Arrastra IN y OUT sobre la línea de tiempo. Durante el arrastre sólo se mueve la selección; el video busca la posición al soltar para evitar solicitudes remotas innecesarias. El recorte puede durar hasta 30 segundos.
          </p>
        </>
      )}
    </div>
  );
}
