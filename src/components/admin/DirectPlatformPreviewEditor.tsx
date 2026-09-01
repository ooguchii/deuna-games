"use client";

import {
  Play,
  RotateCcw,
  Scissors,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  buildDirectPlatformEmbedUrl,
  directPreviewPlatformLabel,
  type ParsedDirectPlatformVideo,
} from "@/lib/media/direct-platform-preview";
import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import type { GameDirectPreview } from "@/types/game";

import styles from "./VideoTrimEditor.module.css";

const MIN_SELECTION_SECONDS = 0.1;
const subscribeBrowserLocation = () => () => undefined;

function browserHostnameSnapshot() {
  return window.location.hostname || "localhost";
}

function serverHostnameSnapshot() {
  return "localhost";
}

type DirectPlatformPreviewEditorProps = {
  parsed: ParsedDirectPlatformVideo;
  initialTrim?: PreviewTrimWindow | null;
  onTrimChange: (
    trim: PreviewTrimWindow | null
  ) => void;
};

function roundSeconds(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

export default function DirectPlatformPreviewEditor({
  parsed,
  initialTrim,
  onTrimChange,
}: DirectPlatformPreviewEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const parentHostname = useSyncExternalStore(
    subscribeBrowserLocation,
    browserHostnameSnapshot,
    serverHostnameSnapshot
  );
  const [startSeconds, setStartSeconds] = useState(
    parsed.supportsStartOffset
      ? initialTrim?.startSeconds ?? 0
      : 0
  );
  const [endSeconds, setEndSeconds] = useState(
    initialTrim?.endSeconds ?? MAX_PREVIEW_DURATION_SECONDS
  );
  const [previewing, setPreviewing] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  const trim = useMemo(() => {
    const parsedTrim = parsePreviewTrimWindow(
      String(startSeconds),
      String(endSeconds)
    );

    if (
      !parsedTrim ||
      (!parsed.supportsStartOffset &&
        parsedTrim.startSeconds !== 0)
    ) {
      return null;
    }

    return parsedTrim;
  }, [
    endSeconds,
    parsed.supportsStartOffset,
    startSeconds,
  ]);

  useEffect(() => {
    onTrimChange(trim);
  }, [onTrimChange, trim]);

  useEffect(() => {
    if (!previewing || !trim) return;

    const timer = window.setTimeout(() => {
      setPreviewing(false);
    }, Math.max(100, trim.durationSeconds * 1_000));

    return () => window.clearTimeout(timer);
  }, [previewNonce, previewing, trim]);

  const preview: GameDirectPreview = {
    platform: parsed.platform,
    url: parsed.canonicalUrl,
    startSeconds: trim?.startSeconds ?? 0,
    endSeconds:
      trim?.endSeconds ?? MAX_PREVIEW_DURATION_SECONDS,
  };

  const embedSrc = buildDirectPlatformEmbedUrl(
    preview,
    {
      autoplay: previewing,
      muted: true,
      parentHostname,
    }
  );

  function normalizeStart(value: number) {
    if (!parsed.supportsStartOffset) return 0;

    const maximum = Math.max(
      0,
      Math.min(
        MAX_PREVIEW_SOURCE_POSITION_SECONDS,
        endSeconds - MIN_SELECTION_SECONDS
      )
    );

    return roundSeconds(
      Math.min(Math.max(value, 0), maximum)
    );
  }

  function normalizeEnd(value: number, start: number) {
    const minimum = start + MIN_SELECTION_SECONDS;
    const maximum = Math.min(
      MAX_PREVIEW_SOURCE_POSITION_SECONDS,
      start + MAX_PREVIEW_DURATION_SECONDS
    );

    return roundSeconds(
      Math.min(Math.max(value, minimum), maximum)
    );
  }

  function updateStart(raw: number) {
    const nextStart = normalizeStart(raw);
    const nextEnd = normalizeEnd(endSeconds, nextStart);
    setStartSeconds(nextStart);
    setEndSeconds(nextEnd);
    setPreviewing(false);
  }

  function updateEnd(raw: number) {
    setEndSeconds(normalizeEnd(raw, startSeconds));
    setPreviewing(false);
  }

  function testSelection() {
    if (!trim || !embedSrc) return;
    setPreviewNonce((value) => value + 1);
    setPreviewing(true);
  }

  function resetSelection() {
    setStartSeconds(0);
    setEndSeconds(MAX_PREVIEW_DURATION_SECONDS);
    setPreviewing(false);
  }

  function handleEmbedLoad() {
    if (
      !previewing ||
      parsed.platform !== "tiktok" ||
      !trim
    ) {
      return;
    }

    const target = iframeRef.current?.contentWindow;
    if (!target) return;

    window.setTimeout(() => {
      target.postMessage(
        {
          type: "seekTo",
          value: trim.startSeconds,
          "x-tiktok-player": true,
        },
        "https://www.tiktok.com"
      );
      target.postMessage(
        {
          type: "mute",
          "x-tiktok-player": true,
        },
        "https://www.tiktok.com"
      );
      target.postMessage(
        {
          type: "play",
          "x-tiktok-player": true,
        },
        "https://www.tiktok.com"
      );
    }, 300);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.previewStage}>
        {embedSrc ? (
          <iframe
            key={`${parsed.platform}-${parsed.resourceId}-${previewNonce}-${previewing ? "play" : "idle"}`}
            ref={iframeRef}
            src={embedSrc}
            title={`Vista previa directa de ${parsed.label}`}
            loading="lazy"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleEmbedLoad}
          />
        ) : (
          <div className={styles.error}>
            No se pudo construir el reproductor oficial de esta plataforma.
          </div>
        )}
      </div>

      <div className={styles.sourceRow}>
        <span>{parsed.canonicalUrl}</span>
        <strong>
          {directPreviewPlatformLabel(parsed.platform)} · {parsed.resourceKind}
        </strong>
      </div>

      <div className={styles.trimSummary}>
        <div>
          <span>IN</span>
          <strong>{startSeconds.toFixed(1)} s</strong>
        </div>
        <div className={styles.selectionDuration}>
          <Scissors size={15} aria-hidden="true" />
          <strong>
            {trim
              ? `${trim.durationSeconds.toFixed(1)} s`
              : "Tramo inválido"}
          </strong>
        </div>
        <div>
          <span>OUT</span>
          <strong>{endSeconds.toFixed(1)} s</strong>
        </div>
      </div>

      <div className={styles.numericControls}>
        <label>
          <span>
            IN · segundos
            {!parsed.supportsStartOffset
              ? " · fijo por esta plataforma"
              : ""}
          </span>
          <input
            type="number"
            min={0}
            max={MAX_PREVIEW_SOURCE_POSITION_SECONDS}
            step={0.1}
            value={startSeconds}
            disabled={!parsed.supportsStartOffset}
            onChange={(event) =>
              updateStart(Number(event.target.value))
            }
          />
        </label>

        <label>
          <span>OUT · máximo 30 s desde IN</span>
          <input
            type="number"
            min={MIN_SELECTION_SECONDS}
            max={MAX_PREVIEW_SOURCE_POSITION_SECONDS}
            step={0.1}
            value={endSeconds}
            onChange={(event) =>
              updateEnd(Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          disabled={!trim || !embedSrc}
          onClick={testSelection}
        >
          <Play size={15} aria-hidden="true" />
          Probar recorte
        </button>
        <button
          type="button"
          onClick={resetSelection}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Volver a 0–30 s
        </button>
      </div>

      <p className={styles.help}>
        {parsed.supportsStartOffset
          ? "Esta plataforma permite arrancar el reproductor directamente en el IN elegido. DeUna corta visualmente la prueba al llegar a OUT; no descarga ni convierte el video."
          : "Esta plataforma no expone un seek directo estable para embeds. Por eso IN queda fijado en 0 y puedes elegir hasta 30 segundos de preview desde el inicio. DeUna corta visualmente la prueba al llegar a OUT."}
      </p>
    </div>
  );
}
