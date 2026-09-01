"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import styles from "../../app/admin/admin.module.css";

const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

const acceptedTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
]);

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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy) return;

    const file = fileInput.current?.files?.[0];

    if (!file) {
      setStatus("Selecciona un video para continuar.");
      return;
    }

    const extensionOk = /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(
      file.name
    );

    if (
      file.size <= 0 ||
      file.size > MAX_SOURCE_BYTES ||
      (!extensionOk && file.type && !acceptedTypes.has(file.type.toLowerCase()))
    ) {
      setStatus(
        "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB."
      );
      return;
    }

    setBusy(true);
    setStatus(
      `Convirtiendo ${formatSize(file.size)} a WebM/VP9 · máximo 30 s · sin audio…`
    );

    try {
      const body = new FormData();
      body.set("expectedRevision", String(revision));
      body.set("video", file);

      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body,
        }
      );

      if (!response.ok) {
        throw new Error(
          "El servidor rechazó la carga del preview."
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

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Video ultraliviano al mantener el mouse</h2>
        </div>
        <p>
          La portada sigue cargando normalmente. El WebM sólo se solicita si el visitante mantiene el puntero sobre una tarjeta durante 2 segundos.
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

        <label className={styles.fieldWide}>
          <span>{currentPreview ? "Reemplazar preview" : "Archivo de video"}</span>
          <input
            ref={fileInput}
            type="file"
            name="video"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi"
            required
          />
          <small>
            DeUna acepta formatos comunes y genera siempre WebM/VP9, máximo 480 px, 18 fps, sin audio y hasta 30 segundos. Si hace falta, aplica una segunda compresión más agresiva para mantener el archivo por debajo de 3 MB.
          </small>
        </label>

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
            La conversión ocurre en el servidor. El archivo fuente no se publica ni se conserva: sólo queda el WebM optimizado asociado al borrador del juego.
          </p>
          <button type="submit" disabled={busy}>
            {busy
              ? "Convirtiendo y guardando…"
              : currentPreview
                ? "Reemplazar preview"
                : "Subir y preparar preview"}
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
