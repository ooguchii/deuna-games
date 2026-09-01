"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DirectPlatformPreviewEditor from "@/components/admin/DirectPlatformPreviewEditor";
import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import YouTubeTrimEditor from "@/components/admin/YouTubeTrimEditor";
import {
  DIRECT_PREVIEW_OPTIONS,
  directPreviewPlatformLabel,
  directPreviewTrim,
  isGameDirectPreviewPlatform,
  parseDirectPlatformVideo,
} from "@/lib/media/direct-platform-preview";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import {
  parseYouTubeVideo,
  youtubePreviewTrim,
} from "@/lib/media/youtube-preview";
import type {
  GameDirectPreview,
  GameDirectPreviewPlatform,
  GamePreviewMode,
  GameYouTubePreview,
} from "@/types/game";

import styles from "../../app/admin/admin.module.css";

const acceptedTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
]);
const acceptedExtensions =
  /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const MEDIA_PROBE_TIMEOUT_MS = 10_000;

type SourceMode =
  | "file"
  | "youtube"
  | GameDirectPreviewPlatform;

type PreparedSource =
  | {
      mode: "file";
      src: string;
      label: string;
      file: File;
    }
  | {
      mode: "staged";
      src: string;
      label: string;
      token: string;
      bytes: number;
      usesProxy: true;
    };

type GamePreviewClipUploadFormProps = {
  slug: string;
  revision: number;
  currentPreview?: string;
  currentPreviewMode?: GamePreviewMode;
  currentYouTubePreview?: GameYouTubePreview;
  currentDirectPreview?: GameDirectPreview;
};

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
};

