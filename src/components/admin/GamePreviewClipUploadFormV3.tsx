"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import {
  parseSupportedPlatformVideoUrl,
  type SupportedVideoPlatform,
} from "@/lib/media/platform-video-url";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import type {
  GameDirectPreview,
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
const acceptedExtensions = /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const MEDIA_PROBE_TIMEOUT_MS = 10_000;

const PLATFORM_OPTIONS: readonly {
  value: SupportedVideoPlatform;
  label: string;
  placeholder: string;
}[] = [
  { value: "youtube", label: "YouTube", placeholder: "youtube.com/watch?v=... · youtu.be/... · Shorts" },
  { value: "facebook", label: "Facebook", placeholder: "facebook.com/.../videos/... · fb.watch/..." },
  { value: "instagram", label: "Instagram", placeholder: "instagram.com/reel/... · instagram.com/p/..." },
  { value: "tiktok", label: "TikTok", placeholder: "tiktok.com/@usuario/video/..." },
  { value: "vimeo", label: "Vimeo", placeholder: "vimeo.com/123456789" },
  { value: "x", label: "X / Twitter", placeholder: "x.com/usuario/status/..." },
  { value: "twitch", label: "Twitch", placeholder: "twitch.tv/videos/... · clips.twitch.tv/..." },
  { value: "dailymotion", label: "Dailymotion", placeholder: "dailymotion.com/video/... · dai.ly/..." },
  { value: "streamable", label: "Streamable", placeholder: "streamable.com/abc123" },
  { value: "kick", label: "Kick", placeholder: "kick.com/..." },
  { value: "reddit", label: "Reddit", placeholder: "reddit.com/... · redd.it/..." },
  { value: "rumble", label: "Rumble", placeholder: "rumble.com/..." },
  { value: "odysee", label: "Odysee", placeholder: "odysee.com/..." },
  { value: "bilibili", label: "Bilibili", placeholder: "bilibili.com/... · b23.tv/..." },
  { value: "vk", label: "VK", placeholder: "vk.com/video..." },
  { value: "imgur", label: "Imgur", placeholder: "imgur.com/..." },
  { value: "pinterest", label: "Pinterest", placeholder: "pinterest.com/pin/... · pin.it/..." },
  { value: "tumblr", label: "Tumblr", placeholder: "tumblr.com/..." },
  { value: "snapchat", label: "Snapchat", placeholder: "snapchat.com/..." },
  { value: "loom", label: "Loom", placeholder: "loom.com/share/..." },
  { value: "wistia", label: "Wistia", placeholder: "wistia.com/... · wistia.net/..." },
  { value: "nicovideo", label: "Niconico", placeholder: "nicovideo.jp/watch/... · nico.ms/..." },
] as const;

type SourceMode = "file" | SupportedVideoPlatform;

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
      usesProxy: boolean;
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
  platform?: unknown;
  platformLabel?: unknown;
};

type ProxyResponse = {
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
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
  return acceptedExtensions.test(extension) ? extension : ".video";
}

function stagedSourcePath(slug: string, token: string) {
  return `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${token}`;
}

function platformOption(platform: SupportedVideoPlatform) {
  return PLATFORM_OPTIONS.find((option) => option.value === platform);
}

function isSupportedSourceMode(value: string): value is SupportedVideoPlatform {
  return PLATFORM_OPTIONS.some((option) => option.value === value);
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
    return "La copia temporal venció. Vuelve a preparar el video y selecciona el tramo otra vez.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "La fuente no pudo validarse o decodificarse como video compatible.";
  }
  return "No se pudo guardar el preview de la tarjeta.";
}

function validLocalFile(file: File) {
  const extensionOk = acceptedExtensions.test(file.name);

  return !(
    file.size <= 0 ||
    file.size > MAX_PREVIEW_SOURCE_BYTES ||
    (!extensionOk && file.type && !acceptedTypes.has(file.type.toLowerCase()))
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
    video.addEventListener("canplay", () => finish(true), { once: true });
    video.addEventListener("error", () => finish(false), { once: true });
    video.src = src;
    video.load();
  });
}

function legacySource(
  mode: GamePreviewMode | undefined,
  youtube: GameYouTubePreview | undefined,
  direct: GameDirectPreview | undefined
): { mode: SupportedVideoPlatform; url: string } | null {
  if (mode === "youtube" && youtube) {
    return {
      mode: "youtube",
      url: `https://www.youtube.com/watch?v=${youtube.videoId}`,
    };
  }

  if (direct && isSupportedSourceMode(direct.platform)) {
    return {
      mode: direct.platform,
      url: direct.url,
    };
  }

  return null;
}

