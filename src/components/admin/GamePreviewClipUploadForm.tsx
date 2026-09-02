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
  buildPreviewProviderEmbed,
  getPreviewProvider,
  parseDirectVideoUrl,
  parsePreviewProviderUrl,
  previewProviderList,
  type PreviewProviderId,
} from "@/lib/media/preview-providers";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
} from "@/lib/media/preview-video-policy";

import adminStyles from "../../app/admin/admin.module.css";
import localStyles from "./GamePreviewClipUploadForm.module.css";

const acceptedTypes = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
  "video/x-matroska", "video/avi", "video/x-msvideo",
]);
const acceptedExtensions = /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const MEDIA_PROBE_TIMEOUT_MS = 10_000;

type SourceMode = "file" | "direct" | PreviewProviderId;
type RemoteDelivery = "stream" | "staged" | "proxy";

type PreparedSource =
  | { mode: "file"; src: string; label: string; file: File }
  | { mode: "staged"; src: string; label: string; token: string; bytes: number; delivery: RemoteDelivery };

type StagedSourceResponse = {
  token?: unknown;
  src?: unknown;
  bytes?: unknown;
  delivery?: unknown;
  durationSeconds?: unknown;
  error?: unknown;
  providerLabel?: unknown;
};

type ProxyResponse = { src?: unknown; error?: unknown };

type Props = {
  slug: string;
  revision: number;
  currentPreview?: string;
};

const providerOptions = previewProviderList();

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
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
    const timeout = window.setTimeout(() => finish(false), MEDIA_PROBE_TIMEOUT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("canplay", () => finish(true), { once: true });
    video.addEventListener("error", () => finish(false), { once: true });
    video.src = src;
    video.load();
  });
}

function validLocalFile(file: File) {
  const extensionOk = acceptedExtensions.test(file.name);
  return !(file.size <= 0 || file.size > MAX_PREVIEW_SOURCE_BYTES || (!extensionOk && file.type && !acceptedTypes.has(file.type.toLowerCase())));
}

