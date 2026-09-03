"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Clapperboard,
  FolderOpen,
  ImageIcon,
  Images,
  Info,
  MonitorPlay,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GameVideoViewportEditor from "@/components/admin/GameVideoViewportEditor";
import ImageViewportEditor from "@/components/admin/ImageViewportEditor";
import { REQUIRED_DESTINATION_ASPECTS } from "@/lib/media/game-media-requirements";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  GameCardVideo,
  GameCoverVideo,
  GameDestinationMediaMode,
  GameHeroVideo,
  GameImageMedia,
  GameImageViewport,
  GameVideoViewport,
} from "@/types/game";

import styles from "./GameMultimediaEditor.module.css";
import contextualStyles from "./GameMultimediaWorkspaceContextual.module.css";

type ResourceImage = {
  kind: "image";
  origin: "editorial" | "bundled";
  src: string;
  digest: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
};

type ResourceVideo = {
  kind: "video";
  origin: "editorial";
  src: string;
  digest: string;
  bytes: number;
};

type LibraryResource = ResourceImage | ResourceVideo;
type Destination = "cover" | "hero" | "card";
type EditLayer = "image" | "video";
type AddResourceKind = "image" | "video";

type LibraryState = {
  revision: number;
  resources: LibraryResource[];
  assignments: {
    coverImage: string | null;
    heroImage: string | null;
    cardImage: string | null;
    screenshots: string[];
    imageMedia: GameImageMedia | null;
    coverMode: GameDestinationMediaMode;
    heroMode: GameDestinationMediaMode;
    cardMode: GameDestinationMediaMode;
    coverVideo: GameCoverVideo | null;
    heroVideo: GameHeroVideo | null;
    cardVideo: GameCardVideo | null;
    legacyPreviewClip: string | null;
  };
};

type Props = {
  slug: string;
  revision: number;
  screenshotCount: number;
  initialCoverImage?: string;
  initialHeroImage?: string;
  initialScreenshots?: readonly string[];
  videoEditor: ReactNode;
};

type VideoEditorConfig = {
  target: Destination;
  source: "hero" | "independent";
  clip: string;
  viewport: GameVideoViewport;
  label: string;
};

const MODE_OPTIONS: Array<{
  value: GameDestinationMediaMode;
  label: string;
}> = [
  { value: "image", label: "Imagen" },
  { value: "video", label: "Video" },
  { value: "hover-video", label: "Imagen + hover" },
];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function shortName(src: string) {
  const filename = src.split("/").filter(Boolean).at(-1) ?? src;
  if (filename.length <= 22) return filename;
  return `${filename.slice(0, 10)}…${filename.slice(-9)}`;
}

function imageFormat(src: string) {
  const extension = src.split(".").at(-1)?.toUpperCase();
  return extension && extension.length <= 5 ? extension : "IMAGEN";
}

function imageMeta(resource: ResourceImage) {
  const size = formatBytes(resource.bytes);
  if (resource.width !== null && resource.height !== null) {
    return `${resource.width}×${resource.height} · ${size}`;
  }
  return `${imageFormat(resource.src)} existente · ${size}`;
}

function cardClip(state: LibraryState | null) {
  const card = state?.assignments.cardVideo;
  if (card?.source === "hero") {
    return state?.assignments.heroVideo?.clip ?? null;
  }
  if (card?.source === "independent") return card.clip;
  return state?.assignments.legacyPreviewClip ?? null;
}

function isViewport(value: unknown): value is GameImageViewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as Partial<GameImageViewport>;
  return (
    typeof viewport.x === "number" && viewport.x >= 0 && viewport.x <= 1 &&
    typeof viewport.y === "number" && viewport.y >= 0 && viewport.y <= 1 &&
    typeof viewport.zoom === "number" && viewport.zoom >= 1 && viewport.zoom <= 3 &&
    (viewport.confirmed === undefined || viewport.confirmed === true)
  );
}

function isImageMedia(value: unknown): value is GameImageMedia {
  if (!value || typeof value !== "object") return false;
  const media = value as GameImageMedia;
  const fixedViewportsValid = [media.cover, media.hero, media.card].every(
    (viewport) => viewport === undefined || isViewport(viewport)
  );
  if (!fixedViewportsValid) return false;
  if (media.gallery === undefined) return true;
  if (!media.gallery || typeof media.gallery !== "object") return false;
  return Object.values(media.gallery).every(isViewport);
}

function isVideoViewport(value: unknown): value is GameVideoViewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as Partial<GameVideoViewport>;
  return (
    typeof viewport.x === "number" &&
    typeof viewport.y === "number" &&
    typeof viewport.zoom === "number" &&
    typeof viewport.aspect === "string" &&
    (viewport.confirmed === undefined || viewport.confirmed === true)
  );
}

function isDestinationMode(value: unknown): value is GameDestinationMediaMode {
  return value === "image" || value === "video" || value === "hover-video";
}