export default function GamePreviewClipUploadFormV3({
  slug,
  revision,
  currentPreview,
  currentPreviewMode,
  currentYouTubePreview,
  currentDirectPreview,
}: GamePreviewClipUploadFormProps) {
  const previousExternal = legacySource(
    currentPreviewMode,
    currentYouTubePreview,
    currentDirectPreview
  );
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    currentPreview ? "file" : previousExternal?.mode ?? "file"
  );
  const [sourceUrl, setSourceUrl] = useState(
    currentPreview ? "" : previousExternal?.url ?? ""
  );
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] = useState<PreviewTrimWindow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedPlatform =
    sourceMode === "file" ? null : platformOption(sourceMode) ?? null;
  const parsedPlatformUrl = useMemo(() => {
    if (sourceMode === "file") return null;
    const parsed = parseSupportedPlatformVideoUrl(sourceUrl);
    return parsed?.platform === sourceMode ? parsed : null;
  }, [sourceMode, sourceUrl]);

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

    if (mode === "file") {
      setSourceUrl("");
      return;
    }

    setSourceUrl(
      previousExternal?.mode === mode ? previousExternal.url : ""
    );
  }

  async function createProxyForStagedToken(token: string) {
    const response = await fetch(
      `${stagedSourcePath(slug, token)}/proxy`,
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
        }),
      }
    );
    const result = (await response.json()) as ProxyResponse;

    if (!response.ok || typeof result.src !== "string") {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "No se pudo crear una vista previa compatible para este códec."
      );
    }

    return result.src;
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
          "Content-Type": file.type || "application/octet-stream",
          "X-Deuna-Expected-Revision": String(revision),
          "X-Deuna-Source-Extension": sourceExtension(file.name),
        },
        body: file,
      }
    );
    const result = (await response.json()) as StagedSourceResponse;

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
      label: `${file.name} · ${formatSize(file.size)} · vista previa compatible`,
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
    setStatus("Comprobando si el navegador puede reproducir el video directamente…");

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
      if (!keepObjectUrl) URL.revokeObjectURL(src);
      setSourceBusy(false);
    }
  }

  function handleLocalFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    resetPreparedSource();
    setStatus(null);

    if (!file) return;

    if (!validLocalFile(file)) {
      event.target.value = "";
      setStatus("Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 1 GB.");
      return;
    }

    void prepareLocalFile(file);
  }

  async function preparePlatformSource() {
    if (
      sourceMode === "file" ||
      sourceBusy ||
      busy ||
      !selectedPlatform
    ) {
      return;
    }

    if (!parsedPlatformUrl) {
      setStatus(
        `Pega un enlace público que pertenezca realmente a ${selectedPlatform.label}. Una URL de otra red no se acepta en esta selección.`
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      `Descargando una copia temporal privada de ${selectedPlatform.label}. Cuando termine podrás recorrer el video completo y elegir IN/OUT…`
    );
    let stagedToken: string | null = null;

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-platform/${encodeURIComponent(sourceMode)}`,
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
            url: parsedPlatformUrl.url,
          }),
        }
      );
      const result = (await response.json()) as StagedSourceResponse;

      if (
        !response.ok ||
        typeof result.token !== "string" ||
        typeof result.src !== "string" ||
        typeof result.bytes !== "number"
      ) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `No se pudo obtener el video público desde ${selectedPlatform.label}.`
        );
      }

      stagedToken = result.token;
      const playable = await probeBrowserPlayback(result.src);
      let editorSrc = result.src;
      let usesProxy = false;

      if (!playable) {
        setStatus(
          `${selectedPlatform.label} entregó un códec que el navegador no reproduce directamente. Creando un proxy WebM privado para editar…`
        );
        editorSrc = await createProxyForStagedToken(result.token);
        usesProxy = true;
      }

      setPreparedSource({
        mode: "staged",
        src: editorSrc,
        label:
          `${selectedPlatform.label} · ${formatSize(result.bytes)}` +
          (usesProxy ? " · proxy de edición" : " · copia temporal"),
        token: result.token,
        bytes: result.bytes,
        usesProxy,
      });
      stagedToken = null;
      setStatus(
        `Video de ${selectedPlatform.label} listo. Elige IN/OUT. Al guardar, DeUna recortará esta copia y generará un WebM propio; la URL externa no se usará en las tarjetas.`
      );
    } catch (error) {
      if (stagedToken) {
        void fetch(stagedSourcePath(slug, stagedToken), {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);
      }

      setStatus(
        error instanceof Error
          ? error.message
          : `No se pudo preparar el video de ${selectedPlatform.label}.`
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function savePreparedPreview() {
    if (!preparedSource) {
      setStatus(
        sourceMode === "file"
          ? "Selecciona primero un archivo para ver el video y elegir el corte."
          : "Descarga primero una copia temporal de la plataforma para elegir el corte."
      );
      return;
    }

    if (!trim) {
      setStatus("Selecciona un tramo válido con los marcadores IN y OUT.");
      return;
    }

    let endpoint: string;
    let body: BodyInit;
    let headers: HeadersInit;

    if (preparedSource.mode === "file") {
      endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`;
      body = preparedSource.file;
      headers = {
        "Content-Type": preparedSource.file.type || "application/octet-stream",
        "X-Deuna-Expected-Revision": String(revision),
        "X-Deuna-Trim-Start": String(trim.startSeconds),
        "X-Deuna-Trim-End": String(trim.endSeconds),
        "X-Deuna-Source-Extension": sourceExtension(preparedSource.file.name),
      };
      setStatus(
        `Subiendo ${formatSize(preparedSource.file.size)} por streaming y convirtiendo sólo ${trim.durationSeconds.toFixed(1)} s a WebM/VP9…`
      );
    } else {
      endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
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
        `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s y generando el WebM/VP9 interno de DeUna…`
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
            ? "El video supera el límite máximo permitido."
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
          : "No se pudo crear el WebM del preview."
      );
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sourceBusy) return;
    await savePreparedPreview();
  }

  const activePreviewLabel = currentPreview
    ? "WebM interno de DeUna"
    : previousExternal
      ? `${platformOption(previousExternal.mode)?.label ?? previousExternal.mode} externo anterior · pendiente de convertir a WebM`
      : "Sin preview configurado";
  const hasSavedPreview = Boolean(
    currentPreview || currentYouTubePreview || currentDirectPreview
  );

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video, recorte y WebM</h2>
        </div>
        <p>
          La red sólo aporta el video fuente. DeUna descarga una copia temporal, permite elegir IN/OUT y guarda únicamente un WebM interno optimizado para las tarjetas.
        </p>
      </div>

      <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
        <strong>Preview activo</strong>
        <span>{activePreviewLabel}</span>
      </div>

      {currentPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>WebM interno disponible</strong>
          <span>{currentPreview}</span>
          <video
            src={currentPreview}
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

      {!currentPreview && previousExternal && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`} role="status">
          <strong>Preview externo anterior</strong>
          <span>
            Esta configuración pertenece al enfoque anterior. La URL ya está cargada abajo para que la prepares y la reemplaces por un WebM interno.
          </span>
        </div>
      )}

      <form className={styles.editorForm} onSubmit={handleSubmit}>
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
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {sourceMode === "file" ? (
          <label className={styles.fieldWide}>
            <span>Archivo de video · máximo 1 GB</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi"
              disabled={busy || sourceBusy}
              onChange={handleLocalFile}
            />
            <small>
              Si el navegador reproduce el códec, editas directamente desde tu equipo. Si no, DeUna crea un proxy privado; el WebM final se genera desde la fuente original.
            </small>
          </label>
        ) : (
          <>
            <label className={styles.fieldWide}>
              <span>URL de {selectedPlatform?.label ?? sourceMode}</span>
              <input
                type="text"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  setSourceUrl(event.target.value);
                  resetPreparedSource();
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder={selectedPlatform?.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Esta línea acepta solamente {selectedPlatform?.label ?? sourceMode}. El servidor vuelve a comprobar la plataforma antes de descargar. Debe ser contenido público y accesible para el extractor.
              </small>
            </label>

            <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
              <strong>Preparación de fuente</strong>
              <span>
                Primero DeUna descarga una copia temporal de hasta 512 MB. Esa copia existe sólo para editar y se elimina después de generar el WebM.
              </span>
              <button
                type="button"
                disabled={busy || sourceBusy || !parsedPlatformUrl}
                onClick={() => void preparePlatformSource()}
              >
                {sourceBusy
                  ? `Descargando ${selectedPlatform?.label ?? "video"}…`
                  : `Descargar y preparar ${selectedPlatform?.label ?? "video"}`}
              </button>
            </div>

            {sourceUrl.trim() && !parsedPlatformUrl && (
              <div className={`${styles.tableSummary} ${styles.fieldWide}`} role="status">
                <strong>URL no válida para esta selección</strong>
                <span>
                  El enlace debe pertenecer a {selectedPlatform?.label ?? sourceMode}. Si es de otra red, cambia la selección antes de continuar.
                </span>
              </div>
            )}
          </>
        )}

        {preparedSource && (
          <div className={styles.fieldWide}>
            <VideoTrimEditor
              key={preparedSource.src}
              src={preparedSource.src}
              sourceLabel={preparedSource.label}
              onTrimChange={setTrim}
            />
          </div>
        )}

        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Resultado final</strong>
          <span>
            Siempre se guarda un archivo WebM/VP9 silencioso y liviano de hasta 30 segundos dentro de DeUna Games. La card nunca necesita volver a Facebook, YouTube ni ninguna otra red para reproducir este preview.
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
            El origen puede ser grande o externo; el preview publicado siempre termina como WebM interno y se solicita sólo después del hover.
          </p>
          <button
            type="submit"
            disabled={busy || sourceBusy || !trim || !preparedSource}
          >
            {busy
              ? "Recortando y convirtiendo a WebM…"
              : "Crear preview WebM con este recorte"}
          </button>
        </div>
      </form>

      {hasSavedPreview && (
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
          <p>Elimina el preview activo de esta tarjeta.</p>
          <button type="submit">Quitar preview</button>
        </form>
      )}
    </section>
  );
}