type PreviewStateResponse = {
  revision?: unknown;
  previewMode?: unknown;
  previewClip?: unknown;
  youtubePreview?: unknown;
  directPreview?: unknown;
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sourceExtension(filename: string) {
  const match = filename.match(/\.[^.]+$/);
  const extension = match?.[0]?.toLowerCase() ?? "";
  return acceptedExtensions.test(extension)
    ? extension
    : ".video";
}

function stagedSourcePath(slug: string, token: string) {
  return `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${token}`;
}

function uploadError(state: string | null) {
  if (state === "conflicto") {
    return "Otra pestaña guardó una revisión más reciente. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "ffmpeg") {
    return "FFmpeg no está disponible en este servidor para crear el WebM optimizado.";
  }
  if (state === "video-pesado") {
    return "El WebM final no pudo quedar por debajo del límite de 3 MB. Elige un tramo con menos movimiento o de menor duración.";
  }
  if (state === "preview-recorte-invalido") {
    return "La URL, la plataforma o el recorte no son válidos. Revisa la selección y vuelve a intentarlo.";
  }
  if (state === "preview-source-expirada") {
    return "La vista previa temporal venció. Vuelve a cargar el video y selecciona el tramo otra vez.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "El archivo no pudo validarse o decodificarse como video compatible.";
  }
  return "No se pudo guardar el preview de la tarjeta.";
}

function validLocalFile(file: File) {
  const extensionOk = acceptedExtensions.test(file.name);

  return !(
    file.size <= 0 ||
    file.size > MAX_PREVIEW_SOURCE_BYTES ||
    (!extensionOk &&
      file.type &&
      !acceptedTypes.has(file.type.toLowerCase()))
  );
}

function isYouTubePreview(
  value: unknown
): value is GameYouTubePreview {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const preview = value as Record<string, unknown>;
  return (
    typeof preview.videoId === "string" &&
    /^[A-Za-z0-9_-]{11}$/.test(preview.videoId) &&
    typeof preview.startSeconds === "number" &&
    typeof preview.endSeconds === "number"
  );
}

function isDirectPreview(
  value: unknown
): value is GameDirectPreview {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const preview = value as Record<string, unknown>;
  return (
    isGameDirectPreviewPlatform(preview.platform) &&
    typeof preview.url === "string" &&
    typeof preview.startSeconds === "number" &&
    typeof preview.endSeconds === "number"
  );
}

function isPreviewMode(value: unknown): value is GamePreviewMode {
  return (
    value === "webm" ||
    value === "youtube" ||
    isGameDirectPreviewPlatform(value)
  );
}

function probeBrowserPlayback(src: string) {
  return new Promise<boolean>((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (playable: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(playable);
    };
    const timeout = window.setTimeout(
      () => finish(false),
      MEDIA_PROBE_TIMEOUT_MS
    );

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener(
      "canplay",
      () => finish(true),
      { once: true }
    );
    video.addEventListener(
      "error",
      () => finish(false),
      { once: true }
    );
    video.src = src;
    video.load();
  });
}

export default function GamePreviewClipUploadFormV2({
  slug,
  revision,
  currentPreview,
  currentPreviewMode,
  currentYouTubePreview,
  currentDirectPreview,
}: GamePreviewClipUploadFormProps) {
  const initialYouTubeUrl = currentYouTubePreview
    ? `https://www.youtube.com/watch?v=${currentYouTubePreview.videoId}`
    : "";
  const initialMode: SourceMode =
    currentPreviewMode === "youtube" && currentYouTubePreview
      ? "youtube"
      : isGameDirectPreviewPlatform(currentPreviewMode) &&
          currentDirectPreview?.platform === currentPreviewMode
        ? currentPreviewMode
        : "file";

  const [savedPreviewMode, setSavedPreviewMode] =
    useState<GamePreviewMode | undefined>(currentPreviewMode);
  const [savedPreview, setSavedPreview] =
    useState<string | undefined>(currentPreview);
  const [savedYouTubePreview, setSavedYouTubePreview] =
    useState<GameYouTubePreview | undefined>(currentYouTubePreview);
  const [savedDirectPreview, setSavedDirectPreview] =
    useState<GameDirectPreview | undefined>(currentDirectPreview);
  const [sourceMode, setSourceMode] =
    useState<SourceMode>(initialMode);
  const [youtubeUrl, setYouTubeUrl] = useState(
    initialMode === "youtube" ? initialYouTubeUrl : ""
  );
  const [directUrl, setDirectUrl] = useState(
    isGameDirectPreviewPlatform(initialMode) &&
      currentDirectPreview?.platform === initialMode
      ? currentDirectPreview.url
      : ""
  );
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] =
    useState<PreviewTrimWindow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedDirectPlatform =
    isGameDirectPreviewPlatform(sourceMode)
      ? sourceMode
      : null;
  const selectedDirectOption = selectedDirectPlatform
    ? DIRECT_PREVIEW_OPTIONS.find(
        (option) => option.platform === selectedDirectPlatform
      )
    : undefined;

  const parsedYouTube = useMemo(
    () => parseYouTubeVideo(youtubeUrl),
    [youtubeUrl]
  );
  const parsedDirect = useMemo(
    () =>
      selectedDirectPlatform
        ? parseDirectPlatformVideo(
            selectedDirectPlatform,
            directUrl
          )
        : null,
    [directUrl, selectedDirectPlatform]
  );
  const savedYouTubeUrl = savedYouTubePreview
    ? `https://www.youtube.com/watch?v=${savedYouTubePreview.videoId}`
    : "";
  const initialYouTubeTrim = useMemo(
    () =>
      savedYouTubePreview &&
      parsedYouTube?.videoId === savedYouTubePreview.videoId
        ? youtubePreviewTrim(savedYouTubePreview)
        : null,
    [savedYouTubePreview, parsedYouTube?.videoId]
  );
  const initialDirectTrim = useMemo(() => {
    if (
      !savedDirectPreview ||
      !parsedDirect ||
      savedDirectPreview.platform !== parsedDirect.platform ||
      savedDirectPreview.url !== parsedDirect.canonicalUrl
    ) {
      return null;
    }

    return directPreviewTrim(savedDirectPreview);
  }, [parsedDirect, savedDirectPreview]);

  const handleTrimChange = useCallback(
    (nextTrim: PreviewTrimWindow | null) => {
      setTrim(nextTrim);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    void fetch(
      `/api/admin/content/games/${encodeURIComponent(slug)}/preview-state`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PreviewStateResponse;
      })
      .then((result) => {
        if (!result || cancelled) return;

        if (
          typeof result.revision === "number" &&
          result.revision !== revision
        ) {
          setStatus(
            "El preview cambió en otra revisión. Recarga esta pantalla antes de volver a guardar."
          );
          return;
        }

        const mode = isPreviewMode(result.previewMode)
          ? result.previewMode
          : undefined;
        const local =
          typeof result.previewClip === "string" &&
          result.previewClip.trim()
            ? result.previewClip
            : undefined;
        const youtube = isYouTubePreview(result.youtubePreview)
          ? result.youtubePreview
          : undefined;
        const direct = isDirectPreview(result.directPreview)
          ? result.directPreview
          : undefined;

        setSavedPreviewMode(mode);
        setSavedPreview(local);
        setSavedYouTubePreview(youtube);
        setSavedDirectPreview(direct);

        if (mode === "youtube" && youtube) {
          setSourceMode("youtube");
          setYouTubeUrl((current) =>
            current.trim()
              ? current
              : `https://www.youtube.com/watch?v=${youtube.videoId}`
          );
        } else if (
          isGameDirectPreviewPlatform(mode) &&
          direct?.platform === mode
        ) {
          setSourceMode(mode);
          setDirectUrl((current) =>
            current.trim() ? current : direct.url
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [revision, slug]);

  useEffect(() => {
    const source = preparedSource;

    return () => {
      if (!source) return;

      if (source.mode === "file") {
        URL.revokeObjectURL(source.src);
        return;
      }

      void fetch(stagedSourcePath(slug, source.token), {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [preparedSource, slug]);

  function resetPreparedSource() {
    setPreparedSource(null);
    setTrim(null);
  }

  function switchSourceMode(mode: SourceMode) {
    resetPreparedSource();
    setSourceMode(mode);
    setStatus(null);

    if (mode === "youtube") {
      setDirectUrl("");
      if (!youtubeUrl.trim() && savedYouTubeUrl) {
        setYouTubeUrl(savedYouTubeUrl);
      }
      return;
    }

    if (isGameDirectPreviewPlatform(mode)) {
      setYouTubeUrl("");
      setDirectUrl(
        savedDirectPreview?.platform === mode
          ? savedDirectPreview.url
          : ""
      );
      return;
    }

    setYouTubeUrl("");
    setDirectUrl("");
  }

  async function prepareLocalCodecFallback(file: File) {
    setStatus(
      `El navegador no puede reproducir directamente este códec. Subiendo ${formatSize(file.size)} por streaming y creando una vista previa de edición liviana…`
    );

    const response = await fetch(
      `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source-upload`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type":
            file.type || "application/octet-stream",
          "X-Deuna-Expected-Revision": String(revision),
          "X-Deuna-Source-Extension":
            sourceExtension(file.name),
        },
        body: file,
      }
    );
    const result =
      (await response.json()) as StagedSourceResponse;

    if (
      !response.ok ||
      typeof result.token !== "string" ||
      typeof result.src !== "string" ||
      typeof result.bytes !== "number"
    ) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "No se pudo preparar una vista previa compatible."
      );
    }

    setPreparedSource({
      mode: "staged",
      src: result.src,
      label:
        `${file.name} · ${formatSize(file.size)} · vista previa compatible`,
      token: result.token,
      bytes: result.bytes,
      usesProxy: true,
    });
    setStatus(
      "Vista previa compatible lista. Puedes recorrer todo el video y elegir IN/OUT; el WebM final se generará desde el archivo original, no desde este proxy."
    );
  }

  async function prepareLocalFile(file: File) {
    setSourceBusy(true);
    setStatus(
      "Comprobando si el navegador puede reproducir el video directamente…"
    );

    const src = URL.createObjectURL(file);
    let keepObjectUrl = false;

    try {
      const playable = await probeBrowserPlayback(src);

      if (playable) {
        keepObjectUrl = true;
        setPreparedSource({
          mode: "file",
          src,
          label: `${file.name} · ${formatSize(file.size)}`,
          file,
        });
        setStatus(
          "Video listo. Reprodúcelo y mueve IN/OUT para elegir exactamente qué fragmento usar. El archivo grande todavía no se subió."
        );
        return;
      }

      await prepareLocalCodecFallback(file);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar el video para recortar."
      );
    } finally {
      if (!keepObjectUrl) {
        URL.revokeObjectURL(src);
      }
      setSourceBusy(false);
    }
  }

  function handleLocalFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    resetPreparedSource();
    setStatus(null);

    if (!file) return;

    if (!validLocalFile(file)) {
      event.target.value = "";
      setStatus(
        "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 1 GB."
      );
      return;
    }

    void prepareLocalFile(file);
  }

  async function saveYouTubePreview() {
    if (!parsedYouTube || !trim) {
      setStatus(
        "Pega un enlace válido de YouTube y selecciona un tramo con IN y OUT."
      );
      return;
    }

    setBusy(true);
    setStatus(
      `Guardando YouTube ${trim.startSeconds}s → ${trim.endSeconds}s. No se descarga ni pasa por yt-dlp…`
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-youtube`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({
            expectedRevision: String(revision),
            youtubeUrl: parsedYouTube.canonicalUrl,
            startSeconds: String(trim.startSeconds),
            endSeconds: String(trim.endSeconds),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "El servidor rechazó el preview directo de YouTube."
        );
      }

      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");

      if (resultState !== "preview-subido") {
        throw new Error(uploadError(resultState));
      }

      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el preview de YouTube."
      );
      setBusy(false);
    }
  }

  async function saveDirectPreview() {
    if (!selectedDirectPlatform || !parsedDirect || !trim) {
      setStatus(
        "Pega una URL válida de la plataforma seleccionada y configura un tramo válido."
      );
      return;
    }

    const label = directPreviewPlatformLabel(selectedDirectPlatform);
    setBusy(true);
    setStatus(
      `Guardando ${label} directo ${trim.startSeconds}s → ${trim.endSeconds}s. No se descarga ni se convierte el video…`
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-direct/${encodeURIComponent(selectedDirectPlatform)}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({
            expectedRevision: String(revision),
            url: parsedDirect.canonicalUrl,
            startSeconds: String(trim.startSeconds),
            endSeconds: String(trim.endSeconds),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `El servidor rechazó el preview directo de ${label}.`
        );
      }

      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");

      if (resultState !== "preview-subido") {
        throw new Error(uploadError(resultState));
      }

      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : `No se pudo guardar el preview de ${label}.`
      );
      setBusy(false);
    }
  }

  async function saveLocalPreview() {
    if (!preparedSource) {
      setStatus(
        "Selecciona primero un archivo para ver el video y elegir el corte."
      );
      return;
    }

    if (!trim) {
      setStatus(
        "Selecciona un tramo válido con los marcadores IN y OUT."
      );
      return;
    }

    let endpoint: string;
    let body: BodyInit;
    let headers: HeadersInit;

    if (preparedSource.mode === "file") {
      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`;
      body = preparedSource.file;
      headers = {
        "Content-Type":
          preparedSource.file.type || "application/octet-stream",
        "X-Deuna-Expected-Revision": String(revision),
        "X-Deuna-Trim-Start": String(trim.startSeconds),
        "X-Deuna-Trim-End": String(trim.endSeconds),
        "X-Deuna-Source-Extension":
          sourceExtension(preparedSource.file.name),
      };
      setStatus(
        `Subiendo ${formatSize(preparedSource.file.size)} por streaming y preparando sólo ${trim.durationSeconds.toFixed(1)} s del recorte…`
      );
    } else {
      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
      body = new URLSearchParams({
        expectedRevision: String(revision),
        sourceToken: preparedSource.token,
        startSeconds: String(trim.startSeconds),
        endSeconds: String(trim.endSeconds),
      });
      headers = {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
      };
      setStatus(
        `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s desde el original y generando el WebM/VP9 optimizado…`
      );
    }

    setBusy(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(
          response.status === 413
            ? "El video supera el límite máximo de 1 GB."
            : "El servidor rechazó la preparación del preview."
        );
      }

      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");

      if (resultState !== "preview-subido") {
        throw new Error(uploadError(resultState));
      }

      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar el preview."
      );
      setBusy(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy || sourceBusy) return;

    if (sourceMode === "youtube") {
      await saveYouTubePreview();
      return;
    }

    if (isGameDirectPreviewPlatform(sourceMode)) {
      await saveDirectPreview();
      return;
    }

    await saveLocalPreview();
  }

  const activePreviewLabel =
    savedPreviewMode === "youtube" && savedYouTubePreview
      ? `YouTube · ${savedYouTubePreview.startSeconds}s → ${savedYouTubePreview.endSeconds}s`
      : isGameDirectPreviewPlatform(savedPreviewMode) &&
          savedDirectPreview?.platform === savedPreviewMode
        ? `${directPreviewPlatformLabel(savedPreviewMode)} · ${savedDirectPreview.startSeconds}s → ${savedDirectPreview.endSeconds}s`
        : savedPreview
          ? "WebM local"
          : "Sin preview configurado";

  const directMode = isGameDirectPreviewPlatform(sourceMode);
  const directLabel = directMode
    ? directPreviewPlatformLabel(sourceMode)
    : "";

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video y recorte</h2>
        </div>
        <p>
          Cada origen está aislado. El archivo local usa WebM; YouTube, Facebook, Instagram, TikTok, Vimeo, X, Twitch, Dailymotion, Streamable y Kick tienen una selección propia y nunca pasan por un detector universal.
        </p>
      </div>

      <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
        <strong>Preview activo</strong>
        <span>{activePreviewLabel}</span>
      </div>

      {savedPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>WebM local disponible</strong>
          <span>{savedPreview}</span>
          <video
            src={savedPreview}
            controls
            muted
            playsInline
            preload="metadata"
            style={{
              width: "min(480px, 100%)",
              marginTop: 12,
              borderRadius: 10,
              background: "#05080d",
            }}
          />
        </div>
      )}

      {savedYouTubePreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>YouTube guardado</strong>
          <span>
            https://www.youtube.com/watch?v={savedYouTubePreview.videoId} · {savedYouTubePreview.startSeconds}s → {savedYouTubePreview.endSeconds}s
          </span>
        </div>
      )}

      {savedDirectPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>
            {directPreviewPlatformLabel(savedDirectPreview.platform)} guardado
          </strong>
          <span>
            {savedDirectPreview.url} · {savedDirectPreview.startSeconds}s → {savedDirectPreview.endSeconds}s
          </span>
        </div>
      )}

      <form
        className={styles.editorForm}
        onSubmit={handleSubmit}
      >
        <label>
          <span>Origen del video</span>
          <select
            value={sourceMode}
            disabled={busy || sourceBusy}
            onChange={(event) =>
              switchSourceMode(event.target.value as SourceMode)
            }
          >
            <option value="file">Archivo de mi equipo</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="vimeo">Vimeo</option>
            <option value="x">X / Twitter</option>
            <option value="twitch">Twitch</option>
            <option value="dailymotion">Dailymotion</option>
            <option value="streamable">Streamable</option>
            <option value="kick">Kick</option>
          </select>
        </label>

        {sourceMode === "file" && (
          <label className={styles.fieldWide}>
            <span>Archivo de video · máximo 1 GB</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi"
              disabled={busy || sourceBusy}
              onChange={handleLocalFile}
            />
            <small>
              Si el navegador reproduce el códec, editas directamente desde tu equipo. Si no, DeUna crea una vista previa privada compatible; el WebM final siempre se recorta desde el archivo original.
            </small>
          </label>
        )}

        {sourceMode === "youtube" && (
          <>
            <label className={styles.fieldWide}>
              <span>URL de YouTube</span>
              <input
                type="text"
                inputMode="url"
                value={youtubeUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  setYouTubeUrl(event.target.value);
                  setTrim(null);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="youtube.com/watch?v=... · youtu.be/... · Shorts · Live"
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Sólo YouTube. Usa su reproductor directo ya probado; no pasa por yt-dlp, staging ni FFmpeg.
              </small>
            </label>

            {parsedYouTube ? (
              <div className={styles.fieldWide}>
                <YouTubeTrimEditor
                  key={parsedYouTube.videoId}
                  videoId={parsedYouTube.videoId}
                  sourceLabel={parsedYouTube.canonicalUrl}
                  initialTrim={initialYouTubeTrim}
                  onTrimChange={handleTrimChange}
                />
              </div>
            ) : youtubeUrl.trim() ? (
              <div
                className={`${styles.tableSummary} ${styles.fieldWide}`}
                role="status"
              >
                <strong>YouTube</strong>
                <span>
                  No pude reconocer un video de YouTube en ese valor.
                </span>
              </div>
            ) : null}
          </>
        )}

        {directMode && selectedDirectPlatform && (
          <>
            <label className={styles.fieldWide}>
              <span>URL de {directLabel}</span>
              <input
                type="text"
                inputMode="url"
                value={directUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  setDirectUrl(event.target.value);
                  setTrim(null);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder={selectedDirectOption?.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Sólo {directLabel}. Esta selección usa exclusivamente el adaptador directo de {directLabel}; una URL de otra red se rechaza y nunca se deriva al importador genérico.
              </small>
            </label>

            {parsedDirect ? (
              <div className={styles.fieldWide}>
                <DirectPlatformPreviewEditor
                  key={`${parsedDirect.platform}-${parsedDirect.resourceId}`}
                  parsed={parsedDirect}
                  initialTrim={initialDirectTrim}
                  onTrimChange={handleTrimChange}
                />
              </div>
            ) : directUrl.trim() ? (
              <div
                className={`${styles.tableSummary} ${styles.fieldWide}`}
                role="status"
              >
                <strong>{directLabel}</strong>
                <span>
                  Esa URL no coincide con un formato directo reconocido de {directLabel}. Revisa que sea un enlace público de esa red.
                </span>
              </div>
            ) : null}
          </>
        )}

        {sourceMode === "file" && preparedSource && (
          <div className={styles.fieldWide}>
            <VideoTrimEditor
              key={preparedSource.src}
              src={preparedSource.src}
              sourceLabel={preparedSource.label}
              onTrimChange={handleTrimChange}
            />
          </div>
        )}

        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Resultado final</strong>
          <span>
            {sourceMode === "file"
              ? "El archivo puede pesar hasta 1 GB, pero sólo el fragmento elegido —máximo 30 segundos— se convierte desde el original a WebM/VP9 silencioso y liviano."
              : sourceMode === "youtube"
                ? "YouTube guarda únicamente el ID y el tramo IN/OUT de hasta 30 segundos. No se descarga ni convierte el video."
                : `${directLabel} guarda la URL pública y un tramo máximo de 30 segundos. El reproductor se carga directamente desde ${directLabel}; no se descarga ni convierte el video.`}
          </span>
        </div>

        {status && (
          <div
            className={`${styles.tableSummary} ${styles.fieldWide}`}
            role="status"
            aria-live="polite"
          >
            <strong>Estado</strong>
            <span>{status}</span>
          </div>
        )}

        <div className={styles.formActions}>
          <p>
            {sourceMode === "file"
              ? "La portada carga primero. El WebM se solicita sólo después del hover."
              : "La portada carga primero. El reproductor externo se crea sólo después de intención real de hover y se reutiliza entre tarjetas."}
          </p>
          <button
            type="submit"
            disabled={
              busy ||
              sourceBusy ||
              !trim ||
              (sourceMode === "file" && !preparedSource) ||
              (sourceMode === "youtube" && !parsedYouTube) ||
              (directMode && !parsedDirect)
            }
          >
            {busy
              ? sourceMode === "file"
                ? "Subiendo, recortando y convirtiendo…"
                : "Guardando preview directo…"
              : sourceMode === "file"
                ? "Crear preview WebM con este recorte"
                : sourceMode === "youtube"
                  ? "Usar este recorte de YouTube"
                  : `Usar este preview de ${directLabel}`}
          </button>
        </div>
      </form>

      {(savedPreview || savedYouTubePreview || savedDirectPreview) && (
        <form
          method="post"
          action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`}
          className={styles.formActions}
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={revision}
          />
          <p>
            Elimina el preview activo y las alternativas de video guardadas para esta tarjeta.
          </p>
          <button type="submit">Quitar preview</button>
        </form>
      )}
    </section>
  );
}
