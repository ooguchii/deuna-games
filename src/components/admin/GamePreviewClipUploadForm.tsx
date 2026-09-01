"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

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

type SourceMode = "file" | "url";

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
};

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  proxyBytes?: unknown;
  error?: unknown;
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

function parsePublicVideoUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    return null;
  }

  const isHttp = parsedUrl.protocol === "http:";
  const isHttps = parsedUrl.protocol === "https:";
  const validPort =
    !parsedUrl.port ||
    (isHttp && parsedUrl.port === "80") ||
    (isHttps && parsedUrl.port === "443");

  if (
    (!isHttp && !isHttps) ||
    parsedUrl.username ||
    parsedUrl.password ||
    !parsedUrl.hostname ||
    !validPort ||
    parsedUrl.toString().length > 2_048
  ) {
    return null;
  }

  return parsedUrl;
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

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
}: GamePreviewClipUploadFormProps) {
  const [sourceMode, setSourceMode] =
    useState<SourceMode>("file");
  const [sourceUrl, setSourceUrl] = useState("");
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] =
    useState<PreviewTrimWindow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function stagedSourcePath(token: string) {
    return `/api/admin/content/games/${encodeURIComponent(slug)}/preview-source/${token}`;
  }

  useEffect(() => {
    const source = preparedSource;

    return () => {
      if (!source) return;

      if (source.mode === "file") {
        URL.revokeObjectURL(source.src);
        return;
      }

      void fetch(stagedSourcePath(source.token), {
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
  }

  async function createProxyForStagedToken(token: string) {
    const response = await fetch(
      `${stagedSourcePath(token)}/proxy`,
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

  async function prepareRemoteSource() {
    if (sourceBusy || busy) return;

    const parsedUrl = parsePublicVideoUrl(sourceUrl);

    if (!parsedUrl) {
      setStatus(
        "Usa un enlace público HTTP o HTTPS: archivo directo o enlace de una plataforma compatible. También puedes pegarlo sin escribir https://."
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      "Preparando una copia temporal privada para que puedas reproducir el video y elegir visualmente el recorte…"
    );
    let stagedToken: string | null = null;

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

      stagedToken = result.token;
      const playable = await probeBrowserPlayback(result.src);
      let editorSrc = result.src;
      let usesProxy = false;

      if (!playable) {
        setStatus(
          "El video remoto usa un códec o tipo de respuesta que el navegador no reproduce. Creando una vista previa de edición compatible…"
        );
        editorSrc = await createProxyForStagedToken(result.token);
        usesProxy = true;
      }

      setPreparedSource({
        mode: "staged",
        src: editorSrc,
        label:
          `${parsedUrl.hostname} · ${formatSize(result.bytes)}` +
          (usesProxy ? " · vista previa compatible" : ""),
        token: result.token,
        bytes: result.bytes,
        usesProxy,
      });
      stagedToken = null;
      setStatus(
        usesProxy
          ? "Vista previa compatible lista. El recorte final se generará desde el original temporal."
          : "Video remoto listo. Elige el tramo con IN/OUT; la copia temporal se elimina después de generar el WebM."
      );
    } catch (error) {
      if (stagedToken) {
        void fetch(stagedSourcePath(stagedToken), {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);
      }

      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la vista previa remota."
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy || sourceBusy) return;

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

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video y recorte</h2>
        </div>
        <p>
          Puedes usar un archivo de hasta 1 GB, una URL directa o un enlace público de una plataforma compatible. Primero eliges visualmente el fragmento y sólo después se crea el WebM final.
        </p>
      </div>

      {currentPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Preview WebM actual</strong>
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
            <option value="url">URL / YouTube / redes</option>
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
              Si tu navegador reproduce el códec, se edita directamente desde tu equipo. Si no, DeUna crea automáticamente una vista previa WebM privada y liviana; al confirmar siempre recorta el archivo original.
            </small>
          </label>
        )}

        {sourceMode === "url" && (
          <>
            <label className={styles.fieldWide}>
              <span>URL directa o enlace público de plataforma</span>
              <input
                type="text"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  if (preparedSource?.mode === "staged") {
                    resetPreparedSource();
                  }
                  setSourceUrl(event.target.value);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="youtube.com/watch?v=... · http://... · https://cdn.example/video.mp4"
              />
              <small>
                Acepta HTTP y HTTPS, con o sin escribir el protocolo, archivos directos MP4/WebM/MOV/M4V/MKV/AVI de hasta 1 GB y enlaces públicos de YouTube, Facebook, Instagram, TikTok, Vimeo, X/Twitter, Twitch, Dailymotion, Streamable y Kick. Los videos privados, con login o DRM no se pueden importar.
              </small>
            </label>

            <div className={styles.formActions}>
              <p>
                Los archivos directos se copian por streaming. En plataformas se prepara una versión temporal para recortar visualmente; si el navegador no entiende el códec se genera además un proxy privado. Nada de eso se publica.
              </p>
              <button
                type="button"
                disabled={busy || sourceBusy || !sourceUrl.trim()}
                onClick={prepareRemoteSource}
              >
                {sourceBusy
                  ? "Cargando video…"
                  : "Cargar video o enlace para recortar"}
              </button>
            </div>
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
            Puedes mover IN y OUT, usar “Marcar IN aquí”, “Marcar OUT aquí” y “Reproducir recorte”. El origen puede pesar hasta 1 GB, pero sólo el fragmento elegido —máximo 30 segundos— se convierte desde el original a WebM/VP9 silencioso y liviano.
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
            La portada sigue siendo lo primero que carga. El WebM se solicita sólo después del hover configurado en la tarjeta.
          </p>
          <button
            type="submit"
            disabled={busy || sourceBusy || !trim || !preparedSource}
          >
            {busy
              ? "Subiendo, recortando y convirtiendo…"
              : "Crear preview WebM con este recorte"}
          </button>
        </div>
      </form>

      {currentPreview && (
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
          <p>Elimina el preview WebM actual de las tarjetas.</p>
          <button type="submit">Quitar preview</button>
        </form>
      )}
    </section>
  );
}