function uploadError(state: string | null) {
  if (state === "conflicto") return "Otra pestaña guardó una revisión más reciente. Recarga el editor y vuelve a intentarlo.";
  if (state === "ffmpeg") return "FFmpeg no está disponible para crear el WebM optimizado.";
  if (state === "video-pesado") return "El WebM final no pudo quedar por debajo de 3 MB. Elige un tramo más corto o con menos movimiento.";
  if (state === "preview-recorte-invalido") return "El recorte no es válido. Ajusta IN y OUT.";
  if (state === "preview-source-expirada") return "La fuente temporal venció. Prepárala otra vez.";
  if (state === "solicitud") return "La solicitud fue rechazada por seguridad. Recarga el editor.";
  return "No se pudo guardar el preview de la tarjeta.";
}

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
}: Props) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [sourceUrl, setSourceUrl] = useState("");
  const [preparedSource, setPreparedSource] = useState<PreparedSource | null>(null);
  const [trim, setTrim] = useState<PreviewTrimWindow | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedProvider = sourceMode !== "file" && sourceMode !== "direct"
    ? getPreviewProvider(sourceMode)
    : null;
  const normalizedRemoteUrl = useMemo(() => {
    if (sourceMode === "file") return null;
    if (sourceMode === "direct") return parseDirectVideoUrl(sourceUrl);
    return parsePreviewProviderUrl(sourceMode, sourceUrl);
  }, [sourceMode, sourceUrl]);
  const providerEmbed = useMemo(() => {
    if (!selectedProvider || !normalizedRemoteUrl || typeof window === "undefined") return null;
    return buildPreviewProviderEmbed(selectedProvider.id, normalizedRemoteUrl, window.location.hostname);
  }, [normalizedRemoteUrl, selectedProvider]);

  useEffect(() => {
    const source = preparedSource;
    return () => {
      if (!source) return;
      if (source.mode === "file") {
        URL.revokeObjectURL(source.src);
      } else {
        void fetch(stagedSourcePath(slug, source.token), {
          method: "DELETE", credentials: "same-origin", cache: "no-store", keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [preparedSource, slug]);

  function resetPreparedSource() {
    setPreparedSource(null);
    setTrim(null);
  }

  function switchSourceMode(mode: SourceMode) {
    resetPreparedSource();
    setSourceMode(mode);
    setSourceUrl("");
    setStatus(null);
  }

  async function createProxyForStagedToken(token: string) {
    const response = await fetch(`${stagedSourcePath(slug, token)}/proxy`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ expectedRevision: String(revision) }),
    });
    const result = (await response.json()) as ProxyResponse;
    if (!response.ok || typeof result.src !== "string") {
      throw new Error(typeof result.error === "string" ? result.error : "No se pudo crear un proxy compatible para editar.");
    }
    return result.src;
  }

  async function prepareLocalCodecFallback(file: File) {
    setStatus(`Este códec no se reproduce directamente. Subiendo ${formatSize(file.size)} y creando un proxy privado de edición…`);
    const response = await fetch(`/api/admin/content/games/${encodeURIComponent(slug)}/preview-source-upload`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Deuna-Expected-Revision": String(revision),
        "X-Deuna-Source-Extension": sourceExtension(file.name),
      },
      body: file,
    });
    const result = (await response.json()) as StagedSourceResponse;
    if (!response.ok || typeof result.token !== "string" || typeof result.src !== "string" || typeof result.bytes !== "number") {
      throw new Error(typeof result.error === "string" ? result.error : "No se pudo preparar el archivo.");
    }
    const proxySrc = await createProxyForStagedToken(result.token);
    setPreparedSource({ mode: "staged", src: proxySrc, label: `${file.name} · ${formatSize(file.size)} · proxy de edición`, token: result.token, bytes: result.bytes, delivery: "proxy" });
    setStatus("Proxy listo. El WebM final se generará desde el archivo original.");
  }

  async function prepareLocalFile(file: File) {
    setSourceBusy(true);
    const src = URL.createObjectURL(file);
    let keep = false;
    try {
      if (await probeBrowserPlayback(src)) {
        keep = true;
        setPreparedSource({ mode: "file", src, label: `${file.name} · ${formatSize(file.size)}`, file });
        setStatus("Archivo listo. Elige IN y OUT; todavía no se subió el archivo grande.");
      } else {
        await prepareLocalCodecFallback(file);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo preparar el archivo.");
    } finally {
      if (!keep) URL.revokeObjectURL(src);
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

  async function prepareRemoteSource() {
    if (sourceMode === "file" || sourceBusy || busy) return;
    if (!normalizedRemoteUrl) {
      setStatus(sourceMode === "direct"
        ? "Pega una URL HTTP/HTTPS directa a un archivo o stream de video."
        : `Ese enlace no pertenece al formato aceptado por ${selectedProvider?.label ?? "la plataforma elegida"}.`);
      return;
    }

    resetPreparedSource();
    setSourceBusy(true);
    const label = selectedProvider?.label ?? "URL directa";
    setStatus(`Analizando ${label} sin descargar el video completo…`);
    let stagedToken: string | null = null;

    try {
      const endpoint = sourceMode === "direct"
        ? `/api/admin/content/games/${encodeURIComponent(slug)}/preview-direct`
        : `/api/admin/content/games/${encodeURIComponent(slug)}/preview-provider/${encodeURIComponent(sourceMode)}`;
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ expectedRevision: String(revision), url: normalizedRemoteUrl }),
      });
      const result = (await response.json()) as StagedSourceResponse;
      if (!response.ok || typeof result.token !== "string" || typeof result.src !== "string" || typeof result.bytes !== "number") {
        throw new Error(typeof result.error === "string" ? result.error : `No se pudo preparar ${label}.`);
      }
      stagedToken = result.token;
      const lazyDelivery = result.delivery === "stream";
      let editorSrc = result.src;
      let delivery: RemoteDelivery = lazyDelivery ? "stream" : "staged";
      if (!(await probeBrowserPlayback(editorSrc))) {
        setStatus(`${label} no pudo editarse por streaming/códec directo. Activando la copia completa de compatibilidad y un proxy WebM…`);
        editorSrc = await createProxyForStagedToken(result.token);
        delivery = "proxy";
      }
      setPreparedSource({
        mode: "staged",
        src: editorSrc,
        label: `${label} · ${formatSize(result.bytes)} de fuente${delivery === "stream" ? " · streaming parcial" : delivery === "proxy" ? " · proxy de compatibilidad" : " · copia temporal"}`,
        token: result.token,
        bytes: result.bytes,
        delivery,
      });
      stagedToken = null;
      setStatus(delivery === "stream"
        ? `${label} listo por streaming parcial. IN/OUT sólo navega por bloques; al guardar se obtiene únicamente el tramo elegido. Si el origen falla, DeUna conserva el fallback completo.`
        : `${label} listo en modo compatible. La tarjeta final no conservará ni consultará esta URL.`);
    } catch (error) {
      if (stagedToken) {
        void fetch(stagedSourcePath(slug, stagedToken), { method: "DELETE", credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
      }
      setStatus(error instanceof Error ? error.message : `No se pudo preparar ${label}.`);
    } finally {
      setSourceBusy(false);
    }
  }

  async function savePreparedPreview() {
    if (!preparedSource || !trim) {
      setStatus("Prepara la fuente y selecciona un tramo válido con IN y OUT.");
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
    } else {
      endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
      body = new URLSearchParams({
        expectedRevision: String(revision), sourceToken: preparedSource.token,
        startSeconds: String(trim.startSeconds), endSeconds: String(trim.endSeconds),
      });
      headers = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" };
    }

    setBusy(true);
    setStatus(preparedSource.mode === "staged" && preparedSource.delivery === "stream"
      ? `Extrayendo sólo ${trim.startSeconds}s → ${trim.endSeconds}s y generando el WebM interno…`
      : `Generando WebM interno con el tramo ${trim.startSeconds}s → ${trim.endSeconds}s…`);
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers, body });
      if (!response.ok) throw new Error(response.status === 413 ? "El video supera el límite máximo permitido." : "El servidor rechazó la creación del preview.");
      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");
      if (resultState !== "preview-subido") throw new Error(uploadError(resultState));
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear el WebM.");
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && !sourceBusy) await savePreparedPreview();
  }

  return (
    <section className={adminStyles.editorPanel}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>PREVIEW DE TARJETAS · FUENTES AISLADAS</span>
          <h2>Elige primero el origen</h2>
        </div>
        <p>
          No hay detección automática. Cada botón abre un flujo exclusivo para esa fuente; cuando es posible DeUna previsualiza por rangos y evita descargar el video completo.
        </p>
      </div>

      <div className={localStyles.workspace}>
        <div className={localStyles.sourceGrid} aria-label="Tipos de fuente de video">
          <button type="button" className={`${localStyles.sourceButton} ${sourceMode === "file" ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode("file")} disabled={busy || sourceBusy}>Archivo de mi equipo</button>
          <button type="button" className={`${localStyles.sourceButton} ${sourceMode === "direct" ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode("direct")} disabled={busy || sourceBusy}>URL directa</button>
          {providerOptions.map((provider) => (
            <button key={provider.id} type="button" className={`${localStyles.sourceButton} ${sourceMode === provider.id ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode(provider.id)} disabled={busy || sourceBusy}>
              {provider.label}
            </button>
          ))}
        </div>

        {currentPreview && (
          <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
            <strong>Preview WebM activo</strong>
            <span>{currentPreview}</span>
            <video src={currentPreview} controls muted playsInline preload="metadata" style={{ width: "min(480px, 100%)", marginTop: 12, borderRadius: 10, background: "#05080d" }} />
          </div>
        )}

        <form className={adminStyles.editorForm} onSubmit={handleSubmit}>
          {sourceMode === "file" ? (
            <label className={adminStyles.fieldWide}>
              <span>Archivo · máximo 1 GB</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi" disabled={busy || sourceBusy} onChange={handleLocalFile} />
              <small>Se edita localmente si el navegador soporta el códec; de lo contrario se crea un proxy privado.</small>
            </label>
          ) : (
            <>
              <div className={`${localStyles.providerHeader} ${adminStyles.fieldWide}`}>
                <strong>{selectedProvider?.label ?? "URL directa"}</strong>
                <span className={localStyles.providerBadge}>{sourceMode === "direct" ? "archivo / stream" : "proveedor aislado"}</span>
              </div>
              <label className={adminStyles.fieldWide}>
                <span>{sourceMode === "direct" ? "URL HTTP/HTTPS del archivo o stream" : `URL de ${selectedProvider?.label}`}</span>
                <input
                  type="text"
                  inputMode="url"
                  value={sourceUrl}
                  disabled={busy || sourceBusy}
                  onChange={(event) => { setSourceUrl(event.target.value); resetPreparedSource(); setStatus(null); }}
                  maxLength={2048}
                  placeholder={sourceMode === "direct" ? "https://servidor/video.mp4" : selectedProvider?.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
                <small>{sourceMode === "direct" ? "Debe devolver bytes de video; una página HTML será rechazada." : `Sólo se acepta ${selectedProvider?.label}. Una URL de otra red será rechazada antes de cualquier importación.`}</small>
              </label>

              {normalizedRemoteUrl && selectedProvider && (
                providerEmbed ? (
                  <div className={`${localStyles.embedStage} ${adminStyles.fieldWide}`}>
                    <iframe
                      src={providerEmbed.src}
                      title={providerEmbed.title}
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                ) : (
                  <div className={`${localStyles.nativeNotice} ${adminStyles.fieldWide}`}>
                    {selectedProvider.label} no ofrece aquí un reproductor web controlable y estable. DeUna intentará primero una fuente HTTP parcial; sólo si no es posible usará la copia privada completa de compatibilidad.
                  </div>
                )
              )}

              <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
                <strong>Preparar esta fuente</strong>
                <span>{sourceMode === "direct"
                  ? "Primero se prueba acceso parcial por bytes con protección SSRF. La descarga completa de hasta 1 GB queda sólo como fallback."
                  : `La ruta de ${selectedProvider?.label} intenta resolver un stream HTTP seekable sin descargarlo; si la plataforma no lo permite, conserva el fallback temporal de hasta 512 MB.`}</span>
                <button type="button" disabled={busy || sourceBusy || !normalizedRemoteUrl} onClick={() => void prepareRemoteSource()}>
                  {sourceBusy ? "Preparando…" : `Preparar ${selectedProvider?.label ?? "URL directa"} para recortar`}
                </button>
              </div>

              {sourceUrl.trim() && !normalizedRemoteUrl && (
                <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="status">
                  <strong>URL rechazada para esta opción</strong>
                  <span>{sourceMode === "direct" ? "Revisa que sea una URL HTTP/HTTPS pública." : `Esta entrada acepta únicamente enlaces válidos de ${selectedProvider?.label}.`}</span>
                </div>
              )}
            </>
          )}

          {preparedSource && (
            <div className={adminStyles.fieldWide}>
              <div className={localStyles.divider} />
              <VideoTrimEditor key={preparedSource.src} src={preparedSource.src} sourceLabel={preparedSource.label} onTrimChange={setTrim} />
            </div>
          )}

          {status && (
            <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="status" aria-live="polite">
              <strong>Estado</strong><span>{status}</span>
            </div>
          )}

          <div className={adminStyles.formActions}>
            <p>El resultado publicado siempre es un WebM/VP9 interno de DeUna, silencioso y de hasta 30 segundos.</p>
            <button type="submit" disabled={busy || sourceBusy || !trim || !preparedSource}>
              {busy ? "Recortando y convirtiendo…" : "Crear preview WebM con este recorte"}
            </button>
          </div>
        </form>

        {currentPreview && (
          <form method="post" action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`} className={adminStyles.formActions}>
            <input type="hidden" name="expectedRevision" value={revision} />
            <p>Elimina el preview WebM activo.</p>
            <button type="submit">Quitar preview</button>
          </form>
        )}
      </div>
    </section>
  );
}
