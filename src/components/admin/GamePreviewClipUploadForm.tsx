"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import {
  MAX_PREVIEW_SOURCE_BYTES,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
  parsePreviewTrimWindow,
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

type SourceMode = "file" | "url";

type GamePreviewClipUploadFormProps = {
  slug: string;
  revision: number;
  currentPreview?: string;
};

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uploadError(state: string | null) {
  if (state === "conflicto") {
    return "Otra pestaña guardó una revisión más reciente. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "ffmpeg") {
    return "FFmpeg no está disponible en este servidor. Instálalo o configura DEUNA_FFMPEG_PATH y reinicia DeUna.";
  }
  if (state === "video-pesado") {
    return "El preview final no pudo quedar por debajo del límite de 3 MB. Usa un fragmento con menos movimiento o menor resolución.";
  }
  if (state === "preview-recorte-invalido") {
    return "El recorte no es válido. El final debe ser posterior al inicio y el tramo puede durar como máximo 30 segundos.";
  }
  if (state === "preview-url-invalida") {
    return "No se pudo importar esa URL. Usa un enlace HTTPS público que apunte directamente al archivo de video, no a una página web.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "El archivo no pudo decodificarse como video compatible.";
  }
  return "No se pudo preparar el preview de la tarjeta.";
}

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
}: GamePreviewClipUploadFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] =
    useState<SourceMode>("file");
  const [sourceUrl, setSourceUrl] = useState("");
  const [startSeconds, setStartSeconds] = useState("0");
  const [endSeconds, setEndSeconds] = useState("30");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy) return;

    const trim = parsePreviewTrimWindow(
      startSeconds,
      endSeconds
    );

    if (!trim) {
      setStatus(
        "Elige un inicio y un final válidos. El tramo debe durar como máximo 30 segundos."
      );
      return;
    }

    let endpoint: string;
    let body: FormData | URLSearchParams;
    let headers: HeadersInit | undefined;
    let sourceDescription: string;

    if (sourceMode === "file") {
      const file = fileInput.current?.files?.[0];

      if (!file) {
        setStatus("Selecciona un video para continuar.");
        return;
      }

      const extensionOk =
        /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(
          file.name
        );

      if (
        file.size <= 0 ||
        file.size > MAX_PREVIEW_SOURCE_BYTES ||
        (!extensionOk &&
          file.type &&
          !acceptedTypes.has(file.type.toLowerCase()))
      ) {
        setStatus(
          "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB."
        );
        return;
      }

      const upload = new FormData();
      upload.set("expectedRevision", String(revision));
      upload.set(
        "startSeconds",
        String(trim.startSeconds)
      );
      upload.set(
        "endSeconds",
        String(trim.endSeconds)
      );
      upload.set("video", file);

      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`;
      body = upload;
      sourceDescription = formatSize(file.size);
    } else {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(sourceUrl.trim());
      } catch {
        setStatus(
          "Escribe una URL directa de video válida."
        );
        return;
      }

      if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.username ||
        parsedUrl.password ||
        (parsedUrl.port && parsedUrl.port !== "443") ||
        parsedUrl.toString().length > 2_048
      ) {
        setStatus(
          "La importación sólo admite una URL HTTPS pública, sin credenciales ni puertos alternativos."
        );
        return;
      }

      const importBody = new URLSearchParams({
        expectedRevision: String(revision),
        url: parsedUrl.toString(),
        startSeconds: String(trim.startSeconds),
        endSeconds: String(trim.endSeconds),
      });

      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
      body = importBody;
      headers = {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
      };
      sourceDescription = "video remoto";
    }

    setBusy(true);
    setStatus(
      `Preparando ${sourceDescription} · recorte ${trim.startSeconds}s → ${trim.endSeconds}s (${trim.durationSeconds}s) · WebM/VP9 sin audio…`
    );

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
          "El servidor rechazó la preparación del preview."
        );
      }

      const resultUrl = new URL(
        response.url,
        window.location.href
      );
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

  const currentTrim = parsePreviewTrimWindow(
    startSeconds,
    endSeconds
  );

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video ultraliviano al mantener el mouse</h2>
        </div>
        <p>
          La portada sigue cargando normalmente. El WebM sólo se solicita si el visitante mantiene el puntero sobre una tarjeta durante 1 segundo.
        </p>
      </div>

      {currentPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Preview actual</strong>
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
        method="post"
        encType="multipart/form-data"
        action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`}
        onSubmit={handleSubmit}
      >
        <input
          type="hidden"
          name="expectedRevision"
          value={revision}
        />

        <label>
          <span>Origen del video</span>
          <select
            value={sourceMode}
            onChange={(event) => {
              setSourceMode(
                event.target.value as SourceMode
              );
              setStatus(null);
            }}
          >
            <option value="file">
              Archivo de mi equipo
            </option>
            <option value="url">
              URL directa HTTPS
            </option>
          </select>
        </label>

        {sourceMode === "file" ? (
          <label className={styles.fieldWide}>
            <span>
              {currentPreview
                ? "Reemplazar preview"
                : "Archivo de video"}
            </span>
            <input
              ref={fileInput}
              type="file"
              name="video"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi"
              required
            />
            <small>
              MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB.
            </small>
          </label>
        ) : (
          <label className={styles.fieldWide}>
            <span>URL directa del video</span>
            <input
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(event) =>
                setSourceUrl(event.target.value)
              }
              maxLength={2048}
              placeholder="https://cdn.example/video.mp4"
              required
            />
            <small>
              Debe ser un enlace HTTPS público que entregue directamente el archivo de video. No se aceptan páginas de YouTube, TikTok u otros reproductores.
            </small>
          </label>
        )}

        <label>
          <span>Desde el segundo</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={MAX_PREVIEW_SOURCE_POSITION_SECONDS}
            step="0.1"
            value={startSeconds}
            onChange={(event) =>
              setStartSeconds(event.target.value)
            }
            required
          />
        </label>

        <label>
          <span>Hasta el segundo</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={MAX_PREVIEW_SOURCE_POSITION_SECONDS}
            step="0.1"
            value={endSeconds}
            onChange={(event) =>
              setEndSeconds(event.target.value)
            }
            required
          />
        </label>

        <div
          className={`${styles.tableSummary} ${styles.fieldWide}`}
        >
          <strong>Recorte de una sola vez</strong>
          <span>
            {currentTrim
              ? `Se conservarán ${currentTrim.durationSeconds} s: desde ${currentTrim.startSeconds} s hasta ${currentTrim.endSeconds} s.`
              : "El final debe ser posterior al inicio y el tramo no puede superar 30 segundos."}
          </span>
        </div>

        <div
          className={`${styles.tableSummary} ${styles.fieldWide}`}
        >
          <strong>Conversión final</strong>
          <span>
            DeUna descarga o recibe el original una sola vez, toma únicamente el tramo elegido y genera WebM/VP9 sin audio. El perfil principal usa hasta 400 px y 15 fps; si hace falta utiliza 360 px y 12 fps. El objetivo es aproximadamente 1,5 MB y el límite duro continúa en 3 MB.
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
            El archivo fuente, sea local o remoto, queda sólo en almacenamiento temporal privado durante la conversión y se elimina al terminar. El sitio conserva únicamente el WebM optimizado asociado al borrador del juego.
          </p>
          <button type="submit" disabled={busy}>
            {busy
              ? "Recortando y convirtiendo…"
              : currentPreview
                ? "Reemplazar preview"
                : "Preparar preview"}
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
          <p>
            Quitar el preview no elimina la portada. Las tarjetas volverán a ser completamente estáticas.
          </p>
          <button type="submit">
            Quitar preview
          </button>
        </form>
      )}
    </section>
  );
}
