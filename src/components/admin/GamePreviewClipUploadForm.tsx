"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
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

type SourceMode = "file" | "url";

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
};

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  error?: unknown;
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
    return "El preview final no pudo quedar por debajo del límite de 3 MB. Elige un tramo con menos movimiento o de menor duración.";
  }
  if (state === "preview-recorte-invalido") {
    return "El recorte no es válido. Ajusta los marcadores IN y OUT y vuelve a intentarlo.";
  }
  if (state === "preview-source-expirada") {
    return "La vista previa remota venció o ya no está disponible. Vuelve a cargar la URL y selecciona el tramo otra vez.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "El archivo no pudo decodificarse como video compatible.";
  }
  return "No se pudo preparar el preview de la tarjeta.";
}

function validLocalFile(file: File) {
  const extensionOk =
    /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(
      file.name
    );

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

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
}: GamePreviewClipUploadFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
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

  function resetPreparedSource() {
    setPreparedSource(null);
    setTrim(null);
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
        "Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB."
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
      "Vista previa local lista. Reproduce el video y mueve IN/OUT para elegir el tramo."
    );
  }

  async function prepareRemoteSource() {
    if (sourceBusy || busy) return;

    const parsedUrl = parsePublicHttpsUrl(
      sourceUrl
    );

    if (!parsedUrl) {
      setStatus(
        "Usa una URL HTTPS pública, sin credenciales ni puertos alternativos, que entregue directamente el archivo de video."
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      "Descargando el video remoto a staging privado para poder previsualizarlo…"
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

      setPreparedSource({
        mode: "url",
        src: result.src,
        label:
          `${parsedUrl.hostname} · ${formatSize(result.bytes)}`,
        token: result.token,
        bytes: result.bytes,
      });
      setStatus(
        "Vista previa remota lista. El original permanece temporalmente en el servidor sólo mientras eliges el corte."
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy || sourceBusy) return;

    if (!preparedSource) {
      setStatus(
        sourceMode === "file"
          ? "Selecciona primero un video para ver la preview y elegir el corte."
          : "Carga primero la URL para ver la preview y elegir el corte."
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
    let body: FormData | URLSearchParams;
    let headers: HeadersInit | undefined;

    if (preparedSource.mode === "file") {
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
      upload.set("video", preparedSource.file);

      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`;
      body = upload;
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
    }

    setBusy(true);
    setStatus(
      `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s (${trim.durationSeconds}s) y generando WebM/VP9 optimizado…`
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
          <h2>Seleccionar y recortar visualmente</h2>
        </div>
        <p>
          Primero carga el video, míralo y elige el tramo con IN y OUT. Sólo al confirmar se recorta una vez, se convierte a WebM/VP9 y se descarta el original.
        </p>
      </div>

      {currentPreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>Preview publicado en el borrador actual</strong>
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
            disabled={busy || sourceBusy}
            onChange={(event) => {
              resetPreparedSource();
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
            <span>Archivo de video</span>
            <input
              ref={fileInput}
              type="file"
              name="video"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi"
              disabled={busy || sourceBusy}
              onChange={handleLocalFile}
            />
            <small>
              MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB. La vista previa se reproduce directamente desde tu equipo y no se sube hasta que confirmas el recorte.
            </small>
          </label>
        ) : (
          <>
            <label className={styles.fieldWide}>
              <span>URL directa del video</span>
              <input
                type="url"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  if (
                    preparedSource?.mode === "url"
                  ) {
                    resetPreparedSource();
                  }
                  setSourceUrl(event.target.value);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="https://cdn.example/video.mp4"
              />
              <small>
                Debe ser un enlace HTTPS público al archivo de video. DeUna lo descarga una vez a staging privado para que puedas reproducirlo y recortarlo sin depender del servidor externo durante la edición.
              </small>
            </label>

            <div className={styles.formActions}>
              <p>
                La URL se valida contra redes privadas/locales y redirecciones antes de descargarla. El staging vence automáticamente si abandonas la edición.
              </p>
              <button
                type="button"
                disabled={
                  busy ||
                  sourceBusy ||
                  !sourceUrl.trim()
                }
                onClick={prepareRemoteSource}
              >
                {sourceBusy
                  ? "Cargando vista previa…"
                  : "Cargar vista previa de la URL"}
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

        <div
          className={`${styles.tableSummary} ${styles.fieldWide}`}
        >
          <strong>Conversión final</strong>
          <span>
            El editor sólo decide el corte. Al confirmar, DeUna procesa exclusivamente ese tramo, elimina audio, subtítulos, datos y metadatos, y genera el WebM/VP9 ultraliviano usado por las tarjetas.
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
            El botón se habilita cuando existe una fuente reproducible y un tramo IN/OUT válido de hasta 30 segundos. El corte no se vuelve a calcular para los visitantes: se hace una única vez al guardar.
          </p>
          <button
            type="submit"
            disabled={
              busy ||
              sourceBusy ||
              !preparedSource ||
              !trim
            }
          >
            {busy
              ? "Recortando y convirtiendo…"
              : currentPreview
                ? "Reemplazar con este recorte"
                : "Crear preview con este recorte"}
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
