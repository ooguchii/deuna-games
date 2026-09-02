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
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_SOURCE_BYTES,
  PREVIEW_HERO_QUALITY_OPTIONS,
  PREVIEW_QUALITY_OPTIONS,
  type PreviewQualityId,
  type PreviewTrimWindow,
  type PreviewViewport,
} from "@/lib/media/preview-video-policy";
import type {
  GameVideoMedia,
  GameVideoViewport,
} from "@/types/game";

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
type VideoTarget = "hero" | "card";
type EditorMode = "source" | "layout";
type LayoutSource = "hero" | "independent";

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

type VideoConfigResponse = {
  revision?: unknown;
  videoMedia?: unknown;
  legacyPreviewClip?: unknown;
  error?: unknown;
};

type LoadedVideoConfig = {
  revision: number;
  videoMedia?: GameVideoMedia;
  legacyPreviewClip?: string;
};

type Props = {
  slug: string;
  revision: number;
  currentPreview?: string;
  focusedTarget?: VideoTarget;
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

function layoutPath(slug: string) {
  return `/api/admin/content/games/${encodeURIComponent(slug)}/preview-layout`;
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
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.addEventListener("loadeddata", () => finish(true), { once: true });
    video.addEventListener("error", () => finish(false), { once: true });
    video.src = src;
    video.load();
  });
}

function validLocalFile(file: File) {
  const extensionOk = acceptedExtensions.test(file.name);
  return !(file.size <= 0 || file.size > MAX_PREVIEW_SOURCE_BYTES || (!extensionOk && file.type && !acceptedTypes.has(file.type.toLowerCase())));
}

function validViewport(value: unknown): value is GameVideoViewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as Partial<GameVideoViewport>;
  return (
    typeof viewport.x === "number" && viewport.x >= 0 && viewport.x <= 1 &&
    typeof viewport.y === "number" && viewport.y >= 0 && viewport.y <= 1 &&
    typeof viewport.zoom === "number" && viewport.zoom >= 1 && viewport.zoom <= 3 &&
    (viewport.aspect === "source" || viewport.aspect === "16:9" || viewport.aspect === "1:1" || viewport.aspect === "4:5" || viewport.aspect === "9:16")
  );
}

function parseVideoMedia(value: unknown): GameVideoMedia | undefined {
  if (!value || typeof value !== "object") return undefined;
  const media = value as {
    hero?: unknown;
    card?: unknown;
  };
  const result: GameVideoMedia = {};

  if (media.hero && typeof media.hero === "object") {
    const hero = media.hero as { clip?: unknown; viewport?: unknown };
    if (typeof hero.clip === "string" && validViewport(hero.viewport)) {
      result.hero = { clip: hero.clip, viewport: hero.viewport };
    }
  }

  if (media.card && typeof media.card === "object") {
    const card = media.card as { source?: unknown; clip?: unknown; viewport?: unknown };
    if (card.source === "hero" && validViewport(card.viewport)) {
      result.card = { source: "hero", viewport: card.viewport };
    } else if (
      card.source === "independent" &&
      typeof card.clip === "string" &&
      validViewport(card.viewport)
    ) {
      result.card = {
        source: "independent",
        clip: card.clip,
        viewport: card.viewport,
      };
    }
  }

  return result.hero || result.card ? result : undefined;
}

function uploadError(state: string | null) {
  if (state === "conflicto") return "Otra pestaña guardó una revisión más reciente. Recarga el editor y vuelve a intentarlo.";
  if (state === "ffmpeg") return "FFmpeg no está disponible para crear el WebM optimizado.";
  if (state === "video-pesado") return "El WebM final no pudo quedar por debajo de 3 MB. Prueba un tramo más corto o una calidad menor.";
  if (state === "preview-recorte-invalido") return "El recorte no es válido. Ajusta IN y OUT.";
  if (state === "preview-calidad-invalida") return "La calidad elegida no es válida.";
  if (state === "preview-encuadre-invalido") return "El encuadre elegido no es válido. Restablécelo y vuelve a intentarlo.";
  if (state === "preview-destino-invalido") return "Ese destino de video no está disponible. Revisa primero el Hero o el video propio de la Card.";
  if (state === "preview-source-expirada") return "La fuente temporal venció. Prepárala otra vez.";
  if (state === "solicitud") return "La solicitud fue rechazada por seguridad. Recarga el editor.";
  return "No se pudo guardar el video editorial.";
}

