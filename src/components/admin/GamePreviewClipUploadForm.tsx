"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import YouTubeTrimEditor from "@/components/admin/YouTubeTrimEditor";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import {
  parseYouTubeVideo,
  youtubePreviewTrim,
} from "@/lib/media/youtube-preview";
import type {
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

type SourceMode = "file" | "url" | "youtube";

type PreparedSource =
  | {
      mode: "file";
      src: string;
      label: string;
      file: File;
    }
  | {
      mode: "url";
      src: string;
      label: string;
      token: string;
      bytes: number;
    };

type GamePreviewClipUploadFormProps = {
  slug: string;
  revision: number;
  currentPreview?: string;
  currentPreviewMode?: GamePreviewMode;
  currentYouTubePreview?: GameYouTubePreview;
};

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
};

type PreviewStateResponse = {
  previewMode?: unknown;
  previewClip?: unknown;
  youtubePreview?: unknown;
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
    return "El video o el recorte no son válidos. Ajusta IN y OUT y vuelve a intentarlo.";
  }
  if (state === "preview-source-expirada") {
    return "La vista previa remota venció. Vuelve a cargar la URL y selecciona el tramo otra vez.";
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

function parsePublicHttpsUrl(value: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    (parsedUrl.port && parsedUrl.port !== "443") ||
    parsedUrl.toString().length > 2_048
  ) {
    return null;
  }

  return parsedUrl;
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

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
  currentPreviewMode,
  currentYouTubePreview,
}: GamePreviewClipUploadFormProps) {
  const initialYouTubeUrl = currentYouTubePreview
    ? `https://www.youtube.com/watch?v=${currentYouTubePreview.videoId}`
    : "";
  const [savedPreviewMode, setSavedPreviewMode] =
    useState<GamePreviewMode | undefined>(
      currentPreviewMode
    );
  const [savedPreview, setSavedPreview] =
    useState<string | undefined>(currentPreview);
  const [savedYouTubePreview, setSavedYouTubePreview] =
    useState<GameYouTubePreview | undefined>(
      currentYouTubePreview
    );
  const [sourceMode, setSourceMode] =
    useState<SourceMode>(
      currentPreviewMode === "youtube" && currentYouTubePreview
        ? "youtube"
        : "file"
    );
  const [sourceUrl, setSourceUrl] = useState(
    currentPreviewMode === "youtube"
      ? initialYouTubeUrl
      : ""
  );
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] =
    useState<PreviewTrimWindow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const parsedYouTube = useMemo(
    () => parseYouTubeVideo(sourceUrl),
    [sourceUrl]
  );
  const savedYouTubeUrl = savedYouTubePreview
    ? `https://www.youtube.com/watch?v=${savedYouTubePreview.videoId}`
    : "";
  const savedYouTubeTrim = useMemo(
    () =>
      savedYouTubePreview &&
      parsedYouTube?.videoId === savedYouTubePreview.videoId
        ? youtubePreviewTrim(savedYouTubePreview)
        : null,
    [savedYouTubePreview, parsedYouTube?.videoId]
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

        const mode =
          result.previewMode === "youtube" ||
          result.previewMode === "webm"
            ? result.previewMode
            : undefined;
        const local =
          typeof result.previewClip === "string" &&
          result.previewClip.trim()
            ? result.previewClip
            : undefined;
        const youtube = isYouTubePreview(
          result.youtubePreview
        )
          ? result.youtubePreview
          : undefined;

        setSavedPreviewMode(mode);
        setSavedPreview(local);
        setSavedYouTubePreview(youtube);

        if (mode === "youtube" && youtube) {
          setSourceMode((current) =>
            current === "file" ? "youtube" : current
          );
          setSourceUrl((current) =>
            current.trim()
              ? current
              : `https://www.youtube.com/watch?v=${youtube.videoId}`
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const source = preparedSource;

    return () => {
      if (!source) return;

      if (source.mode === "file") {
        URL.revokeObjectURL(source.src);
        return;
      }

      void fetch(source.src, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [preparedSource]);

  const handleTrimChange = useCallback(
    (nextTrim: PreviewTrimWindow | null) => {
      setTrim(nextTrim);
    },
    []
  );

  function resetPreparedSource() {
    setPreparedSource(null);
    setTrim(null);
  }

  function switchSourceMode(mode: SourceMode) {
    resetPreparedSource();
    setSourceMode(mode);
    setStatus(null);

    if (
      mode === "youtube" &&
      !sourceUrl.trim() &&
      savedYouTubeUrl
    ) {
      setSourceUrl(savedYouTubeUrl);
    }
  }

  function detectYouTubeOrKeepUrl(value: string) {
    setSourceUrl(value);
    setStatus(null);

    if (preparedSource?.mode === "url") {
      resetPreparedSource();
    }

    const youtube = parseYouTubeVideo(value);
    if (!youtube) return;

    setSourceMode("youtube");
    setStatus(
      "Detecté YouTube. Abrí el reproductor directo para recortar sin descargar ni convertir el video. Si prefieres un WebM local, puedes intentar esa conversión de forma opcional."
    );
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

    const src = URL.createObjectURL(file);

    setPreparedSource({
      mode: "file",
      src,
      label: `${file.name} · ${formatSize(file.size)}`,
      file,
    });
    setStatus(
      "Video listo. Reprodúcelo y mueve IN/OUT para elegir exactamente qué fragmento usar. El archivo grande todavía no se subió."
    );
  }

  async function prepareRemoteSource(
    forceYouTubeLocal = false
  ) {
    if (sourceBusy || busy) return;

    const youtube = parseYouTubeVideo(sourceUrl);
    if (youtube && !forceYouTubeLocal) {
      resetPreparedSource();
      setSourceMode("youtube");
      setStatus(
        "YouTube se abre de forma nativa para evitar descargas innecesarias. Elige IN y OUT directamente sobre el reproductor."
      );
      return;
    }

    const parsedUrl = parsePublicHttpsUrl(sourceUrl);

    if (!parsedUrl) {
      setStatus(
        "Usa una URL HTTPS pública: puede ser un archivo de video directo o un enlace público de una plataforma compatible."
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      youtube
        ? "Intentando crear una copia temporal local de YouTube. Si YouTube bloquea la extracción, puedes volver al modo YouTube directo sin perder el enlace…"
        : "Preparando una copia temporal privada para que puedas reproducir el video y elegir visualmente el recorte…"
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source`,
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
            url: parsedUrl.toString(),
          }),
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
            : "No se pudo preparar la vista previa remota."
        );
      }

      setSourceMode("url");
      setPreparedSource({
        mode: "url",
        src: result.src,
        label:
          `${parsedUrl.hostname} · ${formatSize(result.bytes)}`,
        token: result.token,
        bytes: result.bytes,
      });
      setStatus(
        "Video remoto listo como copia local temporal. Elige el tramo con IN/OUT; la copia se elimina después de generar el WebM."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la vista previa remota."
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleYouTubeSubmit() {
    if (!parsedYouTube || !trim) {
      setStatus(
        "Pega un enlace válido de YouTube y selecciona un tramo con IN y OUT."
      );
      return;
    }

    setBusy(true);
    setStatus(
      `Guardando YouTube directo ${trim.startSeconds}s → ${trim.endSeconds}s. No se descarga el video…`
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

      const resultUrl = new URL(
        response.url,
        window.location.href
      );
      const resultState =
        resultUrl.searchParams.get("estado");

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy || sourceBusy) return;

    if (sourceMode === "youtube") {
      await handleYouTubeSubmit();
      return;
    }

    if (!preparedSource) {
      setStatus(
        sourceMode === "file"
          ? "Selecciona primero un archivo para ver el video y elegir el corte."
          : "Carga primero la URL o el enlace de plataforma para ver el video y elegir el corte."
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
        `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s y generando el WebM/VP9 optimizado…`
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

      const resultUrl = new URL(
        response.url,
        window.location.href
      );
      const resultState =
        resultUrl.searchParams.get("estado");

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

  const activePreviewLabel =
    savedPreviewMode === "youtube" && savedYouTubePreview
      ? `YouTube directo · ${savedYouTubePreview.startSeconds}s → ${savedYouTubePreview.endSeconds}s`
      : savedPreview
        ? "WebM local"
        : "Sin preview configurado";

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video y recorte</h2>
        </div>
        <p>
          Sistema híbrido: archivo local y URLs importables terminan en WebM; YouTube puede funcionar directamente con su reproductor oficial sin depender de descargas del servidor.
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
          <strong>YouTube directo disponible</strong>
          <span>
            {savedYouTubeUrl} · {savedYouTubePreview.startSeconds}s → {savedYouTubePreview.endSeconds}s
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
              switchSourceMode(
                event.target.value as SourceMode
              )
            }
          >
            <option value="file">Archivo de mi equipo</option>
            <option value="url">URL directa / redes</option>
            <option value="youtube">YouTube directo</option>
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
              Se reproduce desde tu equipo para elegir el corte. Sólo al confirmar se transmite al servidor y se crea el WebM final.
            </small>
          </label>
        )}

        {sourceMode === "url" && (
          <>
            <label className={styles.fieldWide}>
              <span>URL directa o enlace público de plataforma</span>
              <input
                type="url"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) =>
                  detectYouTubeOrKeepUrl(
                    event.target.value
                  )
                }
                maxLength={2048}
                placeholder="https://cdn.example/video.mp4 o enlace de una red compatible"
              />
              <small>
                Los archivos directos y Facebook, Instagram, TikTok, Vimeo, X/Twitter, Twitch, Dailymotion, Streamable y Kick se intentan importar como copia temporal para crear un WebM local. Si pegas YouTube, DeUna cambia automáticamente al reproductor directo más confiable.
              </small>
            </label>

            <div className={styles.formActions}>
              <p>
                La importación depende de que la plataforma permita obtener públicamente el video. El sitio nunca publica la copia temporal.
              </p>
              <button
                type="button"
                disabled={
                  busy ||
                  sourceBusy ||
                  !sourceUrl.trim()
                }
                onClick={() =>
                  void prepareRemoteSource(false)
                }
              >
                {sourceBusy
                  ? "Cargando video…"
                  : "Cargar enlace para recortar"}
              </button>
            </div>
          </>
        )}

        {sourceMode === "youtube" && (
          <>
            <label className={styles.fieldWide}>
              <span>Enlace de YouTube</span>
              <input
                type="url"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  resetPreparedSource();
                  setSourceUrl(event.target.value);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <small>
                Acepta youtube.com, youtu.be, Shorts, Live y enlaces embed. Este modo usa youtube-nocookie.com directamente: no pasa el video por yt-dlp, no lo descarga y no consume espacio de almacenamiento.
              </small>
            </label>

            {parsedYouTube ? (
              <div className={styles.fieldWide}>
                <YouTubeTrimEditor
                  key={parsedYouTube.videoId}
                  videoId={parsedYouTube.videoId}
                  sourceLabel={parsedYouTube.canonicalUrl}
                  initialTrim={savedYouTubeTrim}
                  onTrimChange={handleTrimChange}
                />
              </div>
            ) : sourceUrl.trim() ? (
              <div
                className={`${styles.tableSummary} ${styles.fieldWide}`}
                role="status"
              >
                <strong>YouTube</strong>
                <span>
                  No pude reconocer un ID válido en ese enlace. Prueba el enlace normal, youtu.be, Shorts o Live.
                </span>
              </div>
            ) : null}

            <div className={styles.formActions}>
              <p>
                Recomendado para máxima compatibilidad con YouTube. Si quieres independencia total de YouTube en la tarjeta, puedes intentar convertir el mismo enlace a WebM local; si YouTube bloquea la extracción, el modo directo seguirá disponible.
              </p>
              <button
                type="button"
                disabled={
                  busy ||
                  sourceBusy ||
                  !parsedYouTube
                }
                onClick={() =>
                  void prepareRemoteSource(true)
                }
              >
                {sourceBusy
                  ? "Intentando WebM local…"
                  : "Intentar WebM local (opcional)"}
              </button>
            </div>
          </>
        )}

        {preparedSource && sourceMode !== "youtube" && (
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
            {sourceMode === "youtube"
              ? "YouTube directo guarda sólo el ID y el tramo IN/OUT de hasta 30 segundos. La tarjeta usa un único reproductor compartido y silencioso al hacer hover."
              : "Archivo o URL importable: sólo el fragmento elegido —máximo 30 segundos— se convierte a WebM/VP9 silencioso y liviano."}
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
            La portada sigue cargando primero. El preview se activa sólo con intención de hover en equipos con puntero fino y respeta movimiento reducido.
          </p>
          <button
            type="submit"
            disabled={
              busy ||
              sourceBusy ||
              !trim ||
              (sourceMode !== "youtube" &&
                !preparedSource) ||
              (sourceMode === "youtube" &&
                !parsedYouTube)
            }
          >
            {busy
              ? sourceMode === "youtube"
                ? "Guardando YouTube directo…"
                : "Subiendo, recortando y convirtiendo…"
              : sourceMode === "youtube"
                ? "Usar este recorte de YouTube"
                : "Crear preview WebM con este recorte"}
          </button>
        </div>
      </form>

      {(savedPreview || savedYouTubePreview) && (
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
            Elimina el preview activo y cualquier alternativa guardada para esta tarjeta.
          </p>
          <button type="submit">Quitar preview</button>
        </form>
      )}
    </section>
  );
}
