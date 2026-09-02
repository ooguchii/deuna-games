"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import {
  parseSupportedPlatformVideoUrl,
} from "@/lib/media/platform-video-url";
import type {
  PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

import styles from "../../app/admin/admin.module.css";

const MEDIA_PROBE_TIMEOUT_MS = 10_000;

type PreparedSource = {
  src: string;
  label: string;
  token: string;
  bytes: number;
  usesProxy: boolean;
};

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
  sourceKind?: unknown;
  platform?: unknown;
  platformLabel?: unknown;
};

type ProxyResponse = {
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
};

type GamePreviewAutoUrlEditorProps = {
  slug: string;
  revision: number;
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeHttpUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    const isHttp = parsed.protocol === "http:";
    const isHttps = parsed.protocol === "https:";
    const validPort =
      !parsed.port ||
      (isHttp && parsed.port === "80") ||
      (isHttps && parsed.port === "443");

    if (
      (!isHttp && !isHttps) ||
      parsed.username ||
      parsed.password ||
      !parsed.hostname ||
      !validPort ||
      parsed.toString().length > 2_048
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
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
    return "El video o el recorte no son válidos. Ajusta IN y OUT y vuelve a intentarlo.";
  }
  if (state === "preview-source-expirada") {
    return "La copia temporal venció. Vuelve a preparar la URL y selecciona el tramo otra vez.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "La fuente no pudo validarse o decodificarse como video compatible.";
  }
  return "No se pudo guardar el preview de la tarjeta.";
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

export default function GamePreviewAutoUrlEditor({
  slug,
  revision,
}: GamePreviewAutoUrlEditorProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] = useState<PreviewTrimWindow | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const normalizedUrl = useMemo(
    () => normalizeHttpUrl(sourceUrl),
    [sourceUrl]
  );
  const detectedPlatform = useMemo(
    () => parseSupportedPlatformVideoUrl(sourceUrl),
    [sourceUrl]
  );

  useEffect(() => {
    const source = preparedSource;

    return () => {
      if (!source) return;

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

  async function prepareSource() {
    if (sourceBusy || busy) return;

    if (!normalizedUrl) {
      setStatus(
        "Pega una URL HTTP o HTTPS pública, sin credenciales ni puertos alternativos."
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      detectedPlatform
        ? `Detecté ${detectedPlatform.platformLabel}. Descargando una copia temporal privada para abrirla en el editor IN/OUT…`
        : "La URL no pertenece a una red conocida. Intentaré importarla como archivo o stream de video directo y abrirla en el editor IN/OUT…"
    );
    let stagedToken: string | null = null;

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-url`,
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
            url: normalizedUrl,
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
            : "No se pudo obtener un video utilizable desde esa URL."
        );
      }

      stagedToken = result.token;
      const sourceLabel =
        typeof result.platformLabel === "string"
          ? result.platformLabel
          : detectedPlatform?.platformLabel ?? "URL directa";
      const playable = await probeBrowserPlayback(result.src);
      let editorSrc = result.src;
      let usesProxy = false;

      if (!playable) {
        setStatus(
          `${sourceLabel} entregó un códec que el navegador no reproduce directamente. Creando un proxy WebM privado para editar…`
        );
        editorSrc = await createProxyForStagedToken(result.token);
        usesProxy = true;
      }

      setPreparedSource({
        src: editorSrc,
        label:
          `${sourceLabel} · ${formatSize(result.bytes)}` +
          (usesProxy ? " · proxy de edición" : " · copia temporal"),
        token: result.token,
        bytes: result.bytes,
        usesProxy,
      });
      stagedToken = null;
      setStatus(
        `${sourceLabel} listo. Recorre el video y elige IN/OUT. Al guardar, DeUna generará un WebM propio y descartará la fuente externa.`
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
          : "No se pudo preparar el video desde esa URL."
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function savePreparedPreview() {
    if (!preparedSource || !trim) {
      setStatus(
        "Prepara primero la URL y selecciona un tramo válido con los marcadores IN y OUT."
      );
      return;
    }

    setBusy(true);
    setStatus(
      `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s y generando el WebM/VP9 interno de DeUna…`
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`,
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
            sourceToken: preparedSource.token,
            startSeconds: String(trim.startSeconds),
            endSeconds: String(trim.endSeconds),
          }),
        }
      );

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

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>IMPORTACIÓN RÁPIDA · URL AUTOMÁTICA</span>
          <h2>Pega el enlace, recorta y guarda</h2>
        </div>
        <p>
          DeUna detecta automáticamente las plataformas compatibles. Si la URL apunta directamente a un archivo o stream HTTP(S), usa el importador seguro de URL directa. Ambos caminos terminan en el mismo editor IN/OUT y en un WebM interno.
        </p>
      </div>

      <form className={styles.editorForm} onSubmit={handleSubmit}>
        <label className={styles.fieldWide}>
          <span>URL pública del video</span>
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
            placeholder="Pega YouTube, Facebook, Instagram, TikTok, Vimeo… o una URL directa .mp4/.webm"
            autoComplete="off"
            spellCheck={false}
          />
          <small>
            {detectedPlatform
              ? `Plataforma detectada: ${detectedPlatform.platformLabel}.`
              : normalizedUrl
                ? "No es una red conocida: se validará como archivo o stream de video directo. Las páginas HTML comunes se rechazan."
                : "Acepta HTTP/HTTPS público. Puedes pegar el enlace con o sin https://."}
          </small>
        </label>

        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Preparar para recortar</strong>
          <span>
            Las redes compatibles se descargan como una copia editorial temporal de hasta 512 MB. Una URL directa puede llegar hasta 1 GB. La copia no se publica: sólo sirve para elegir IN/OUT y crear el WebM final.
          </span>
          <button
            type="button"
            disabled={busy || sourceBusy || !normalizedUrl}
            onClick={() => void prepareSource()}
          >
            {sourceBusy
              ? "Descargando y preparando…"
              : "Detectar, descargar y preparar"}
          </button>
        </div>

        {sourceUrl.trim() && !normalizedUrl && (
          <div
            className={`${styles.tableSummary} ${styles.fieldWide}`}
            role="status"
          >
            <strong>URL no válida</strong>
            <span>
              Usa una URL HTTP o HTTPS pública sin usuario, contraseña ni puertos alternativos.
            </span>
          </div>
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
            El preview publicado siempre queda dentro de DeUna Games como WebM/VP9 silencioso de hasta 30 segundos. La tarjeta no depende de la URL externa después de guardar.
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
            Para archivos del equipo o para forzar manualmente una plataforma concreta, conserva las opciones del editor de fuentes que aparece debajo.
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
    </section>
  );
}
