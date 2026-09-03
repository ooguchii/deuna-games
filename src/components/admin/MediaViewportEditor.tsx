"use client";

import Image from "next/image";
import {
  Move,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";
import {
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_VIEWPORT_ZOOM,
  MIN_PREVIEW_VIEWPORT_ZOOM,
  PREVIEW_VIEWPORT_ASPECT_OPTIONS,
  parsePreviewViewport,
  resolvePreviewViewportCrop,
  type PreviewViewport,
  type ResolvedPreviewViewportCrop,
} from "@/lib/media/preview-video-policy";

import styles from "./VideoTrimEditor.module.css";

const VIEWPORT_KEYBOARD_STEP = 0.02;
const VIEWPORT_KEYBOARD_LARGE_STEP = 0.1;
const RESULT_PREVIEW_MAX_WIDTH = 320;
const RESULT_PREVIEW_MAX_HEIGHT = 220;

type MediaKind = "image" | "video";

type MediaBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PreviewSize = {
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

type Props = {
  kind: MediaKind;
  src: string;
  sourceLabel: string;
  viewport: PreviewViewport;
  requiredAspect: PreviewViewport["aspect"];
  disabled?: boolean;
  onViewportChange: (viewport: PreviewViewport) => void;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundViewport(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeLockedViewport(
  viewport: PreviewViewport,
  requiredAspect: PreviewViewport["aspect"]
) {
  return parsePreviewViewport(
    String(viewport.x),
    String(viewport.y),
    String(viewport.zoom),
    requiredAspect
  ) ?? {
    ...DEFAULT_PREVIEW_VIEWPORT,
    aspect: requiredAspect,
  };
}

function aspectLabel(aspect: PreviewViewport["aspect"]) {
  return PREVIEW_VIEWPORT_ASPECT_OPTIONS.find(
    (option) => option.id === aspect
  )?.label ?? aspect;
}

function resolveResultPreviewSize(
  crop: ResolvedPreviewViewportCrop | null
): PreviewSize | null {
  if (!crop || crop.width <= 0 || crop.height <= 0) return null;

  const ratio = crop.width / crop.height;
  let width = RESULT_PREVIEW_MAX_WIDTH;
  let height = width / ratio;

  if (height > RESULT_PREVIEW_MAX_HEIGHT) {
    height = RESULT_PREVIEW_MAX_HEIGHT;
    width = height * ratio;
  }

  return {
    width: Math.max(2, Math.round(width)),
    height: Math.max(2, Math.round(height)),
  };
}

export default function MediaViewportEditor({
  kind,
  src,
  sourceLabel,
  viewport,
  requiredAspect,
  disabled = false,
  onViewportChange,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportDragFrameRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<PreviewViewport | null>(null);
  const viewportDragRef = useRef<ViewportDrag | null>(null);

  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [mediaBox, setMediaBox] = useState<MediaBox | null>(null);
  const [viewportDraft, setViewportDraft] = useState<PreviewViewport>(() =>
    normalizeLockedViewport(viewport, requiredAspect)
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [frameRevision, setFrameRevision] = useState(0);

  const sourceCrop = useMemo(
    () =>
      resolvePreviewViewportCrop(
        sourceWidth,
        sourceHeight,
        viewportDraft
      ),
    [sourceHeight, sourceWidth, viewportDraft]
  );

  const resultPreviewSize = useMemo(
    () => resolveResultPreviewSize(sourceCrop),
    [sourceCrop]
  );

  const viewportRect = useMemo(() => {
    if (
      !sourceCrop ||
      !mediaBox ||
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      return null;
    }

    return {
      left:
        mediaBox.left +
        (sourceCrop.x / sourceWidth) * mediaBox.width,
      top:
        mediaBox.top +
        (sourceCrop.y / sourceHeight) * mediaBox.height,
      width:
        (sourceCrop.width / sourceWidth) * mediaBox.width,
      height:
        (sourceCrop.height / sourceHeight) * mediaBox.height,
    };
  }, [mediaBox, sourceCrop, sourceHeight, sourceWidth]);

  useEffect(() => {
    const stage = stageRef.current;
    const media =
      kind === "image" ? imageRef.current : videoRef.current;

    if (
      !stage ||
      !media ||
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      return;
    }

    const syncMediaBox = () => {
      const stageRect = stage.getBoundingClientRect();
      const mediaRect = media.getBoundingClientRect();

      if (
        stageRect.width <= 0 ||
        stageRect.height <= 0 ||
        mediaRect.width <= 0 ||
        mediaRect.height <= 0
      ) {
        return;
      }

      const sourceRatio = sourceWidth / sourceHeight;
      const mediaRatio = mediaRect.width / mediaRect.height;
      let width = mediaRect.width;
      let height = mediaRect.height;

      if (mediaRatio > sourceRatio) {
        width = mediaRect.height * sourceRatio;
      } else if (mediaRatio < sourceRatio) {
        height = mediaRect.width / sourceRatio;
      }

      const containingBlockLeft = stageRect.left + stage.clientLeft;
      const containingBlockTop = stageRect.top + stage.clientTop;

      setMediaBox({
        left:
          mediaRect.left -
          containingBlockLeft +
          (mediaRect.width - width) / 2,
        top:
          mediaRect.top -
          containingBlockTop +
          (mediaRect.height - height) / 2,
        width,
        height,
      });
    };

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncMediaBox);

    observer?.observe(stage);
    observer?.observe(media);
    syncMediaBox();

    return () => observer?.disconnect();
  }, [kind, sourceHeight, sourceWidth]);

  useEffect(() => {
    return () => {
      if (viewportDragFrameRef.current !== null) {
        cancelAnimationFrame(viewportDragFrameRef.current);
      }
      pendingViewportRef.current = null;
      viewportDragRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (kind !== "video") return;

    const canvas = resultCanvasRef.current;
    if (!canvas || !sourceCrop || !resultPreviewSize) return;

    const frame = requestAnimationFrame(() => {
      canvas.width = resultPreviewSize.width;
      canvas.height = resultPreviewSize.height;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

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
  }, [
    currentTime,
    frameRevision,
    kind,
    resultPreviewSize,
    sourceCrop,
  ]);

  function commitViewport(next: PreviewViewport) {
    const normalized = normalizeLockedViewport(
      next,
      requiredAspect
    );
    setViewportDraft(normalized);
    onViewportChange(normalized);
  }

  function scheduleViewportDraft(next: PreviewViewport) {
    pendingViewportRef.current = normalizeLockedViewport(
      next,
      requiredAspect
    );
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
      x:
        drag.travelX <= 0
          ? 0.5
          : roundViewport(
              clamp(
                drag.startX +
                  (event.clientX - drag.startClientX) /
                    drag.travelX,
                0,
                1
              )
            ),
      y:
        drag.travelY <= 0
          ? 0.5
          : roundViewport(
              clamp(
                drag.startY +
                  (event.clientY - drag.startClientY) /
                    drag.travelY,
                0,
                1
              )
            ),
    };
  }

  function startViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (!mediaBox || !viewportRect || disabled) return;

    event.stopPropagation();
    videoRef.current?.pause();
    viewportDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: viewportDraft.x,
      startY: viewportDraft.y,
      travelX: Math.max(
        0,
        mediaBox.width - viewportRect.width
      ),
      travelY: Math.max(
        0,
        mediaBox.height - viewportRect.height
      ),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

    const next = viewportFromPointer(event);
    if (next) scheduleViewportDraft(next);
  }

  function finishViewportDrag(
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

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

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleViewportKey(
    event: KeyboardEvent<HTMLButtonElement>
  ) {
    const horizontal =
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight";
    const vertical =
      event.key === "ArrowUp" ||
      event.key === "ArrowDown";
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

  function quickViewport(
    side: "left" | "center" | "right"
  ) {
    const x =
      side === "left" ? 0 : side === "right" ? 1 : 0.5;
    const y = side === "center" ? 0.5 : viewportDraft.y;

    commitViewport({
      ...viewportDraft,
      x,
      y,
    });
  }

  function resetViewport() {
    commitViewport({
      ...DEFAULT_PREVIEW_VIEWPORT,
      aspect: requiredAspect,
    });
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function requestPreviewRedraw() {
    setFrameRevision((value) => value + 1);
  }

  const lockedAspectLabel = aspectLabel(requiredAspect);

  return (
    <div className={styles.editor}>
      <div className={styles.previewWorkspace}>
        <div
          ref={stageRef}
          className={styles.previewStage}
          style={{ minHeight: "clamp(360px, 52vh, 560px)" }}
        >
          {kind === "image" ? (
            <Image
              ref={imageRef}
              src={src}
              alt=""
              fill
              sizes="(max-width: 900px) 94vw, 980px"
              draggable={false}
              style={{ objectFit: "contain" }}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (
                  image.naturalWidth <= 0 ||
                  image.naturalHeight <= 0
                ) {
                  setMediaError(
                    "La imagen no informa dimensiones válidas para editar."
                  );
                  return;
                }

                setSourceWidth(image.naturalWidth);
                setSourceHeight(image.naturalHeight);
                setMediaError(null);
              }}
              onError={() =>
                setMediaError(
                  "No se pudo cargar esta imagen para seleccionar el encuadre."
                )
              }
            />
          ) : (
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
                if (
                  video.videoWidth <= 0 ||
                  video.videoHeight <= 0
                ) {
                  setMediaError(
                    "El video no informa dimensiones válidas para editar."
                  );
                  return;
                }

                setSourceWidth(video.videoWidth);
                setSourceHeight(video.videoHeight);
                setDuration(
                  Number.isFinite(video.duration)
                    ? video.duration
                    : 0
                );
                setCurrentTime(video.currentTime || 0);
                setMediaError(null);
              }}
              onLoadedData={requestPreviewRedraw}
              onSeeked={requestPreviewRedraw}
              onTimeUpdate={(event) =>
                setCurrentTime(event.currentTarget.currentTime)
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() =>
                setMediaError(
                  "No se pudo reproducir este video para seleccionar el encuadre."
                )
              }
            />
          )}

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
                <span
                  className={`${styles.viewportCorner} ${styles.viewportCornerTopLeft}`}
                />
                <span
                  className={`${styles.viewportCorner} ${styles.viewportCornerTopRight}`}
                />
                <span
                  className={`${styles.viewportCorner} ${styles.viewportCornerBottomLeft}`}
                />
                <span
                  className={`${styles.viewportCorner} ${styles.viewportCornerBottomRight}`}
                />
              </div>

              <button
                type="button"
                className={styles.viewportMoveHandle}
                style={{
                  left:
                    viewportRect.left +
                    viewportRect.width / 2,
                  top:
                    viewportRect.top +
                    viewportRect.height / 2,
                }}
                disabled={disabled}
                aria-label={`Mover el área visible de ${
                  kind === "image" ? "la imagen" : "el video"
                }`}
                title="Arrastra para elegir qué zona será visible"
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

          {kind === "video" && (
            <button
              type="button"
              className={`${styles.centerPlay} ${
                viewportRect ? styles.centerPlayViewport : ""
              }`}
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
          )}
        </div>

        <aside
          className={styles.viewportPanel}
          aria-label="Área visible del recurso"
        >
          <div className={styles.viewportPanelHeading}>
            <div>
              <span>ENCUADRE · {requiredAspect}</span>
              <strong>Elige qué parte se verá</strong>
            </div>
            <small>
              El archivo físico permanece intacto. Cada destino
              guarda únicamente posición, zoom y su relación
              obligatoria.
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
                disabled={disabled}
                onChange={(event) =>
                  commitViewport({
                    ...viewportDraft,
                    x: clamp(
                      Number(event.target.value) / 100,
                      0,
                      1
                    ),
                  })
                }
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
                disabled={disabled}
                onChange={(event) =>
                  commitViewport({
                    ...viewportDraft,
                    y: clamp(
                      Number(event.target.value) / 100,
                      0,
                      1
                    ),
                  })
                }
              />
            </label>
          </div>

          <label className={styles.viewportControl}>
            <span>
              Zoom
              <strong>
                {Math.round(viewportDraft.zoom * 100)}%
              </strong>
            </span>
            <input
              type="range"
              min={MIN_PREVIEW_VIEWPORT_ZOOM * 100}
              max={MAX_PREVIEW_VIEWPORT_ZOOM * 100}
              step="5"
              value={Math.round(viewportDraft.zoom * 100)}
              disabled={disabled}
              onChange={(event) =>
                commitViewport({
                  ...viewportDraft,
                  zoom: Number(event.target.value) / 100,
                })
              }
            />
          </label>

          <label className={styles.viewportControl}>
            <span>Relación del encuadre · obligatoria</span>
            <select
              value={requiredAspect}
              disabled
              aria-label={`Relación obligatoria ${requiredAspect}`}
            >
              <option value={requiredAspect}>
                {lockedAspectLabel}
              </option>
            </select>
          </label>

          <div
            className={styles.viewportPresets}
            aria-label="Posiciones rápidas de encuadre"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => quickViewport("left")}
            >
              Izquierda
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => quickViewport("center")}
            >
              Centro
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => quickViewport("right")}
            >
              Derecha
            </button>
          </div>

          <button
            type="button"
            className={styles.viewportReset}
            disabled={disabled}
            onClick={resetViewport}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Restablecer encuadre
          </button>

          <div className={styles.viewportResult}>
            <span>
              Resultado final · {kind === "image"
                ? "imagen"
                : "fotograma actual"}
            </span>
            <div>
              {kind === "image" && resultPreviewSize ? (
                <div
                  style={{
                    position: "relative",
                    flex: "none",
                    width: resultPreviewSize.width,
                    height: resultPreviewSize.height,
                    maxWidth: "100%",
                    overflow: "hidden",
                    borderRadius: 7,
                    background: "#000",
                  }}
                  role="img"
                  aria-label="Vista previa exacta del área visible elegida"
                >
                  <GameMedia
                    src={src}
                    alt=""
                    sizes="320px"
                    viewport={{
                      x: viewportDraft.x,
                      y: viewportDraft.y,
                      zoom: viewportDraft.zoom,
                    }}
                  />
                </div>
              ) : (
                <canvas
                  ref={resultCanvasRef}
                  role="img"
                  aria-label="Vista previa del área visible elegida"
                >
                  Vista previa del encuadre seleccionado.
                </canvas>
              )}
            </div>
            <small>
              {kind === "image"
                ? "Esta previsualización usa exactamente el mismo renderer de imagen que la web pública. Marco, resultado y publicación comparten posición y zoom."
                : "El fotograma usa la misma ventana matemática que se guardará para este destino. Los presets cambian sólo la posición; el zoom permanece bajo tu control."}
            </small>
          </div>
        </aside>
      </div>

      <div className={styles.sourceRow}>
        <span>{sourceLabel}</span>
        <strong>
          {sourceWidth > 0 && sourceHeight > 0
            ? kind === "image"
              ? `${sourceWidth}×${sourceHeight} · ${requiredAspect}`
              : `${Math.round(currentTime * 10) / 10}s / ${
                  Math.round(duration * 10) / 10
                }s · ${requiredAspect}`
            : "Cargando recurso…"}
        </strong>
      </div>

      {mediaError ? (
        <div className={styles.error} role="alert">
          {mediaError}
        </div>
      ) : (
        <p className={styles.help}>
          Modo de encuadre: sólo se guarda metadata visual. No se
          crea otra imagen, no se recodifica el WebM y no se
          modifica el archivo original.
        </p>
      )}
    </div>
  );
}