function targetLabel(target: VideoTarget) {
  return target === "hero" ? "Hero de inicio" : "Card del juego";
}

function shortMediaPath(src: string) {
  const filename = src.split("/").filter(Boolean).at(-1) ?? src;
  if (filename.length <= 34) return filename;
  return `${filename.slice(0, 16)}…${filename.slice(-15)}`;
}

export default function GamePreviewClipUploadForm({
  slug,
  revision,
  currentPreview,
  focusedTarget,
}: Props) {
  const [config, setConfig] = useState<LoadedVideoConfig | null>(null);
  const [configBusy, setConfigBusy] = useState(true);
  const [activeTarget, setActiveTarget] = useState<VideoTarget | null>(focusedTarget ?? null);
  const [editorMode, setEditorMode] = useState<EditorMode | null>(focusedTarget ? "source" : null);
  const [layoutSource, setLayoutSource] = useState<LayoutSource | null>(null);
  const [layoutClip, setLayoutClip] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [sourceUrl, setSourceUrl] = useState("");
  const [preparedSource, setPreparedSource] = useState<PreparedSource | null>(null);
  const [trim, setTrim] = useState<PreviewTrimWindow | null>(null);
  const [quality, setQuality] = useState<PreviewQualityId>(DEFAULT_PREVIEW_QUALITY);
  const [viewport, setViewport] = useState<PreviewViewport>({ ...DEFAULT_PREVIEW_VIEWPORT });
  const [sourceBusy, setSourceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedProvider = sourceMode !== "file" && sourceMode !== "direct"
    ? getPreviewProvider(sourceMode)
    : null;
  const qualityOptions = activeTarget === "hero"
    ? PREVIEW_HERO_QUALITY_OPTIONS
    : PREVIEW_QUALITY_OPTIONS;
  const selectedQuality = qualityOptions.find((option) => option.id === quality)!;
  const normalizedRemoteUrl = useMemo(() => {
    if (sourceMode === "file") return null;
    if (sourceMode === "direct") return parseDirectVideoUrl(sourceUrl);
    return parsePreviewProviderUrl(sourceMode, sourceUrl);
  }, [sourceMode, sourceUrl]);
  const providerEmbed = useMemo(() => {
    if (!selectedProvider || !normalizedRemoteUrl || typeof window === "undefined") return null;
    return buildPreviewProviderEmbed(selectedProvider.id, normalizedRemoteUrl, window.location.hostname);
  }, [normalizedRemoteUrl, selectedProvider]);

  const hero = config?.videoMedia?.hero;
  const configuredCard = config?.videoMedia?.card;
  const legacyCardClip = config?.legacyPreviewClip ?? currentPreview;
  const cardSource = configuredCard?.source ?? (legacyCardClip ? "independent" : undefined);
  const cardClip = configuredCard?.source === "hero"
    ? hero?.clip
    : configuredCard?.source === "independent"
      ? configuredCard.clip
      : legacyCardClip;
  const cardViewport = configuredCard?.viewport ?? DEFAULT_PREVIEW_VIEWPORT;
  const staleConfig = config !== null && config.revision !== revision;
  const focusedClip = focusedTarget === "hero" ? hero?.clip : focusedTarget === "card" ? cardClip : null;
  const focusedViewport = focusedTarget === "hero" ? hero?.viewport : cardViewport;

  useEffect(() => {
    let cancelled = false;

    void fetch(layoutPath(slug), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json()) as VideoConfigResponse;
        if (!response.ok || typeof result.revision !== "number") {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "No se pudo cargar la configuración de Hero y Card."
          );
        }
        if (cancelled) return;
        setConfig({
          revision: result.revision,
          videoMedia: parseVideoMedia(result.videoMedia),
          legacyPreviewClip:
            typeof result.legacyPreviewClip === "string"
              ? result.legacyPreviewClip
              : undefined,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "No se pudo cargar la configuración de video.");
        }
      })
      .finally(() => {
        if (!cancelled) setConfigBusy(false);
      });

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
      } else {
        void fetch(stagedSourcePath(slug, source.token), {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [preparedSource, slug]);

  function resetPreparedSource() {
    setPreparedSource(null);
    setTrim(null);
  }

  function closeEditor() {
    resetPreparedSource();
    setActiveTarget(null);
    setEditorMode(null);
    setLayoutSource(null);
    setLayoutClip(null);
    setSourceUrl("");
    setStatus(null);
  }

  function openSourceEditor(target: VideoTarget) {
    resetPreparedSource();
    setActiveTarget(target);
    setEditorMode("source");
    setLayoutSource(null);
    setLayoutClip(null);
    setSourceMode("file");
    setSourceUrl("");
    setQuality(DEFAULT_PREVIEW_QUALITY);
    setViewport(
      target === "hero"
        ? hero?.viewport ?? { ...DEFAULT_PREVIEW_VIEWPORT }
        : cardViewport
    );
    setStatus(null);
  }

  function openLayoutEditor(
    target: VideoTarget,
    source: LayoutSource,
    clip: string,
    initialViewport: GameVideoViewport
  ) {
    resetPreparedSource();
    setActiveTarget(target);
    setEditorMode("layout");
    setLayoutSource(source);
    setLayoutClip(clip);
    setViewport({ ...initialViewport });
    setStatus(null);
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
    setPreparedSource({
      mode: "staged",
      src: proxySrc,
      label: `${file.name} · ${formatSize(file.size)} · proxy de edición`,
      token: result.token,
      bytes: result.bytes,
      delivery: "proxy",
    });
    setStatus("Proxy listo. El master final se generará desde el archivo original.");
  }

  async function prepareLocalFile(file: File) {
    setSourceBusy(true);
    const src = URL.createObjectURL(file);
    let keep = false;
    try {
      if (await probeBrowserPlayback(src)) {
        keep = true;
        setPreparedSource({
          mode: "file",
          src,
          label: `${file.name} · ${formatSize(file.size)}`,
          file,
        });
        setStatus("Archivo listo. Elige IN, OUT, encuadre y calidad; todavía no se subió el archivo grande.");
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
        body: new URLSearchParams({
          expectedRevision: String(revision),
          url: normalizedRemoteUrl,
        }),
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
        ? `${label} listo por streaming parcial. Al guardar se extrae únicamente el tramo elegido y se conserva el fotograma completo para permitir encuadres distintos.`
        : `${label} listo en modo compatible. La web pública nunca conservará ni consultará esta URL externa.`);
    } catch (error) {
      if (stagedToken) {
        void fetch(stagedSourcePath(slug, stagedToken), {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);
      }
      setStatus(error instanceof Error ? error.message : `No se pudo preparar ${label}.`);
    } finally {
      setSourceBusy(false);
    }
  }

  async function savePreparedVideo() {
    if (!activeTarget || !preparedSource || !trim) {
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
        "X-Deuna-Preview-Quality": quality,
        "X-Deuna-Preview-Target": activeTarget,
        "X-Deuna-Viewport-X": String(viewport.x),
        "X-Deuna-Viewport-Y": String(viewport.y),
        "X-Deuna-Viewport-Zoom": String(viewport.zoom),
        "X-Deuna-Viewport-Aspect": viewport.aspect,
      };
    } else {
      endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/preview-import`;
      body = new URLSearchParams({
        expectedRevision: String(revision),
        sourceToken: preparedSource.token,
        startSeconds: String(trim.startSeconds),
        endSeconds: String(trim.endSeconds),
        quality,
        viewportX: String(viewport.x),
        viewportY: String(viewport.y),
        viewportZoom: String(viewport.zoom),
        viewportAspect: viewport.aspect,
        target: activeTarget,
      });
      headers = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" };
    }

    setBusy(true);
    setStatus(preparedSource.mode === "staged" && preparedSource.delivery === "stream"
      ? `Extrayendo sólo ${trim.startSeconds}s → ${trim.endSeconds}s para ${targetLabel(activeTarget)} y generando calidad ${selectedQuality.label}…`
      : `Generando master ${selectedQuality.label} para ${targetLabel(activeTarget)} con el tramo ${trim.startSeconds}s → ${trim.endSeconds}s…`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers,
        body,
      });
      if (!response.ok) {
        throw new Error(response.status === 413
          ? "El video supera el límite máximo permitido."
          : "El servidor rechazó la creación del video editorial.");
      }
      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");
      if (resultState !== "preview-subido") throw new Error(uploadError(resultState));
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear el WebM.");
      setBusy(false);
    }
  }

  async function saveLayout() {
    if (!activeTarget || !layoutSource || !layoutClip) {
      setStatus("No hay un video disponible para guardar este encuadre.");
      return;
    }

    setBusy(true);
    setStatus(`Guardando sólo el encuadre de ${targetLabel(activeTarget)}; no se recodifica el video…`);
    try {
      const response = await fetch(layoutPath(slug), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({
          expectedRevision: String(revision),
          target: activeTarget,
          source: activeTarget === "hero" ? "hero" : layoutSource,
          viewportX: String(viewport.x),
          viewportY: String(viewport.y),
          viewportZoom: String(viewport.zoom),
          viewportAspect: viewport.aspect,
        }),
      });
      const resultUrl = new URL(response.url, window.location.href);
      const resultState = resultUrl.searchParams.get("estado");
      if (resultState !== "preview-diseno-guardado") {
        throw new Error(uploadError(resultState));
      }
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el encuadre.");
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sourceBusy || staleConfig) return;
    if (editorMode === "layout") {
      await saveLayout();
    } else {
      await savePreparedVideo();
    }
  }

  const editorOpen = Boolean(activeTarget && editorMode);
  const disableActions = busy || sourceBusy || configBusy || staleConfig;

  return (
    <section className={`${adminStyles.editorPanel} ${focusedTarget ? localStyles.focusedPanel : ""}`}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>{focusedTarget ? `VIDEO EDITORIAL · ${targetLabel(focusedTarget).toUpperCase()}` : "VIDEO EDITORIAL · HERO + CARD"}</span>
          <h2>{focusedTarget ? "Fuente, recorte y encuadre" : "Un master compartido cuando conviene, dos encuadres independientes"}</h2>
        </div>
        <p>
          {focusedTarget
            ? focusedTarget === "hero"
              ? "Crea o reemplaza el master del Hero. Su fotograma completo queda disponible para que Hero y Card guarden encuadres independientes."
              : "La Card puede compartir el WebM del Hero o usar uno propio. Cambiar sólo el encuadre actualiza metadata y no duplica el archivo."
            : "Hero y Card pueden usar exactamente el mismo WebM sin duplicarlo. También puedes dar a la Card un video propio. Posición, zoom y relación se guardan como metadata y no obligan a recodificar."}
        </p>
      </div>

      <div className={localStyles.workspace}>
        {focusedTarget ? (
          <article className={localStyles.focusedDestination}>
            <div className={localStyles.destinationHeading}>
              <div>
                <span>{focusedTarget === "hero" ? "HERO DE INICIO" : "CARD DEL JUEGO"}</span>
                <strong>{focusedClip ? shortMediaPath(focusedClip) : "Sin video asignado"}</strong>
              </div>
              <span className={focusedClip ? localStyles.statusReady : localStyles.statusEmpty}>{focusedClip ? "ASIGNADO" : "PENDIENTE"}</span>
            </div>
            <p>{focusedClip ? "Puedes editar el encuadre sin recodificar o preparar una fuente nueva para reemplazarlo." : "Prepara una fuente para crear el primer WebM interno de este destino."}</p>
            <div className={localStyles.destinationActions}>
              {focusedClip && focusedViewport && (
                <button type="button" disabled={disableActions} onClick={() => openLayoutEditor(focusedTarget, focusedTarget === "card" && cardSource === "hero" ? "hero" : focusedTarget === "card" ? "independent" : "hero", focusedClip, focusedViewport)}>
                  Editar encuadre actual
                </button>
              )}
              <button type="button" disabled={disableActions} onClick={() => openSourceEditor(focusedTarget)}>
                {focusedClip ? "Preparar otro video" : "Crear video"}
              </button>
            </div>
          </article>
        ) : (
        <div className={localStyles.destinationGrid}>
          <article className={localStyles.destinationCard}>
            <div className={localStyles.destinationHeading}>
              <div>
                <span>01 · HERO DE INICIO</span>
                <strong>{hero ? "Video configurado" : "Sin video"}</strong>
              </div>
              <span className={hero ? localStyles.statusReady : localStyles.statusEmpty}>
                {hero ? "LISTO" : "PENDIENTE"}
              </span>
            </div>
            <p>
              {hero
                ? "Master panorámico de mayor resolución. Su fotograma completo queda disponible para distintos encuadres."
                : "Crea primero el video del Hero si quieres que la Card pueda reutilizarlo sin otra copia."}
            </p>
            {hero && <small className={localStyles.mediaPath}>{hero.clip}</small>}
            <div className={localStyles.destinationActions}>
              {hero && (
                <button
                  type="button"
                  disabled={disableActions}
                  onClick={() => openLayoutEditor("hero", "hero", hero.clip, hero.viewport)}
                >
                  Editar encuadre
                </button>
              )}
              <button
                type="button"
                disabled={disableActions}
                onClick={() => openSourceEditor("hero")}
              >
                {hero ? "Reemplazar video" : "Crear video del Hero"}
              </button>
            </div>
          </article>

          <article className={localStyles.destinationCard}>
            <div className={localStyles.destinationHeading}>
              <div>
                <span>02 · CARD DEL JUEGO</span>
                <strong>
                  {cardSource === "hero"
                    ? "Comparte el video del Hero"
                    : cardClip
                      ? "Usa video propio"
                      : "Sin video"}
                </strong>
              </div>
              <span className={cardClip ? localStyles.statusReady : localStyles.statusEmpty}>
                {cardClip ? "LISTO" : "PENDIENTE"}
              </span>
            </div>
            <p>
              La Card puede reutilizar exactamente los bytes del Hero y guardar sólo otro encuadre, o conservar un WebM independiente cuando el contenido debe ser diferente.
            </p>
            {cardClip && <small className={localStyles.mediaPath}>{cardClip}</small>}

            <div className={localStyles.cardSourceChoices}>
              <button
                type="button"
                className={cardSource === "hero" ? localStyles.choiceActive : ""}
                disabled={disableActions || !hero}
                onClick={() => {
                  if (hero) {
                    openLayoutEditor("card", "hero", hero.clip, cardViewport);
                  }
                }}
              >
                <strong>Usar video del Hero</strong>
                <span>0 copias extra · encuadre propio</span>
              </button>
              <button
                type="button"
                className={cardSource === "independent" ? localStyles.choiceActive : ""}
                disabled={disableActions}
                onClick={() => {
                  const independentClip = configuredCard?.source === "independent"
                    ? configuredCard.clip
                    : legacyCardClip;
                  if (independentClip) {
                    openLayoutEditor("card", "independent", independentClip, cardViewport);
                  } else {
                    openSourceEditor("card");
                  }
                }}
              >
                <strong>Usar video propio</strong>
                <span>{legacyCardClip ? "Video anterior disponible" : "Elegir otra fuente"}</span>
              </button>
            </div>

            <div className={localStyles.destinationActions}>
              {cardClip && (
                <button
                  type="button"
                  disabled={disableActions}
                  onClick={() => openLayoutEditor(
                    "card",
                    cardSource === "hero" ? "hero" : "independent",
                    cardClip,
                    cardViewport
                  )}
                >
                  Editar encuadre
                </button>
              )}
              <button
                type="button"
                disabled={disableActions}
                onClick={() => openSourceEditor("card")}
              >
                {cardSource === "independent" && cardClip
                  ? "Reemplazar video propio"
                  : "Elegir otro video"}
              </button>
            </div>
          </article>
        </div>
        )}

        {configBusy && (
          <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="status">
            <strong>Cargando configuración</strong>
            <span>Comprobando si Hero y Card comparten archivo o usan masters independientes…</span>
          </div>
        )}

        {staleConfig && (
          <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="alert">
            <strong>La revisión cambió</strong>
            <span>La configuración multimedia es más reciente que esta pantalla. Recarga antes de guardar para evitar sobrescribir cambios.</span>
          </div>
        )}

        {editorOpen && (
          <form className={adminStyles.editorForm} onSubmit={handleSubmit}>
            <div className={`${localStyles.editorModeHeader} ${adminStyles.fieldWide}`}>
              <div>
                <span>{editorMode === "layout" ? "ENCUADRE SIN RECODIFICAR" : "EDITOR DE FUENTE"}</span>
                <strong>{activeTarget ? targetLabel(activeTarget) : "Video"}</strong>
                <small>
                  {editorMode === "layout"
                    ? "Sólo cambiarán X, Y, zoom y relación. El WebM físico permanece intacto."
                    : `Calidad ${selectedQuality.label} · master hasta ${selectedQuality.targetWidth} px · ${selectedQuality.targetFps} FPS`}
                </small>
              </div>
              <button type="button" disabled={busy || sourceBusy} onClick={closeEditor}>
                Cerrar editor
              </button>
            </div>

            {editorMode === "layout" && layoutClip ? (
              <div className={adminStyles.fieldWide}>
                <VideoTrimEditor
                  key={`layout:${activeTarget}:${layoutSource}:${layoutClip}`}
                  src={layoutClip}
                  sourceLabel={`${targetLabel(activeTarget!)} · ${layoutSource === "hero" && activeTarget === "card" ? "mismo WebM del Hero" : "master actual"}`}
                  quality={quality}
                  viewport={viewport}
                  qualityDisabled={busy}
                  layoutOnly
                  onQualityChange={setQuality}
                  onViewportChange={setViewport}
                  onTrimChange={setTrim}
                />
              </div>
            ) : (
              <>
                {!preparedSource && (
                  <div className={`${localStyles.sourceGrid} ${adminStyles.fieldWide}`} aria-label="Tipos de fuente de video">
                    <button type="button" className={`${localStyles.sourceButton} ${sourceMode === "file" ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode("file")} disabled={busy || sourceBusy}>Archivo de mi equipo</button>
                    <button type="button" className={`${localStyles.sourceButton} ${sourceMode === "direct" ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode("direct")} disabled={busy || sourceBusy}>URL directa</button>
                    {providerOptions.map((provider) => (
                      <button key={provider.id} type="button" className={`${localStyles.sourceButton} ${sourceMode === provider.id ? localStyles.sourceButtonActive : ""}`} onClick={() => switchSourceMode(provider.id)} disabled={busy || sourceBusy}>
                        {provider.label}
                      </button>
                    ))}
                  </div>
                )}

                {!preparedSource && sourceMode === "file" && (
                  <label className={adminStyles.fieldWide}>
                    <span>Archivo · máximo 1 GB</span>
                    <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.m4v,.mkv,.avi" disabled={busy || sourceBusy} onChange={handleLocalFile} />
                    <small>Se edita localmente si el navegador soporta el códec; si no, se crea un proxy privado.</small>
                  </label>
                )}

                {!preparedSource && sourceMode !== "file" && (
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
                        onChange={(event) => {
                          setSourceUrl(event.target.value);
                          resetPreparedSource();
                          setStatus(null);
                        }}
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
                          {selectedProvider.label} no ofrece aquí un reproductor web controlable y estable. Se intentará primero una fuente HTTP parcial y sólo después el fallback privado completo.
                        </div>
                      )
                    )}

                    <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
                      <strong>Preparar esta fuente</strong>
                      <span>{sourceMode === "direct"
                        ? "Primero se prueba acceso parcial por bytes con protección SSRF. La descarga completa queda sólo como fallback."
                        : `La ruta de ${selectedProvider?.label} intenta resolver un stream HTTP seekable sin descargarlo; conserva el fallback temporal si la plataforma no lo permite.`}</span>
                      <button type="button" disabled={busy || sourceBusy || !normalizedRemoteUrl} onClick={() => void prepareRemoteSource()}>
                        {sourceBusy ? "Preparando…" : `Preparar ${selectedProvider?.label ?? "URL directa"} para editar`}
                      </button>
                    </div>
                  </>
                )}

                {preparedSource && (
                  <div className={adminStyles.fieldWide}>
                    <VideoTrimEditor
                      key={`source:${activeTarget}:${preparedSource.src}`}
                      src={preparedSource.src}
                      sourceLabel={preparedSource.label}
                      quality={quality}
                      qualityOptions={qualityOptions}
                      viewport={viewport}
                      qualityDisabled={busy || sourceBusy}
                      onQualityChange={setQuality}
                      onViewportChange={setViewport}
                      onTrimChange={setTrim}
                    />
                  </div>
                )}
              </>
            )}

            {status && (
              <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="status" aria-live="polite">
                <strong>Estado</strong>
                <span>{status}</span>
              </div>
            )}

            <div className={adminStyles.formActions}>
              <p>
                {editorMode === "layout"
                  ? "Guardar encuadre sólo actualiza metadata. No crea archivos, no ejecuta FFmpeg y no duplica el master."
                  : "El master publicado es WebM/VP9 interno, silencioso, de hasta 30 segundos y máximo 3 MB. El fotograma completo se conserva para permitir distintos encuadres."}
              </p>
              <button
                type="submit"
                disabled={busy || sourceBusy || staleConfig || (editorMode === "source" && (!trim || !preparedSource))}
              >
                {busy
                  ? "Guardando…"
                  : editorMode === "layout"
                    ? "Guardar encuadre"
                    : `Crear video · ${selectedQuality.label}`}
              </button>
            </div>
          </form>
        )}

        {!editorOpen && status && (
          <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`} role="status" aria-live="polite">
            <strong>Estado</strong>
            <span>{status}</span>
          </div>
        )}

        <div className={localStyles.removeGrid}>
          {hero && (!focusedTarget || focusedTarget === "hero") && (
            <form method="post" action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`} className={adminStyles.formActions}>
              <input type="hidden" name="expectedRevision" value={revision} />
              <input type="hidden" name="target" value="hero" />
              <p>Quita el video del Hero. Si la Card lo comparte, se conservará un video propio anterior cuando exista.</p>
              <button type="submit" disabled={disableActions}>Quitar Hero</button>
            </form>
          )}
          {cardClip && (!focusedTarget || focusedTarget === "card") && (
            <form method="post" action={`/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`} className={adminStyles.formActions}>
              <input type="hidden" name="expectedRevision" value={revision} />
              <input type="hidden" name="target" value="card" />
              <p>Quita el video de la Card sin modificar el master del Hero.</p>
              <button type="submit" disabled={disableActions}>Quitar Card</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
