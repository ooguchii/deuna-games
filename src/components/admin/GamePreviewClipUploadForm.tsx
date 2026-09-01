"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import YouTubeTrimEditor from "@/components/admin/YouTubeTrimEditor";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";
import {
  parseYouTubeVideo,
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
};

type PreviewSettings = {
  revision: number;
  mode: GamePreviewMode | null;
  previewClip: string | null;
  youtubePreview: GameYouTubePreview | null;
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

function youtubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function uploadError(state: string | null) {
  if (state === "conflicto") {
    return "Otra pestaña guardó una revisión más reciente. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "ffmpeg") {
    return "FFmpeg no está disponible en este servidor. Sólo hace falta para crear WebM locales; YouTube directo no usa FFmpeg.";
  }
  if (state === "video-pesado") {
    return "El WebM final no pudo quedar por debajo del límite de 3 MB. Elige un tramo con menos movimiento o de menor duración.";
  }
  if (state === "preview-recorte-invalido") {
    return "El video o el recorte no son válidos. Ajusta IN y OUT y vuelve a intentarlo.";
  }
  if (state === "preview-source-expirada") {
    return "La vista previa remota venció. Vuelve a cargar la URL directa y selecciona el tramo otra vez.";
  }
  if (state === "solicitud") {
    return "La solicitud fue rechazada por seguridad. Recarga el editor y vuelve a intentarlo.";
  }
  if (state === "video-invalido") {
    return "El archivo no pudo decodificarse como video compatible.";
  }
  return "No se pudo guardar el preview de la tarjeta.";
}

function validLocalFile(file: File) {
  const extensionOk =
    /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name);

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

function settingsFromUnknown(value: unknown): PreviewSettings | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.revision)) return null;

  const mode =
    record.mode === "webm" || record.mode === "youtube"
      ? record.mode
      : null;
  const previewClip =
    typeof record.previewClip === "string"
      ? record.previewClip
      : null;
  const youtube = record.youtubePreview;
  let youtubePreview: GameYouTubePreview | null = null;

  if (typeof youtube === "object" && youtube !== null) {
    const source = youtube as Record<string, unknown>;
    if (
      typeof source.videoId === "string" &&
      typeof source.startSeconds === "number" &&
      typeof source.endSeconds === "number" &&
      parsePreviewTrimWindow(
        String(source.startSeconds),
        String(source.endSeconds)
      )
    ) {
      youtubePreview = {
        videoId: source.videoId,
        startSeconds: source.startSeconds,
        endSeconds: source.endSeconds,
      };
    }
  }

  return {
    revision: record.revision as number,
    mode,
    previewClip,
    youtubePreview,
  };
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
  const [youtubeInput, setYoutubeInput] = useState("");
  const [preparedSource, setPreparedSource] =
    useState<PreparedSource | null>(null);
  const [trim, setTrim] =
    useState<PreviewTrimWindow | null>(null);
  const [settings, setSettings] = useState<PreviewSettings>({
    revision,
    mode: currentPreview ? "webm" : null,
    previewClip: currentPreview ?? null,
    youtubePreview: null,
  });
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const parsedYouTube = useMemo(
    () => parseYouTubeVideo(youtubeInput),
    [youtubeInput]
  );
  const configuredYouTubeTrim = useMemo(
    () => {
      const preview = settings.youtubePreview;
      return preview
        ? parsePreviewTrimWindow(
            String(preview.startSeconds),
            String(preview.endSeconds)
          )
        : null;
    },
    [settings.youtubePreview]
  );

  useEffect(() => {
    let cancelled = false;

    void fetch(
      `/api/admin/content/games/${encodeURIComponent(slug)}/preview-settings`,
      {
        credentials: "same-origin",
        cache: "no-store",
      }
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return settingsFromUnknown(await response.json());
      })
      .then((next) => {
        if (!cancelled && next) setSettings(next);
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
      !youtubeInput &&
      settings.youtubePreview
    ) {
      setYoutubeInput(
        youtubeUrl(settings.youtubePreview.videoId)
      );
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

    const youtube = parseYouTubeVideo(sourceUrl);
    if (youtube) {
      resetPreparedSource();
      setYoutubeInput(youtube.canonicalUrl);
      setSourceMode("youtube");
      setStatus(
        "Detecté un enlace de YouTube. Lo pasé al modo YouTube directo: no se descargará ni se convertirá."
      );
      return;
    }

    const parsedUrl = parsePublicHttpsUrl(sourceUrl);

    if (!parsedUrl) {
      setStatus(
        "Usa una URL HTTPS pública que entregue directamente un archivo de video, o cambia a YouTube para enlaces de youtube.com/youtu.be."
      );
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    setStatus(
      "Descargando temporalmente el archivo remoto para poder previsualizarlo antes de crear el WebM…"
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
            expectedRevision: String(settings.revision),
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
        "Vista previa remota lista. El original es temporal; al confirmar sólo se conserva el WebM optimizado."
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

  async function useClipboardYouTube() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseYouTubeVideo(text);

      if (!parsed) {
        setStatus(
          "El portapapeles no contiene un enlace o ID de video de YouTube compatible."
        );
        return;
      }

      setYoutubeInput(parsed.canonicalUrl);
      setStatus(
        "Enlace de YouTube cargado desde el portapapeles. Ahora elige IN y OUT."
      );
    } catch {
      setStatus(
        "El navegador no permitió leer el portapapeles. Puedes pegar el enlace normalmente en el campo."
      );
    }
  }

  function openYouTubeSearch() {
    const query = encodeURIComponent("gameplay PC juego");
    window.open(
      `https://www.youtube.com/results?search_query=${query}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (busy || sourceBusy) return;

    if (!trim) {
      setStatus(
        "Selecciona un tramo válido con los marcadores IN y OUT."
      );
      return;
    }

    let endpoint: string;
    let body: FormData | URLSearchParams;
    let headers: HeadersInit | undefined;

    if (sourceMode === "youtube") {
      if (!parsedYouTube) {
        setStatus("Introduce primero un video válido de YouTube.");
        return;
      }

      endpoint =
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-youtube`;
      body = new URLSearchParams({
        expectedRevision: String(settings.revision),
        youtubeUrl: parsedYouTube.canonicalUrl,
        startSeconds: String(trim.startSeconds),
        endSeconds: String(trim.endSeconds),
      });
      headers = {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
      };
      setStatus(
        "Guardando ID de YouTube e intervalo. No se descarga ni se convierte el video…"
      );
    } else {
      if (!preparedSource) {
        setStatus(
          sourceMode === "file"
            ? "Selecciona primero un archivo para ver la preview y elegir el corte."
            : "Carga primero la URL directa para ver la preview y elegir el corte."
        );
        return;
      }

      if (preparedSource.mode === "file") {
        const upload = new FormData();
        upload.set("expectedRevision", String(settings.revision));
        upload.set("startSeconds", String(trim.startSeconds));
        upload.set("endSeconds", String(trim.endSeconds));
        upload.set("video", preparedSource.file);

        endpoint =
          `/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`;
        body = upload;
      } else {
        endpoint =
          `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
        body = new URLSearchParams({
          expectedRevision: String(settings.revision),
          sourceToken: preparedSource.token,
          startSeconds: String(trim.startSeconds),
          endSeconds: String(trim.endSeconds),
        });
        headers = {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        };
      }

      setStatus(
        `Recortando ${trim.startSeconds}s → ${trim.endSeconds}s y generando WebM/VP9 optimizado…`
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

  const youtubeInitialTrim =
    parsedYouTube &&
    settings.youtubePreview?.videoId === parsedYouTube.videoId
      ? configuredYouTubeTrim
      : null;

  return (
    <section className={styles.editorPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS</span>
          <h2>Origen y tramo de reproducción</h2>
        </div>
        <p>
          Puedes mantener un WebM local y un video de YouTube al mismo tiempo. Sólo uno queda activo en las tarjetas; cambiar de modo no destruye el otro.
        </p>
      </div>

      <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
        <strong>Origen activo</strong>
        <span>
          {settings.mode === "youtube"
            ? "YouTube directo · el tráfico de video lo entrega YouTube"
            : settings.mode === "webm"
              ? "WebM local optimizado · servido por DeUna"
              : "Sin preview activo"}
        </span>
      </div>

      {settings.previewClip && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>
            WebM local {settings.mode === "webm" ? "· ACTIVO" : "· guardado"}
          </strong>
          <span>{settings.previewClip}</span>
          <video
            src={settings.previewClip}
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
          {settings.mode !== "webm" && (
            <form
              method="post"
              action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-mode`}
              className={styles.formActions}
            >
              <input type="hidden" name="expectedRevision" value={settings.revision} />
              <input type="hidden" name="mode" value="webm" />
              <p>El WebM se conserva y puede volver a ser el origen público sin reconvertirlo.</p>
              <button type="submit">Usar WebM en tarjetas</button>
            </form>
          )}
        </div>
      )}

      {settings.youtubePreview && (
        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>
            YouTube {settings.mode === "youtube" ? "· ACTIVO" : "· guardado"}
          </strong>
          <span>
            {youtubeUrl(settings.youtubePreview.videoId)} · {settings.youtubePreview.startSeconds}s → {settings.youtubePreview.endSeconds}s
          </span>
          {settings.mode !== "youtube" && (
            <form
              method="post"
              action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-mode`}
              className={styles.formActions}
            >
              <input type="hidden" name="expectedRevision" value={settings.revision} />
              <input type="hidden" name="mode" value="youtube" />
              <p>Activar YouTube no elimina el WebM local que ya esté preparado.</p>
              <button type="submit">Usar YouTube en tarjetas</button>
            </form>
          )}
        </div>
      )}

      <form
        className={styles.editorForm}
        method="post"
        encType="multipart/form-data"
        action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-upload`}
        onSubmit={handleSubmit}
      >
        <label>
          <span>Preparar origen</span>
          <select
            value={sourceMode}
            disabled={busy || sourceBusy}
            onChange={(event) =>
              switchSourceMode(event.target.value as SourceMode)
            }
          >
            <option value="file">Archivo de mi equipo → WebM</option>
            <option value="url">URL directa HTTPS → WebM</option>
            <option value="youtube">YouTube directo</option>
          </select>
        </label>

        {sourceMode === "file" && (
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
              La preview se reproduce localmente antes de subirla. Sólo al confirmar se recorta y convierte una vez a WebM/VP9.
            </small>
          </label>
        )}

        {sourceMode === "url" && (
          <>
            <label className={styles.fieldWide}>
              <span>URL directa del archivo</span>
              <input
                type="url"
                inputMode="url"
                value={sourceUrl}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  if (preparedSource?.mode === "url") {
                    resetPreparedSource();
                  }
                  setSourceUrl(event.target.value);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="https://cdn.example/video.mp4"
              />
              <small>
                Para MP4/WebM/MOV directos. Si pegas YouTube aquí, DeUna lo detecta y cambia automáticamente al modo YouTube.
              </small>
            </label>

            <div className={styles.formActions}>
              <p>El archivo remoto sólo se mantiene temporalmente durante el recorte y la conversión.</p>
              <button
                type="button"
                disabled={busy || sourceBusy || !sourceUrl.trim()}
                onClick={prepareRemoteSource}
              >
                {sourceBusy
                  ? "Cargando vista previa…"
                  : "Cargar vista previa de la URL"}
              </button>
            </div>
          </>
        )}

        {sourceMode === "youtube" && (
          <>
            <label className={styles.fieldWide}>
              <span>Video de YouTube</span>
              <input
                type="text"
                inputMode="url"
                value={youtubeInput}
                disabled={busy || sourceBusy}
                onChange={(event) => {
                  setYoutubeInput(event.target.value);
                  setTrim(null);
                  setStatus(null);
                }}
                maxLength={2048}
                placeholder="https://youtu.be/... o ID del video"
              />
              <small>
                Se guarda sólo el ID y los segundos IN/OUT. El video no se descarga, no ocupa almacenamiento y no usa FFmpeg.
              </small>
            </label>

            <div className={styles.formActions}>
              <p>
                Abre YouTube en otra pestaña, elige el video y copia su enlace. Por seguridad del navegador una pestaña no puede leer qué video seleccionaste en la otra sin conectar una cuenta/API.
              </p>
              <button type="button" onClick={openYouTubeSearch}>
                Buscar en YouTube
              </button>
              <button type="button" onClick={useClipboardYouTube}>
                Usar enlace copiado
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
              onTrimChange={setTrim}
            />
          </div>
        )}

        {sourceMode === "youtube" && parsedYouTube && (
          <div className={styles.fieldWide}>
            <YouTubeTrimEditor
              key={parsedYouTube.videoId}
              videoId={parsedYouTube.videoId}
              sourceLabel={parsedYouTube.canonicalUrl}
              initialTrim={youtubeInitialTrim}
              onTrimChange={setTrim}
            />
          </div>
        )}

        {sourceMode === "youtube" && youtubeInput.trim() && !parsedYouTube && (
          <div className={`${styles.tableSummary} ${styles.fieldWide}`} role="alert">
            <strong>Enlace no reconocido</strong>
            <span>Usa un enlace normal de youtube.com, youtu.be, Shorts, Live o el ID de 11 caracteres.</span>
          </div>
        )}

        <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
          <strong>
            {sourceMode === "youtube" ? "Reproducción pública" : "Conversión final"}
          </strong>
          <span>
            {sourceMode === "youtube"
              ? "La card espera 1 segundo de hover y usa un único reproductor global reutilizable. No existe un iframe por tarjeta y no hay tráfico de YouTube antes de esa intención."
              : "El corte se procesa una sola vez a WebM/VP9 silencioso y ultraliviano. Los visitantes reciben sólo ese archivo final."}
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
            El tramo puede durar como máximo 30 segundos. Guardar este origen lo deja activo, pero conserva el otro origen si ya existe.
          </p>
          <button
            type="submit"
            disabled={
              busy ||
              sourceBusy ||
              !trim ||
              (sourceMode === "youtube"
                ? !parsedYouTube
                : !preparedSource)
            }
          >
            {busy
              ? sourceMode === "youtube"
                ? "Guardando YouTube…"
                : "Recortando y convirtiendo…"
              : sourceMode === "youtube"
                ? "Guardar y usar YouTube"
                : "Crear y usar WebM"}
          </button>
        </div>
      </form>

      {(settings.previewClip || settings.youtubePreview) && (
        <div className={styles.editorForm}>
          <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
            <strong>Eliminar orígenes guardados</strong>
            <span>
              Eliminar uno no afecta al otro. Si quitas el origen activo, DeUna cambia automáticamente al alternativo cuando existe.
            </span>
          </div>

          {settings.previewClip && (
            <form
              method="post"
              action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`}
              className={styles.formActions}
            >
              <input type="hidden" name="expectedRevision" value={settings.revision} />
              <p>Quitar sólo el WebM local.</p>
              <button type="submit">Quitar WebM</button>
            </form>
          )}

          {settings.youtubePreview && (
            <form
              method="post"
              action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-youtube-remove`}
              className={styles.formActions}
            >
              <input type="hidden" name="expectedRevision" value={settings.revision} />
              <p>Quitar sólo la configuración de YouTube.</p>
              <button type="submit">Quitar YouTube</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
