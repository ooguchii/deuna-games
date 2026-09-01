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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MAX_PREVIEW_DURATION_SECONDS,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

import styles from "./VideoTrimEditor.module.css";

const MIN_SELECTION_SECONDS = 0.1;
const KEYBOARD_STEP_SECONDS = 0.1;
const KEYBOARD_LARGE_STEP_SECONDS = 1;
const PLAYER_ID = "deuna-youtube-preview-player";
const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
const ALLOWED_MESSAGE_ORIGINS = new Set([
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
]);

type YouTubeTrimEditorProps = {
  videoId: string;
  sourceLabel: string;
  onTrimChange: (
    trim: PreviewTrimWindow | null
  ) => void;
};

type YouTubeMessage = {
  event?: unknown;
  info?: unknown;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(Math.max(value, minimum), maximum);
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

function parseMessage(value: unknown): YouTubeMessage | null {
  if (typeof value === "object" && value !== null) {
    return value as YouTubeMessage;
  }

  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as YouTubeMessage)
      : null;
  } catch {
    return null;
  }
}

export default function YouTubeTrimEditor({
  videoId,
  sourceLabel,
  onTrimChange,
}: YouTubeTrimEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [browserOrigin, setBrowserOrigin] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(false);
  const [ready, setReady] = useState(false);
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
    setBrowserOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    onTrimChange(trim);
  }, [onTrimChange, trim]);

  const sendPlayerMessage = useCallback(
    (payload: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(payload),
        PLAYER_ORIGIN
      );
    },
    []
  );

  const sendCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      sendPlayerMessage({
        event: "command",
        func,
        args,
        id: PLAYER_ID,
      });
    },
    [sendPlayerMessage]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!ALLOWED_MESSAGE_ORIGINS.has(event.origin)) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = parseMessage(event.data);
      if (!message) return;

      if (message.event === "onReady") {
        setReady(true);
        setMediaError(null);
        return;
      }

      if (message.event === "onError") {
        setMediaError(
          "YouTube no permite reproducir este video en el editor o el video no está disponible."
        );
        setReady(false);
        onTrimChange(null);
        return;
      }

      if (message.event === "onStateChange") {
        setPlaying(message.info === 1);
        return;
      }

      if (
        message.event === "infoDelivery" &&
        typeof message.info === "object" &&
        message.info !== null
      ) {
        const info = message.info as Record<string, unknown>;
        const nextDuration = Number(info.duration);
        const nextCurrentTime = Number(info.currentTime);
        const playerState = Number(info.playerState);

        if (
          Number.isFinite(nextDuration) &&
          nextDuration >= MIN_SELECTION_SECONDS
        ) {
          const safeDuration = roundSeconds(nextDuration);
          setDuration((previous) => {
            if (previous > 0) return previous;
            setStartSeconds(0);
            setEndSeconds(
              roundSeconds(
                Math.min(
                  safeDuration,
                  MAX_PREVIEW_DURATION_SECONDS
                )
              )
            );
            return safeDuration;
          });
        }

        if (
          Number.isFinite(nextCurrentTime) &&
          nextCurrentTime >= 0
        ) {
          const safeCurrent = roundSeconds(nextCurrentTime);
          setCurrentTime(safeCurrent);

          if (
            loopSelection &&
            trim &&
            safeCurrent >= trim.endSeconds - 0.08
          ) {
            sendCommand("seekTo", [trim.startSeconds, true]);
            sendCommand("playVideo");
            setCurrentTime(trim.startSeconds);
          }
        }

        if (Number.isFinite(playerState)) {
          setPlaying(playerState === 1);
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loopSelection, onTrimChange, sendCommand, trim]);

  function initializePlayerChannel() {
    sendPlayerMessage({
      event: "listening",
      id: PLAYER_ID,
    });

    for (const eventName of [
      "onReady",
      "onStateChange",
      "onError",
    ]) {
      sendCommand("addEventListener", [eventName]);
    }
  }

  function seek(value: number) {
    if (duration <= 0) return;

    const next = clamp(
      roundSeconds(value),
      0,
      duration
    );
    sendCommand("seekTo", [next, true]);
    setCurrentTime(next);
  }

  function updateStart(value: number) {
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
    seek(next);
  }

  function updateEnd(value: number) {
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
    seek(next);
  }

  function togglePlayback() {
    setLoopSelection(false);
    sendCommand(playing ? "pauseVideo" : "playVideo");
  }

  function previewSelection() {
    if (!trim) return;
    sendCommand("seekTo", [trim.startSeconds, true]);
    sendCommand("playVideo");
    setCurrentTime(trim.startSeconds);
    setLoopSelection(true);
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
    }

    if (
      nextEnd - desired >
      MAX_PREVIEW_DURATION_SECONDS
    ) {
      nextEnd = Math.min(
        duration,
        desired + MAX_PREVIEW_DURATION_SECONDS
      );
    }

    setStartSeconds(roundSeconds(desired));
    setEndSeconds(roundSeconds(nextEnd));
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
    }

    if (
      desired - nextStart >
      MAX_PREVIEW_DURATION_SECONDS
    ) {
      nextStart = Math.max(
        0,
        desired - MAX_PREVIEW_DURATION_SECONDS
      );
    }

    setStartSeconds(roundSeconds(nextStart));
    setEndSeconds(roundSeconds(desired));
    setLoopSelection(false);
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

  function handleSliderKey(
    event: KeyboardEvent<HTMLButtonElement>,
    edge: "start" | "end"
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
      updateStart(startSeconds + direction * step);
    } else {
      updateEnd(endSeconds + direction * step);
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
  const embedSrc = browserOrigin
    ? `${PLAYER_ORIGIN}/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&controls=1&rel=0&origin=${encodeURIComponent(browserOrigin)}`
    : "";

  return (
    <div className={styles.editor}>
      <div className={styles.previewStage}>
        {embedSrc ? (
          <iframe
            ref={iframeRef}
            id={PLAYER_ID}
            src={embedSrc}
            title="Vista previa de YouTube para recortar"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={initializePlayerChannel}
          />
        ) : null}
      </div>

      <div className={styles.sourceRow}>
        <span>{sourceLabel}</span>
        <strong>
          {duration > 0
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : ready
              ? "Leyendo duración…"
              : "Conectando con YouTube…"}
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
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              seek(positionFromPointer(event));
            }}
            aria-label="Línea de tiempo del video de YouTube"
          >
            <div className={styles.timelineBase} />
            <div
              className={styles.selection}
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
              }}
              aria-hidden="true"
            />
            <div
              className={styles.playhead}
              style={{ left: `${playheadPercent}%` }}
              aria-hidden="true"
            />

            <button
              type="button"
              role="slider"
              aria-orientation="horizontal"
              aria-label="Inicio del recorte"
              aria-valuemin={0}
              aria-valuemax={Math.max(
                0,
                endSeconds - MIN_SELECTION_SECONDS
              )}
              aria-valuenow={startSeconds}
              aria-valuetext={formatTime(startSeconds)}
              className={`${styles.handle} ${styles.handleStart}`}
              style={{ left: `${startPercent}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(
                  event.pointerId
                );
              }}
              onPointerMove={(event) => {
                if (
                  event.currentTarget.hasPointerCapture(
                    event.pointerId
                  )
                ) {
                  updateStart(positionFromPointer(event));
                }
              }}
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
              aria-label="Final del recorte"
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
              className={`${styles.handle} ${styles.handleEnd}`}
              style={{ left: `${endPercent}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(
                  event.pointerId
                );
              }}
              onPointerMove={(event) => {
                if (
                  event.currentTarget.hasPointerCapture(
                    event.pointerId
                  )
                ) {
                  updateEnd(positionFromPointer(event));
                }
              }}
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
              disabled={!ready}
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
              disabled={!trim || !ready}
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
                  updateStart(Number(event.target.value))
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
                  updateEnd(Number(event.target.value))
                }
              />
            </label>
          </div>

          <p className={styles.help}>
            YouTube se usa sólo para decidir visualmente el corte. DeUna no descarga el video mientras editas. Al confirmar se obtiene únicamente el tramo seleccionado, con un máximo de 30 segundos.
          </p>
        </>
      )}
    </div>
  );
}