function isDestinationVideo(value: unknown): value is GameCoverVideo | GameHeroVideo {
  if (!value || typeof value !== "object") return false;
  const video = value as Partial<GameCoverVideo>;
  return typeof video.clip === "string" && isVideoViewport(video.viewport);
}

function isCardVideo(value: unknown): value is GameCardVideo {
  if (!value || typeof value !== "object") return false;
  const video = value as Partial<GameCardVideo>;
  if (!isVideoViewport(video.viewport)) return false;
  if (video.source === "hero") return true;
  return video.source === "independent" && typeof video.clip === "string";
}

function isLibraryResource(value: unknown): value is LibraryResource {
  if (!value || typeof value !== "object") return false;
  const resource = value as Partial<LibraryResource>;
  if (
    typeof resource.src !== "string" ||
    typeof resource.bytes !== "number" ||
    resource.bytes <= 0
  ) {
    return false;
  }

  if (resource.kind === "video") {
    return resource.origin === "editorial" && typeof resource.digest === "string";
  }

  if (resource.kind !== "image") return false;
  const image = resource as Partial<ResourceImage>;
  return (
    (image.origin === "editorial" || image.origin === "bundled") &&
    (typeof image.digest === "string" || image.digest === null) &&
    (typeof image.width === "number" || image.width === null) &&
    (typeof image.height === "number" || image.height === null)
  );
}

function parseLibraryState(value: unknown): LibraryState | null {
  if (!value || typeof value !== "object") return null;
  const root = value as {
    revision?: unknown;
    resources?: unknown;
    assignments?: unknown;
  };
  if (
    typeof root.revision !== "number" ||
    !Array.isArray(root.resources) ||
    !root.resources.every(isLibraryResource) ||
    !root.assignments ||
    typeof root.assignments !== "object"
  ) {
    return null;
  }

  const assignments = root.assignments as LibraryState["assignments"];
  if (
    !isDestinationMode(assignments.coverMode) ||
    !isDestinationMode(assignments.heroMode) ||
    !isDestinationMode(assignments.cardMode) ||
    !Array.isArray(assignments.screenshots) ||
    (assignments.imageMedia !== null && assignments.imageMedia !== undefined && !isImageMedia(assignments.imageMedia)) ||
    (assignments.coverVideo !== null && assignments.coverVideo !== undefined && !isDestinationVideo(assignments.coverVideo)) ||
    (assignments.heroVideo !== null && assignments.heroVideo !== undefined && !isDestinationVideo(assignments.heroVideo)) ||
    (assignments.cardVideo !== null && assignments.cardVideo !== undefined && !isCardVideo(assignments.cardVideo))
  ) {
    return null;
  }

  return {
    revision: root.revision,
    resources: root.resources,
    assignments: {
      ...assignments,
      imageMedia: assignments.imageMedia ?? null,
    },
  };
}

function ResourceArtwork({ resource, alt }: { resource: ResourceImage; alt: string }) {
  return (
    <div className={styles.resourceArtwork}>
      <Image src={resource.src} alt={alt} fill sizes="(max-width: 760px) 88vw, 280px" />
    </div>
  );
}

function DeleteImageResourceForm({
  action,
  revision,
  resource,
  disabled,
}: {
  action: string;
  revision: number;
  resource: ResourceImage;
  disabled?: boolean;
}) {
  const name = shortName(resource.src);
  const confirmation = resource.origin === "editorial"
    ? `¿Eliminar ${name} definitivamente?\n\nSe quitará de Portada, Hero, Card y Galería y dejará de estar disponible en la biblioteca. Si la versión pública todavía la usa, el archivo físico se conservará sólo hasta que publiques el cambio.`
    : `¿Eliminar ${name} de este juego?\n\nSe quitará de Portada, Hero, Card y Galería. El archivo base compartido se conservará por seguridad.`;

  return (
    <form
      method="post"
      action={action}
      className={contextualStyles.deleteResourceForm}
      onSubmit={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="target" value="image-delete" />
      <input type="hidden" name="resource" value={resource.src} />
      <button
        type="submit"
        className={contextualStyles.deleteResourceButton}
        disabled={disabled}
        title="Eliminar recurso"
        aria-label={`Eliminar ${name} de todos los destinos`}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </form>
  );
}

function AssignmentForm({
  action,
  revision,
  target,
  resource,
  children,
  disabled,
}: {
  action: string;
  revision: number;
  target: string;
  resource: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <form method="post" action={action}>
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="resource" value={resource} />
      <button type="submit" className={styles.resourceChoice} disabled={disabled}>
        {children}
      </button>
    </form>
  );
}

function ModeSwitch({
  action,
  revision,
  target,
  mode,
  disabled,
}: {
  action: string;
  revision: number;
  target: Destination;
  mode: GameDestinationMediaMode;
  disabled?: boolean;
}) {
  return (
    <form method="post" action={action} className={styles.modeSwitch} aria-label={`Modo de ${target}`}>
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="target" value={`${target}-mode`} />
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="resource"
          value={option.value}
          className={mode === option.value ? styles.modeActive : ""}
          disabled={disabled}
          aria-pressed={mode === option.value}
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}

function ResourcePicker({
  action,
  revision,
  target,
  resources,
  kind,
  label = "Seleccionar recurso",
  disabled,
  onAddResource,
}: {
  action: string;
  revision: number;
  target: string;
  resources: LibraryResource[];
  kind: LibraryResource["kind"];
  label?: string;
  disabled?: boolean;
  onAddResource: (kind: AddResourceKind) => void;
}) {
  const available = resources.filter((resource) => resource.kind === kind);
  const buttonContent = (
    <>
      {kind === "image" ? <ImageIcon size={18} aria-hidden="true" /> : <MonitorPlay size={18} aria-hidden="true" />}
      <span>{label}</span>
    </>
  );

  if (disabled) {
    return <button type="button" className={styles.selectResourceButton} disabled>{buttonContent}</button>;
  }

  return (
    <details className={styles.resourcePicker}>
      <summary className={styles.selectResourceButton}>{buttonContent}</summary>
      <div className={styles.resourcePickerPanel}>
        <div className={styles.resourcePickerHeading}>
          <strong>{kind === "image" ? "Imágenes disponibles" : "Videos disponibles"}</strong>
          <span>{available.length} recurso{available.length === 1 ? "" : "s"}</span>
        </div>
        {available.length ? (
          <div className={styles.resourceChoiceGrid}>
            {available.map((resource) => (
              <AssignmentForm
                key={resource.src}
                action={action}
                revision={revision}
                target={target}
                resource={resource.src}
              >
                {resource.kind === "image" ? (
                  <span className={styles.choiceThumb}><Image src={resource.src} alt="" fill sizes="96px" /></span>
                ) : (
                  <span className={styles.choiceVideoIcon}><Clapperboard size={21} aria-hidden="true" /></span>
                )}
                <span className={styles.choiceMeta}>
                  <strong>{shortName(resource.src)}</strong>
                  <small>{resource.kind === "image" ? imageMeta(resource) : `WebM · ${formatBytes(resource.bytes)}`}</small>
                </span>
              </AssignmentForm>
            ))}
          </div>
        ) : (
          <p className={styles.emptyPicker}>No hay {kind === "image" ? "imágenes" : "videos"} disponibles todavía.</p>
        )}
        <div className={contextualStyles.pickerFooter}>
          <button type="button" className={contextualStyles.pickerAddButton} onClick={() => onAddResource(kind)}>
            <Plus size={16} aria-hidden="true" />Agregar nuevo recurso
          </button>
        </div>
      </div>
    </details>
  );
}

function RequirementStatus({ ready, pending }: { ready: boolean; pending: string }) {
  return (
    <small className={ready ? contextualStyles.requirementReady : contextualStyles.requirementPending}>
      {ready ? <CheckCircle2 size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
      {ready ? "RECORTE CONFIRMADO" : pending}
    </small>
  );
}

function modeLabel(mode: GameDestinationMediaMode) {
  if (mode === "hover-video") return "Imagen + hover";
  return mode === "video" ? "Video" : "Imagen";
}

function cropReady(
  mode: GameDestinationMediaMode,
  imageReady: boolean,
  videoReady: boolean
) {
  if (mode === "image") return imageReady;
  if (mode === "video") return videoReady;
  return imageReady && videoReady;
}

export default function GameMultimediaWorkspaceContextual({
  slug,
  revision,
  screenshotCount,
  initialCoverImage,
  initialHeroImage,
  initialScreenshots = [],
  videoEditor,
}: Props) {
  const [state, setState] = useState<LibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [editingLayer, setEditingLayer] = useState<EditLayer>("image");
  const [editingGalleryImage, setEditingGalleryImage] = useState<string | null>(null);
  const [galleryManagerOpen, setGalleryManagerOpen] = useState(false);
  const [addResourceKind, setAddResourceKind] = useState<AddResourceKind | null>(null);

  const endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`;

  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, { method: "GET", credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        const parsed = parseLibraryState(payload);
        if (!response.ok || !parsed) throw new Error("No se pudo cargar la biblioteca multimedia compartida.");
        if (cancelled) return;
        setState(parsed);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No se pudo cargar la biblioteca multimedia.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  const resources = state?.resources ?? [];
  const images = resources.filter((resource): resource is ResourceImage => resource.kind === "image");
  const videos = resources.filter((resource): resource is ResourceVideo => resource.kind === "video");
  const coverImage = state?.assignments.coverImage ?? initialCoverImage ?? null;
  const heroImage = state?.assignments.heroImage ?? initialHeroImage ?? null;
  const cardImage = state?.assignments.cardImage ?? null;
  const screenshots = state?.assignments.screenshots ?? [...initialScreenshots];
  const imageMedia = state?.assignments.imageMedia ?? null;
  const coverMode = state?.assignments.coverMode ?? "video";
  const heroMode = state?.assignments.heroMode ?? "hover-video";
  const cardMode = state?.assignments.cardMode ?? "hover-video";
  const coverVideo = state?.assignments.coverVideo ?? null;
  const heroVideo = state?.assignments.heroVideo ?? null;
  const resolvedCardClip = cardClip(state);
  const assignmentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  function imageBySrc(src: string | null) {
    return src ? images.find((resource) => resource.src === src) ?? null : null;
  }

  const coverResource = imageBySrc(coverImage);
  const heroResource = imageBySrc(heroImage);
  const cardResource = imageBySrc(cardImage);
  const firstGalleryResource = imageBySrc(screenshots[0] ?? null);
  const activeCoverVideo = videos.find((resource) => resource.src === coverVideo?.clip) ?? null;
  const activeHeroVideo = videos.find((resource) => resource.src === heroVideo?.clip) ?? null;
  const activeCardVideo = videos.find((resource) => resource.src === resolvedCardClip) ?? null;

  const coverImageCropReady = Boolean(coverImage && imageMedia?.cover?.confirmed);
  const coverVideoCropReady = Boolean(coverVideo?.viewport.confirmed);
  const coverCropReady = cropReady(coverMode, coverImageCropReady, coverVideoCropReady);
  const heroImageCropReady = Boolean(heroImage && imageMedia?.hero?.confirmed);
  const heroVideoCropReady = Boolean(heroVideo?.viewport.confirmed);
  const heroCropReady = cropReady(heroMode, heroImageCropReady, heroVideoCropReady);
  const cardImageCropReady = Boolean(cardImage && imageMedia?.card?.confirmed);
  const cardVideoCropReady = Boolean(state?.assignments.cardVideo?.viewport.confirmed);
  const cardCropReady = cropReady(cardMode, cardImageCropReady, cardVideoCropReady);
  const galleryReady = screenshots.length >= 1;
  const allRequirementsReady = coverCropReady && heroCropReady && cardCropReady && galleryReady;

  function usageLabels(resource: LibraryResource) {
    const labels: string[] = [];
    if (resource.kind === "image") {
      if (resource.src === coverImage && coverMode !== "video") labels.push(coverMode === "hover-video" ? "Portada base" : "Portada");
      if (resource.src === heroImage && heroMode !== "video") labels.push(heroMode === "hover-video" ? "Hero base" : "Hero");
      if (resource.src === cardImage && cardMode !== "video") labels.push(cardMode === "hover-video" ? "Card base" : "Card");
      if (screenshots.includes(resource.src)) labels.push("Galería");
    } else {
      if (resource.src === coverVideo?.clip && coverMode !== "image") labels.push(coverMode === "hover-video" ? "Portada hover" : "Portada");
      if (resource.src === heroVideo?.clip && heroMode !== "image") labels.push(heroMode === "hover-video" ? "Hero hover" : "Hero");
      if (resource.src === resolvedCardClip && cardMode !== "image") labels.push(cardMode === "hover-video" ? "Card hover" : "Card");
    }
    return labels;
  }

  function videoEditorConfig(destination: Destination): VideoEditorConfig | null {
    if (destination === "cover") {
      if (!coverVideo) return null;
      return {
        target: "cover",
        source: "independent",
        clip: coverVideo.clip,
        viewport: coverVideo.viewport,
        label: coverMode === "hover-video" ? "Portada · video al hover" : "Portada del juego",
      };
    }
    if (destination === "hero") {
      if (!heroVideo) return null;
      return {
        target: "hero",
        source: "hero",
        clip: heroVideo.clip,
        viewport: heroVideo.viewport,
        label: heroMode === "hover-video" ? "Hero · video al hover" : "Hero de inicio",
      };
    }
    const card = state?.assignments.cardVideo;
    if (card?.source === "hero" && heroVideo) {
      return { target: "card", source: "hero", clip: heroVideo.clip, viewport: card.viewport, label: "Card · video heredado del Hero" };
    }
    if (card?.source === "independent") {
      return { target: "card", source: "independent", clip: card.clip, viewport: card.viewport, label: cardMode === "hover-video" ? "Card · video al hover" : "Card del juego" };
    }
    if (state?.assignments.legacyPreviewClip) {
      return { target: "card", source: "independent", clip: state.assignments.legacyPreviewClip, viewport: { ...DEFAULT_PREVIEW_VIEWPORT }, label: "Card · preview heredado" };
    }
    return null;
  }

  function imageEditorConfig(destination: Destination) {
    if (destination === "cover" && coverImage) {
      return { target: "cover" as const, src: coverImage, viewport: imageMedia?.cover, label: `Portada · ${shortName(coverImage)}` };
    }
    if (destination === "hero" && heroImage) {
      return { target: "hero" as const, src: heroImage, viewport: imageMedia?.hero, label: `Hero · ${shortName(heroImage)}` };
    }
    if (destination === "card" && cardImage) {
      return { target: "card" as const, src: cardImage, viewport: imageMedia?.card, label: `Card · ${shortName(cardImage)}` };
    }
    return null;
  }

  const editingVideo = editingDestination && editingLayer === "video"
    ? videoEditorConfig(editingDestination)
    : null;
  const editingImage = editingDestination && editingLayer === "image"
    ? imageEditorConfig(editingDestination)
    : null;
  const galleryEditingResource = editingGalleryImage ? imageBySrc(editingGalleryImage) : null;

  function openDestination(destination: Destination, layer: EditLayer) {
    if (stale) return;
    const media = layer === "video"
      ? videoEditorConfig(destination)
      : imageEditorConfig(destination);
    if (media) {
      setEditingLayer(layer);
      setEditingDestination(destination);
      return;
    }
    setAddResourceKind(layer === "video" ? "video" : "image");
  }

  function openGalleryImage(src: string) {
    if (stale || !screenshots.includes(src)) return;
    setGalleryManagerOpen(false);
    setEditingGalleryImage(src);
  }

  function openAddResource(kind: AddResourceKind) {
    setGalleryManagerOpen(false);
    setAddResourceKind(kind);
  }

  function renderGalleryAssignedItems(compact = false) {
    if (!screenshots.length) {
      return (
        <div className={contextualStyles.galleryEmpty}>
          <Images size={24} aria-hidden="true" />
          <span>Se requiere al menos una imagen en la Galería.</span>
        </div>
      );
    }

    return (
      <div className={compact ? contextualStyles.galleryMiniGrid : contextualStyles.galleryManageGrid}>
        {screenshots.map((src, index) => {
          const resource = imageBySrc(src);
          return (
            <article key={src} className={contextualStyles.galleryItemCard}>
              <div className={contextualStyles.galleryItemPreview}>
                <Image src={src} alt={`Captura ${index + 1}`} fill sizes={compact ? "120px" : "240px"} />
              </div>
              <div className={contextualStyles.galleryItemMeta}>
                <strong>{shortName(src)}</strong>
                <small>{resource ? imageMeta(resource) : `Captura ${index + 1}`}</small>
              </div>
              <div className={contextualStyles.galleryItemActions}>
                <button type="button" className={contextualStyles.galleryEditButton} disabled={stale} onClick={() => openGalleryImage(src)}>
                  <Pencil size={14} aria-hidden="true" />Editar
                </button>
                <form method="post" action={endpoint}>
                  <input type="hidden" name="expectedRevision" value={assignmentRevision} />
                  <input type="hidden" name="target" value="gallery-remove" />
                  <input type="hidden" name="resource" value={src} />
                  <button type="submit" className={contextualStyles.galleryRemoveButton} disabled={stale} aria-label={`Quitar ${shortName(src)} de la Galería`}>
                    <Trash2 size={14} aria-hidden="true" />Quitar
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function destinationActions(
    destination: Destination,
    mode: GameDestinationMediaMode,
    hasImage: boolean,
    hasVideo: boolean
  ) {
    const aspect = REQUIRED_DESTINATION_ASPECTS[destination];
    return (
      <div className={styles.assignmentActions}>
        {mode !== "video" && (
          <ResourcePicker
            action={endpoint}
            revision={assignmentRevision}
            target={`${destination}-image`}
            resources={resources}
            kind="image"
            label={mode === "hover-video" ? "Seleccionar imagen base" : "Seleccionar imagen"}
            disabled={stale}
            onAddResource={openAddResource}
          />
        )}
        {mode !== "image" && (
          <ResourcePicker
            action={endpoint}
            revision={assignmentRevision}
            target={`${destination}-video`}
            resources={resources}
            kind="video"
            label={mode === "hover-video" ? "Seleccionar video hover" : "Seleccionar video"}
            disabled={stale}
            onAddResource={openAddResource}
          />
        )}
        {mode !== "video" && (
          <button type="button" className={styles.editDestinationButton} disabled={stale || !hasImage} onClick={() => openDestination(destination, "image")}>
            {mode === "hover-video" ? `Recortar imagen ${aspect}` : `Recortar ${aspect}`}
          </button>
        )}
        {mode !== "image" && (
          <button type="button" className={styles.editDestinationButton} disabled={stale || !hasVideo} onClick={() => openDestination(destination, "video")}>
            {mode === "hover-video" ? `Recortar video ${aspect}` : `Recortar ${aspect}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.mediaWorkspace}>
      <section className={styles.summarySection} aria-labelledby="multimedia-summary-heading">
        <div className={styles.compactHeading}>
          <div>
            <span>RESUMEN MULTIMEDIA</span>
            <h2 id="multimedia-summary-heading">Requisitos obligatorios de destinos</h2>
          </div>
          <p>Portada, Hero y Card tienen recurso, modo y recorte independientes. La Galería necesita al menos una imagen.</p>
        </div>
        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>{coverMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <MonitorPlay size={22} aria-hidden="true" />}</span>
            <div><span>PORTADA · {REQUIRED_DESTINATION_ASPECTS.cover}</span><strong>{modeLabel(coverMode)}</strong><RequirementStatus ready={coverCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>{heroMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <MonitorPlay size={22} aria-hidden="true" />}</span>
            <div><span>HERO · {REQUIRED_DESTINATION_ASPECTS.hero}</span><strong>{modeLabel(heroMode)}</strong><RequirementStatus ready={heroCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>{cardMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <Clapperboard size={22} aria-hidden="true" />}</span>
            <div><span>CARD · {REQUIRED_DESTINATION_ASPECTS.card}</span><strong>{modeLabel(cardMode)}</strong><RequirementStatus ready={cardCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}><Images size={22} aria-hidden="true" /></span>
            <div><span>GALERÍA · MÍNIMO 1</span><strong>{screenshots.length} de 8 capturas</strong><small className={galleryReady ? contextualStyles.requirementReady : contextualStyles.requirementPending}>{galleryReady ? <CheckCircle2 size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}{galleryReady ? "REQUISITO CUMPLIDO" : "IMAGEN REQUERIDA"}</small></div>
          </article>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <section className={styles.numberedSection} aria-labelledby="destination-assignment-heading">
            <div className={styles.sectionTitleRow}>
              <div><span>01</span><div><h2 id="destination-assignment-heading">Asignación de destinos</h2><p>Cada destino elige su modo y recursos de forma independiente. Imagen + hover conserva la imagen base y activa el video sólo con interacción compatible.</p></div></div>
            </div>

            <div className={styles.assignmentGrid}>
              <article className={styles.assignmentCard}>
                <header><div><span>A</span><h3>Portada del juego</h3></div><small>Recorte obligatorio · 4:5</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="cover" mode={coverMode} disabled={stale} />
                <div className={styles.currentResource}>
                  {coverMode !== "video" && coverResource ? <span className={styles.currentThumb}><Image src={coverResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}>{coverMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <MonitorPlay size={20} aria-hidden="true" />}</span>}
                  <div><span>Modo activo</span><strong>{modeLabel(coverMode)}</strong><small>{coverMode === "hover-video" ? `${coverImage ? shortName(coverImage) : "Imagen pendiente"} + ${activeCoverVideo ? shortName(activeCoverVideo.src) : "video pendiente"}` : coverMode === "video" ? activeCoverVideo ? shortName(activeCoverVideo.src) : "Selecciona un video" : coverImage ? shortName(coverImage) : "Selecciona una imagen"}</small></div>
                </div>
                {destinationActions("cover", coverMode, Boolean(coverImage), Boolean(coverVideo))}
                <RequirementStatus ready={coverCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 4:5" />
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>B</span><h3>Hero de inicio</h3></div><small>Recorte obligatorio · 16:9</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="hero" mode={heroMode} disabled={stale} />
                <div className={styles.currentResource}>
                  {heroMode !== "video" && heroResource ? <span className={styles.currentThumb}><Image src={heroResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}>{heroMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <MonitorPlay size={20} aria-hidden="true" />}</span>}
                  <div><span>Modo activo</span><strong>{modeLabel(heroMode)}</strong><small>{heroMode === "hover-video" ? `${heroImage ? shortName(heroImage) : "Imagen pendiente"} + ${activeHeroVideo ? shortName(activeHeroVideo.src) : "video pendiente"}` : heroMode === "video" ? activeHeroVideo ? shortName(activeHeroVideo.src) : "Selecciona un video" : heroImage ? shortName(heroImage) : "Selecciona una imagen"}</small></div>
                </div>
                {destinationActions("hero", heroMode, Boolean(heroImage), Boolean(heroVideo))}
                <RequirementStatus ready={heroCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 16:9" />
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>C</span><h3>Card del juego</h3></div><small>Recorte obligatorio · 3:2</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="card" mode={cardMode} disabled={stale} />
                <div className={styles.currentResource}>
                  {cardMode !== "video" && cardResource ? <span className={styles.currentThumb}><Image src={cardResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}>{cardMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <Clapperboard size={20} aria-hidden="true" />}</span>}
                  <div><span>Recurso independiente</span><strong>{modeLabel(cardMode)}</strong><small>{cardMode === "hover-video" ? `${cardImage ? shortName(cardImage) : "Imagen pendiente"} + ${activeCardVideo ? shortName(activeCardVideo.src) : "video pendiente"}` : cardMode === "video" ? activeCardVideo ? shortName(activeCardVideo.src) : "Selecciona un video" : cardImage ? shortName(cardImage) : "Selecciona una imagen propia para Card"}</small></div>
                </div>
                {destinationActions("card", cardMode, Boolean(cardImage), Boolean(resolvedCardClip))}
                <RequirementStatus ready={cardCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 3:2" />
              </article>

              <article className={`${styles.assignmentCard} ${contextualStyles.galleryAssignmentCard}`}>
                <header><div><span>D</span><h3>Galería del juego</h3></div><small>Obligatoria · mínimo 1 imagen</small></header>
                <div className={styles.currentResource}>
                  {firstGalleryResource ? <span className={styles.currentThumb}><Image src={firstGalleryResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}><Images size={20} aria-hidden="true" /></span>}
                  <div><span>Capturas asignadas</span><strong>{screenshots.length} de 8</strong><small>Se requiere al menos una imagen. Editar cambia el encuadre; Quitar la saca de Galería sin destruirla.</small></div>
                </div>
                {renderGalleryAssignedItems(true)}
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target="gallery-image" resources={resources} kind="image" label="Añadir desde biblioteca" disabled={stale || screenshots.length >= 8} onAddResource={openAddResource} />
                  <button type="button" className={styles.editDestinationButton} disabled={stale} onClick={() => setGalleryManagerOpen(true)}>Gestionar galería</button>
                </div>
                <small className={galleryReady ? contextualStyles.requirementReady : contextualStyles.requirementPending}>{galleryReady ? <CheckCircle2 size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}{galleryReady ? "REQUISITO CUMPLIDO" : "IMAGEN REQUERIDA · MÍNIMO 1"}</small>
              </article>
            </div>

            <div className={contextualStyles.continueGate}>
              <div>
                <strong>{allRequirementsReady ? "Multimedia completa" : "No puedes avanzar todavía"}</strong>
                <span>{allRequirementsReady ? "Todos los destinos obligatorios están listos." : "Confirma Portada 4:5, Hero 16:9, Card 3:2 y agrega al menos una imagen a Galería."}</span>
              </div>
              {allRequirementsReady ? (
                <Link href={`/admin/juegos/${encodeURIComponent(slug)}?seccion=descargas`} className={contextualStyles.continueButton}>Continuar a Descargas</Link>
              ) : (
                <button type="button" className={contextualStyles.continueButton} disabled>Continuar a Descargas</button>
              )}
            </div>
          </section>

          <section className={styles.numberedSection} aria-labelledby="shared-library-heading">
            <div className={styles.sectionTitleRow}>
              <div><span>02</span><div><h2 id="shared-library-heading">Biblioteca multimedia compartida</h2><p>La biblioteca queda al final: administra aquí los archivos físicos que luego reutilizas en los destinos.</p></div></div>
              <button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}><Upload size={16} aria-hidden="true" />Agregar nuevo recurso</button>
            </div>
            {loading ? (
              <div className={styles.libraryStatus} role="status">Comprobando recursos multimedia seguros…</div>
            ) : error ? (
              <div className={styles.libraryStatus} role="alert">{error}</div>
            ) : resources.length === 0 ? (
              <div className={styles.emptyLibrary}><FolderOpen size={30} aria-hidden="true" /><strong>La biblioteca todavía está vacía</strong><span>Agrega una imagen o crea un video editorial para empezar.</span><button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}><Plus size={16} aria-hidden="true" />Agregar primer recurso</button></div>
            ) : (
              <div className={styles.libraryGrid}>
                {resources.map((resource) => {
                  const labels = usageLabels(resource);
                  return (
                    <article key={resource.src} className={styles.libraryCard}>
                      <div className={styles.libraryCardHeading}><div><span>{resource.kind === "video" ? "VIDEO" : resource.origin === "bundled" ? "IMAGEN EXISTENTE" : "IMAGEN"}</span><strong>{shortName(resource.src)}</strong></div><small>{formatBytes(resource.bytes)}</small></div>
                      {resource.kind === "image" ? (
                        <div className={contextualStyles.deletableArtwork}><ResourceArtwork resource={resource} alt="Recurso de la biblioteca multimedia" /><DeleteImageResourceForm action={endpoint} revision={assignmentRevision} resource={resource} disabled={stale} /></div>
                      ) : (
                        <div className={styles.videoPlaceholder}><MonitorPlay size={30} aria-hidden="true" /><span>WebM interno</span><small>No se reproduce hasta abrir un editor.</small></div>
                      )}
                      <div className={styles.usageRow}>{labels.length ? labels.map((usageLabel) => <span key={usageLabel}>{usageLabel}</span>) : <span className={styles.unusedBadge}>Disponible</span>}</div>
                      <small className={styles.resourceDetails}>{resource.kind === "image" ? resource.origin === "bundled" ? `${imageFormat(resource.src)} existente · reutilizable por referencia` : `${resource.width}×${resource.height} · WebP seguro` : "WebM validado · master reutilizable"}</small>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {stale && <div className={styles.staleNotice} role="alert"><Info size={18} aria-hidden="true" /><div><strong>La revisión multimedia cambió</strong><span>Recarga esta página antes de asignar o editar otro recurso.</span></div></div>}
        </div>

        <aside className={styles.helpRail}>
          <section>
            <div className={styles.helpHeading}><Info size={18} aria-hidden="true" /><h2>Requisitos</h2></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Portada · 4:5</strong><span>Imagen, Video o Imagen + hover; cada capa activa confirma su encuadre.</span></div></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Hero · 16:9</strong><span>Imagen, Video o Imagen + hover; hover exige ambos recortes.</span></div></div>
            <div className={styles.helpRule}><Clapperboard size={20} aria-hidden="true" /><div><strong>Card · 3:2</strong><span>Su imagen ya es independiente de Portada; puede usar su propio video o hover.</span></div></div>
            <div className={styles.helpRule}><Images size={20} aria-hidden="true" /><div><strong>Galería obligatoria</strong><span>Mínimo una imagen para poder avanzar.</span></div></div>
          </section>
          <section className={styles.tipCard}><Sparkles size={20} aria-hidden="true" /><div><strong>Reutilizar sin acoplar</strong><p>Puedes elegir el mismo archivo físico en dos destinos, pero cada asignación y recorte se conserva de forma independiente.</p></div></section>
        </aside>
      </div>

      {editingDestination && (editingVideo || editingImage) && (
        <ContextualMediaDialog eyebrow="RECORTE OBLIGATORIO" title={editingDestination === "cover" ? "Recorte 4:5 de la Portada" : editingDestination === "hero" ? "Recorte 16:9 del Hero" : "Recorte 3:2 de la Card"} description="Debes guardar este recorte para completar el destino. El archivo físico permanece intacto." onClose={() => setEditingDestination(null)}>
          {editingVideo ? (
            <GameVideoViewportEditor slug={slug} revision={assignmentRevision} target={editingVideo.target} source={editingVideo.source} clip={editingVideo.clip} label={editingVideo.label} initialViewport={editingVideo.viewport} onClose={() => setEditingDestination(null)} />
          ) : editingImage ? (
            <ImageViewportEditor slug={slug} revision={assignmentRevision} target={editingImage.target} src={editingImage.src} label={editingImage.label} initialViewport={editingImage.viewport} onClose={() => setEditingDestination(null)} />
          ) : null}
        </ContextualMediaDialog>
      )}

      {editingGalleryImage && galleryEditingResource && (
        <ContextualMediaDialog eyebrow="EDITAR GALERÍA" title="Encuadre de la captura" description="Ajusta sólo la zona visible de esta captura. La imagen original sigue intacta y reutilizable." onClose={() => setEditingGalleryImage(null)}>
          <ImageViewportEditor slug={slug} revision={assignmentRevision} target="gallery" src={editingGalleryImage} resource={editingGalleryImage} label={`Galería · ${shortName(editingGalleryImage)}`} initialViewport={imageMedia?.gallery?.[editingGalleryImage]} onClose={() => setEditingGalleryImage(null)} />
        </ContextualMediaDialog>
      )}

      {galleryManagerOpen && (
        <ContextualMediaDialog eyebrow="GALERÍA DEL JUEGO" title="Gestionar capturas" description="Editar ajusta el encuadre. Quitar conserva el recurso en la biblioteca. La eliminación definitiva sólo existe en la Biblioteca multimedia compartida." onClose={() => setGalleryManagerOpen(false)}>
          <div className={contextualStyles.galleryManagerHeader}><div><strong>{screenshots.length} de 8 imágenes asignadas</strong><span>Se requiere al menos una imagen.</span></div><ResourcePicker action={endpoint} revision={assignmentRevision} target="gallery-image" resources={resources} kind="image" label="Añadir imagen" disabled={stale || screenshots.length >= 8} onAddResource={openAddResource} /></div>
          {renderGalleryAssignedItems()}
        </ContextualMediaDialog>
      )}

      {addResourceKind && (
        <ContextualMediaDialog eyebrow="BIBLIOTECA COMPARTIDA" title="Agregar nuevo recurso" description="Crea o importa el recurso una sola vez. Después podrás asignarlo y confirmar su recorte por destino." onClose={() => setAddResourceKind(null)}>
          <div className={`${styles.editorSteps} ${contextualStyles.addTabs}`}><button type="button" className={addResourceKind === "image" ? styles.editorStepActive : ""} onClick={() => setAddResourceKind("image")}><ImageIcon size={17} aria-hidden="true" />Imagen</button><button type="button" className={addResourceKind === "video" ? styles.editorStepActive : ""} onClick={() => setAddResourceKind("video")}><Clapperboard size={17} aria-hidden="true" />Video</button></div>
          {addResourceKind === "image" ? (
            <div className={`${styles.uploadDetails} ${styles.uploadBody}`}><p className={contextualStyles.addIntro}>El WebP queda guardado en la biblioteca por hash. No completa ningún destino hasta que lo asignes y confirmes su recorte.</p><GameMediaUploadForm slug={slug} revision={assignmentRevision} screenshotCount={screenshotCount} libraryOnly /></div>
          ) : (
            <div className={styles.videoEditorHost}><p className={contextualStyles.editorModeNote}><Info size={17} aria-hidden="true" /><span><strong>Crear video editorial.</strong>{" "}Aquí eliges fuente, tramo, resolución y FPS. El recorte obligatorio del destino se confirma después y no vuelve a ejecutar FFmpeg.</span></p>{videoEditor}</div>
          )}
        </ContextualMediaDialog>
      )}
    </div>
  );
}