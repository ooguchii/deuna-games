"use client";

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

import AdminMediaLibraryPreview from "@/components/admin/AdminMediaLibraryPreview";
import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";
import GameBackgroundMediaEditor from "@/components/admin/GameBackgroundMediaEditor";
import GameDetailMediaEditor from "@/components/admin/GameDetailMediaEditor";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GameVideoViewportEditor from "@/components/admin/GameVideoViewportEditor";
import ImageViewportEditor from "@/components/admin/ImageViewportEditor";
import {
  isImageCropConfirmed,
  isVideoCropConfirmed,
  LEGACY_DESTINATION_IMAGE_ASPECTS,
  REQUIRED_DESTINATION_ASPECTS,
} from "@/lib/media/game-media-requirements";
import {
  GAME_IMAGE_CROP_ASPECTS,
  gameImageCropAspectLabel,
  resolveGameImageCropAspectRatio,
} from "@/lib/media/image-viewport";
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  GameBackgroundVideo,
  GameCardVideo,
  GameCoverVideo,
  GameDestinationMediaMode,
  GameDetailVideo,
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
    detailImage: string | null;
    backgroundImage: string | null;
    screenshots: string[];
    imageMedia: GameImageMedia | null;
    coverMode: GameDestinationMediaMode;
    heroMode: GameDestinationMediaMode;
    cardMode: GameDestinationMediaMode;
    detailMode: GameDestinationMediaMode;
    backgroundMode: GameDestinationMediaMode | null;
    coverVideo: GameCoverVideo | null;
    heroVideo: GameHeroVideo | null;
    cardVideo: GameCardVideo | null;
    detailVideo: GameDetailVideo | null;
    backgroundVideo: GameBackgroundVideo | null;
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

type RequirementActionState = {
  complete: boolean;
  missingLabel: string;
  completeLabel: string;
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
  const aspectValid = viewport.aspect === undefined ||
    GAME_IMAGE_CROP_ASPECTS.includes(viewport.aspect);
  const ratioValid = viewport.aspect === "free"
    ? typeof viewport.aspectRatio === "number" &&
      Number.isFinite(viewport.aspectRatio) &&
      viewport.aspectRatio >= 0.1 &&
      viewport.aspectRatio <= 10
    : viewport.aspectRatio === undefined;

  return (
    typeof viewport.x === "number" && viewport.x >= 0 && viewport.x <= 1 &&
    typeof viewport.y === "number" && viewport.y >= 0 && viewport.y <= 1 &&
    typeof viewport.zoom === "number" && viewport.zoom >= 1 && viewport.zoom <= 3 &&
    aspectValid &&
    ratioValid &&
    (viewport.confirmed === undefined || viewport.confirmed === true)
  );
}

function isImageMedia(value: unknown): value is GameImageMedia {
  if (!value || typeof value !== "object") return false;
  const media = value as GameImageMedia;
  const fixedViewportsValid = [
    media.cover,
    media.hero,
    media.card,
    media.detail,
    media.background,
  ].every(
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

function isDestinationVideo(
  value: unknown
): value is GameCoverVideo | GameHeroVideo | GameDetailVideo | GameBackgroundVideo {
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
    !isDestinationMode(assignments.detailMode) ||
    (assignments.backgroundMode !== null &&
      assignments.backgroundMode !== undefined &&
      !isDestinationMode(assignments.backgroundMode)) ||
    !Array.isArray(assignments.screenshots) ||
    (assignments.imageMedia !== null && assignments.imageMedia !== undefined && !isImageMedia(assignments.imageMedia)) ||
    (assignments.coverVideo !== null && assignments.coverVideo !== undefined && !isDestinationVideo(assignments.coverVideo)) ||
    (assignments.heroVideo !== null && assignments.heroVideo !== undefined && !isDestinationVideo(assignments.heroVideo)) ||
    (assignments.cardVideo !== null && assignments.cardVideo !== undefined && !isCardVideo(assignments.cardVideo)) ||
    (assignments.detailVideo !== null && assignments.detailVideo !== undefined && !isDestinationVideo(assignments.detailVideo)) ||
    (assignments.backgroundVideo !== null && assignments.backgroundVideo !== undefined && !isDestinationVideo(assignments.backgroundVideo))
  ) {
    return null;
  }

  return {
    revision: root.revision,
    resources: root.resources,
    assignments: {
      ...assignments,
      detailImage: assignments.detailImage ?? null,
      detailVideo: assignments.detailVideo ?? null,
      backgroundImage: assignments.backgroundImage ?? null,
      backgroundMode: assignments.backgroundMode ?? null,
      backgroundVideo: assignments.backgroundVideo ?? null,
      imageMedia: assignments.imageMedia ?? null,
    },
  };
}

function ResourceArtwork({ resource, alt }: { resource: ResourceImage; alt: string }) {
  return (
    <AdminMediaThumbnail
      kind="image"
      src={resource.src}
      mode="source"
      label={alt}
      sizes="(max-width: 760px) 88vw, 300px"
      className={styles.resourceArtwork}
    />
  );
}

function DeleteResourceForm({
  action,
  revision,
  resource,
  usages,
  disabled,
}: {
  action: string;
  revision: number;
  resource: LibraryResource;
  usages: readonly string[];
  disabled?: boolean;
}) {
  const name = shortName(resource.src);
  const usageMessage = usages.length
    ? `\n\nSe quitará de: ${usages.join(", ")}.`
    : "\n\nActualmente no está asignado a ningún destino.";
  const confirmation = resource.kind === "image" && resource.origin === "bundled"
    ? `¿Quitar ${name} de este juego?${usageMessage}\n\nEl archivo base compartido se conservará por seguridad.`
    : `¿Eliminar ${name} definitivamente?${usageMessage}\n\nDejará de estar disponible en la biblioteca. Si la versión pública todavía lo utiliza, el archivo físico se conservará hasta que publiques el cambio.`;

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
      <input type="hidden" name="target" value={resource.kind === "image" ? "image-delete" : "video-delete"} />
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

function requirementActionClass(complete: boolean) {
  return complete
    ? contextualStyles.requirementActionComplete
    : contextualStyles.requirementActionMissing;
}

function RequirementActionIcon({ complete }: { complete: boolean }) {
  return complete
    ? <CheckCircle2 size={17} aria-hidden="true" />
    : <Info size={17} aria-hidden="true" />;
}

function ResourcePicker({
  action,
  revision,
  target,
  resources,
  kind,
  label = "Seleccionar recurso",
  requirement,
  disabled,
  onAddResource,
}: {
  action: string;
  revision: number;
  target: string;
  resources: LibraryResource[];
  kind: LibraryResource["kind"];
  label?: string;
  requirement?: RequirementActionState;
  disabled?: boolean;
  onAddResource: (kind: AddResourceKind) => void;
}) {
  const available = resources.filter((resource) => resource.kind === kind);
  const visibleLabel = requirement
    ? requirement.complete
      ? requirement.completeLabel
      : requirement.missingLabel
    : label;
  const buttonContent = (
    <>
      {requirement ? (
        <RequirementActionIcon complete={requirement.complete} />
      ) : kind === "image" ? (
        <ImageIcon size={18} aria-hidden="true" />
      ) : (
        <MonitorPlay size={18} aria-hidden="true" />
      )}
      <span>{visibleLabel}</span>
    </>
  );
  const buttonClassName = requirement
    ? `${styles.selectResourceButton} ${requirementActionClass(requirement.complete)}`
    : styles.selectResourceButton;

  if (disabled) {
    return <button type="button" className={buttonClassName} disabled>{buttonContent}</button>;
  }

  return (
    <details className={styles.resourcePicker}>
      <summary
        className={buttonClassName}
        data-requirement-state={requirement ? (requirement.complete ? "complete" : "missing") : undefined}
        title={requirement?.complete ? `Cambiar ${kind === "image" ? "imagen" : "video"}` : undefined}
      >
        {buttonContent}
      </summary>
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
                <AdminMediaThumbnail
                  kind={resource.kind}
                  src={resource.src}
                  mode="source"
                  label={`Fuente ${shortName(resource.src)}`}
                  sizes="112px"
                  className={styles.choiceThumb}
                />
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

function CropRequirementButton({
  complete,
  hasResource,
  mediaKind,
  aspect,
  disabled,
  onClick,
}: {
  complete: boolean;
  hasResource: boolean;
  mediaKind: "image" | "video";
  aspect: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const missingLabel = mediaKind === "image"
    ? "Falta recortar la imagen"
    : "Falta recortar el video";

  return (
    <button
      type="button"
      className={`${styles.editDestinationButton} ${requirementActionClass(complete)}`}
      data-requirement-state={complete ? "complete" : "missing"}
      disabled={disabled || !hasResource}
      onClick={onClick}
      title={complete ? `Editar recorte ${aspect}` : undefined}
    >
      <RequirementActionIcon complete={complete} />
      {complete ? `Recorte ${aspect} confirmado` : missingLabel}
    </button>
  );
}

function RequirementStatus({
  ready,
  pending,
  readyLabel = "RECORTE CONFIRMADO",
}: {
  ready: boolean;
  pending: string;
  readyLabel?: string;
}) {
  return (
    <small className={ready ? contextualStyles.requirementReady : contextualStyles.requirementPending}>
      {ready ? <CheckCircle2 size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
      {ready ? readyLabel : pending}
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

function DestinationThumbnailSet({
  mode,
  imageSrc,
  imageViewport,
  videoSrc,
  videoViewport,
  frameAspect,
  label,
  summary = false,
}: {
  mode: GameDestinationMediaMode;
  imageSrc: string | null;
  imageViewport?: GameImageViewport;
  videoSrc: string | null;
  videoViewport?: GameVideoViewport;
  frameAspect: number;
  label: string;
  summary?: boolean;
}) {
  const showImage = mode !== "video" && Boolean(imageSrc);
  const showVideo = mode !== "image" && Boolean(videoSrc);
  if (!showImage && !showVideo) return null;

  const setClass = summary ? styles.summaryMediaSet : styles.currentMediaSet;
  const pairClass = summary ? styles.summaryMediaPair : styles.currentMediaPair;
  const thumbClass = summary ? styles.summaryThumb : styles.currentThumb;

  return (
    <span className={`${setClass} ${showImage && showVideo ? pairClass : ""}`}>
      {showImage && imageSrc && (
        <AdminMediaThumbnail
          kind="image"
          src={imageSrc}
          viewport={imageViewport}
          mode="destination"
          frameAspect={frameAspect}
          label={`${label} · imagen`}
          className={thumbClass}
        />
      )}
      {showVideo && videoSrc && (
        <AdminMediaThumbnail
          kind="video"
          src={videoSrc}
          viewport={videoViewport}
          mode="destination"
          frameAspect={frameAspect}
          label={`${label} · video`}
          className={thumbClass}
        />
      )}
    </span>
  );
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
  const [previewResource, setPreviewResource] = useState<LibraryResource | null>(null);

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
  const detailImage = state?.assignments.detailImage ?? null;
  const backgroundImage = state?.assignments.backgroundImage ?? null;
  const screenshots = state?.assignments.screenshots ?? [...initialScreenshots];
  const imageMedia = state?.assignments.imageMedia ?? null;
  const coverMode = state?.assignments.coverMode ?? "video";
  const heroMode = state?.assignments.heroMode ?? "hover-video";
  const cardMode = state?.assignments.cardMode ?? "hover-video";
  const detailMode = state?.assignments.detailMode ?? "image";
  const backgroundMode = state?.assignments.backgroundMode ?? null;
  const coverVideo = state?.assignments.coverVideo ?? null;
  const heroVideo = state?.assignments.heroVideo ?? null;
  const detailVideo = state?.assignments.detailVideo ?? null;
  const backgroundVideo = state?.assignments.backgroundVideo ?? null;
  const resolvedCardClip = cardClip(state);
  const assignmentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  function imageBySrc(src: string | null) {
    return src ? images.find((resource) => resource.src === src) ?? null : null;
  }

  const coverResource = imageBySrc(coverImage);
  const heroResource = imageBySrc(heroImage);
  const cardResource = imageBySrc(cardImage);
  const detailResource = imageBySrc(detailImage);
  const firstGalleryResource = imageBySrc(screenshots[0] ?? null);
  const activeCoverVideo = videos.find((resource) => resource.src === coverVideo?.clip) ?? null;
  const activeHeroVideo = videos.find((resource) => resource.src === heroVideo?.clip) ?? null;
  const activeCardVideo = videos.find((resource) => resource.src === resolvedCardClip) ?? null;
  const activeDetailVideo = videos.find((resource) => resource.src === detailVideo?.clip) ?? null;
  const activeCardVideoViewport = state?.assignments.cardVideo?.viewport;

  const coverImageCropReady = Boolean(
    coverImage &&
    isImageCropConfirmed(
      imageMedia?.cover,
      REQUIRED_DESTINATION_ASPECTS.cover,
      LEGACY_DESTINATION_IMAGE_ASPECTS.cover
    )
  );
  const coverVideoCropReady = Boolean(
    coverVideo &&
    isVideoCropConfirmed(
      coverVideo.viewport,
      REQUIRED_DESTINATION_ASPECTS.cover
    )
  );
  const coverCropReady = cropReady(coverMode, coverImageCropReady, coverVideoCropReady);
  const heroImageCropReady = Boolean(
    heroImage &&
    isImageCropConfirmed(
      imageMedia?.hero,
      REQUIRED_DESTINATION_ASPECTS.hero,
      LEGACY_DESTINATION_IMAGE_ASPECTS.hero
    )
  );
  const heroVideoCropReady = Boolean(
    heroVideo &&
    isVideoCropConfirmed(
      heroVideo.viewport,
      REQUIRED_DESTINATION_ASPECTS.hero
    )
  );
  const heroCropReady = cropReady(heroMode, heroImageCropReady, heroVideoCropReady);
  const cardImageCropReady = Boolean(
    cardImage &&
    isImageCropConfirmed(
      imageMedia?.card,
      REQUIRED_DESTINATION_ASPECTS.card,
      LEGACY_DESTINATION_IMAGE_ASPECTS.card
    )
  );
  const cardVideoCropReady = Boolean(
    state?.assignments.cardVideo &&
    isVideoCropConfirmed(
      state.assignments.cardVideo.viewport,
      REQUIRED_DESTINATION_ASPECTS.card
    )
  );
  const cardCropReady = cropReady(cardMode, cardImageCropReady, cardVideoCropReady);
  const detailImageCropReady = Boolean(
    detailImage && isImageCropConfirmed(imageMedia?.detail)
  );
  const detailVideoCropReady = Boolean(
    detailVideo && isVideoCropConfirmed(detailVideo.viewport, "source")
  );
  const detailCropReady = cropReady(
    detailMode,
    detailImageCropReady,
    detailVideoCropReady
  );
  const backgroundImageCropReady = Boolean(
    backgroundImage && isImageCropConfirmed(imageMedia?.background)
  );
  const backgroundVideoCropReady = Boolean(
    backgroundVideo && isVideoCropConfirmed(backgroundVideo.viewport, "source")
  );
  const backgroundReady = backgroundMode === null || cropReady(
    backgroundMode,
    backgroundImageCropReady,
    backgroundVideoCropReady
  );
  const gallerySelectionReady = screenshots.length >= 1;
  const pendingGalleryCrops = screenshots.filter(
    (src) => !isImageCropConfirmed(imageMedia?.gallery?.[src])
  );
  const galleryCropReady = gallerySelectionReady && pendingGalleryCrops.length === 0;
  const galleryReady = gallerySelectionReady && galleryCropReady;
  const mandatoryRequirementsReady = coverCropReady && heroCropReady && cardCropReady && detailCropReady && galleryReady;
  const allRequirementsReady = mandatoryRequirementsReady && backgroundReady;

  function usageLabels(resource: LibraryResource) {
    const labels: string[] = [];
    if (resource.kind === "image") {
      if (resource.src === coverImage && coverMode !== "video") labels.push(coverMode === "hover-video" ? "Portada base" : "Portada");
      if (resource.src === heroImage && heroMode !== "video") labels.push(heroMode === "hover-video" ? "Hero base" : "Hero");
      if (resource.src === cardImage && cardMode !== "video") labels.push(cardMode === "hover-video" ? "Card base" : "Card");
      if (resource.src === detailImage && detailMode !== "video") labels.push(detailMode === "hover-video" ? "Contenedor base" : "Contenedor");
      if (resource.src === backgroundImage && backgroundMode !== "video") labels.push(backgroundMode === "hover-video" ? "Fondo base" : "Fondo");
      if (screenshots.includes(resource.src)) labels.push("Galería");
    } else {
      if (resource.src === coverVideo?.clip && coverMode !== "image") labels.push(coverMode === "hover-video" ? "Portada hover" : "Portada");
      if (resource.src === heroVideo?.clip && heroMode !== "image") labels.push(heroMode === "hover-video" ? "Hero hover" : "Hero");
      if (resource.src === resolvedCardClip && cardMode !== "image") labels.push(cardMode === "hover-video" ? "Card hover" : "Card");
      if (resource.src === detailVideo?.clip && detailMode !== "image") labels.push(detailMode === "hover-video" ? "Contenedor hover" : "Contenedor");
      if (resource.src === backgroundVideo?.clip && backgroundMode !== "image") labels.push(backgroundMode === "hover-video" ? "Fondo hover" : "Fondo");
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
          const galleryViewport = imageMedia?.gallery?.[src];
          const cropConfirmed = isImageCropConfirmed(galleryViewport);
          const cropAspectLabel = gameImageCropAspectLabel(galleryViewport);
          const cropStateLabel = `Recorte ${cropAspectLabel} ${cropConfirmed ? "confirmado" : "no confirmado"}`;
          return (
            <article
              key={src}
              className={`${contextualStyles.galleryItemCard} ${cropConfirmed ? contextualStyles.galleryItemComplete : contextualStyles.galleryItemMissing}`}
            >
              <div className={contextualStyles.galleryItemPreview}>
                <AdminMediaThumbnail
                  kind="image"
                  src={src}
                  viewport={galleryViewport}
                  mode="destination"
                  frameAspect={resolveGameImageCropAspectRatio(galleryViewport)}
                  label={`Captura ${index + 1} · ${cropStateLabel}`}
                  sizes={compact ? "120px" : "240px"}
                />
              </div>
              <div className={contextualStyles.galleryItemMeta}>
                <strong>{shortName(src)}</strong>
                <small>{resource ? imageMeta(resource) : `Captura ${index + 1}`}</small>
                <span className={cropConfirmed ? contextualStyles.galleryCropReady : contextualStyles.galleryCropMissing}>
                  {cropConfirmed ? <CheckCircle2 size={12} aria-hidden="true" /> : <Info size={12} aria-hidden="true" />}
                  {cropStateLabel}
                </span>
              </div>
              <div className={contextualStyles.galleryItemActions}>
                <button
                  type="button"
                  className={`${contextualStyles.galleryEditButton} ${requirementActionClass(cropConfirmed)}`}
                  aria-label={`Editar ${cropStateLabel}`}
                  disabled={stale}
                  onClick={() => openGalleryImage(src)}
                >
                  {cropConfirmed ? <CheckCircle2 size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
                  {cropStateLabel}
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
    hasVideo: boolean,
    imageCropReady: boolean,
    videoCropReady: boolean
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
            requirement={{
              complete: hasImage,
              missingLabel: mode === "hover-video" ? "Falta seleccionar imagen base" : "Falta seleccionar imagen",
              completeLabel: mode === "hover-video" ? "Imagen base seleccionada" : "Imagen seleccionada",
            }}
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
            requirement={{
              complete: hasVideo,
              missingLabel: mode === "hover-video" ? "Falta seleccionar video hover" : "Falta seleccionar video",
              completeLabel: mode === "hover-video" ? "Video hover seleccionado" : "Video seleccionado",
            }}
            disabled={stale}
            onAddResource={openAddResource}
          />
        )}
        {mode !== "video" && (
          <CropRequirementButton
            complete={imageCropReady}
            hasResource={hasImage}
            mediaKind="image"
            aspect={aspect}
            disabled={stale}
            onClick={() => openDestination(destination, "image")}
          />
        )}
        {mode !== "image" && (
          <CropRequirementButton
            complete={videoCropReady}
            hasResource={hasVideo}
            mediaKind="video"
            aspect={aspect}
            disabled={stale}
            onClick={() => openDestination(destination, "video")}
          />
        )}
      </div>
    );
  }

  function renderLibraryGroup(
    title: string,
    kind: "image" | "video",
    groupResources: LibraryResource[]
  ) {
    return (
      <section className={contextualStyles.libraryGroup} aria-label={`${title} de la biblioteca`}>
        <div className={contextualStyles.libraryGroupHeading}>
          <div>
            <strong>{title}</strong>
            <span>{kind === "image" ? "Archivos WebP y recursos existentes" : "Masters WebM editoriales"}</span>
          </div>
          <small>{groupResources.length} recurso{groupResources.length === 1 ? "" : "s"}</small>
        </div>
        {groupResources.length ? (
          <div className={styles.libraryGrid}>
            {groupResources.map((resource) => {
              const labels = usageLabels(resource);
              return (
                <article key={resource.src} className={styles.libraryCard}>
                  <div className={styles.libraryCardHeading}>
                    <div>
                      <span>{resource.kind === "video" ? "VIDEO" : resource.origin === "bundled" ? "IMAGEN EXISTENTE" : "IMAGEN"}</span>
                      <strong>{shortName(resource.src)}</strong>
                    </div>
                    <small>{formatBytes(resource.bytes)}</small>
                  </div>
                  <div className={contextualStyles.deletableArtwork}>
                    <button
                      type="button"
                      className={contextualStyles.libraryPreviewButton}
                      onClick={() => setPreviewResource(resource)}
                      aria-label={`Abrir vista grande de ${shortName(resource.src)}`}
                      title="Abrir vista grande"
                    >
                      {resource.kind === "image" ? (
                        <ResourceArtwork resource={resource} alt="Recurso de la biblioteca multimedia" />
                      ) : (
                        <AdminMediaThumbnail
                          kind="video"
                          src={resource.src}
                          mode="source"
                          label={`Fuente WebM ${shortName(resource.src)}`}
                          sizes="(max-width: 760px) 88vw, 300px"
                          className={styles.resourceArtwork}
                        />
                      )}
                    </button>
                    <DeleteResourceForm
                      action={endpoint}
                      revision={assignmentRevision}
                      resource={resource}
                      usages={labels}
                      disabled={stale}
                    />
                  </div>
                  <div className={styles.usageRow}>
                    {labels.length
                      ? labels.map((usageLabel) => <span key={usageLabel}>{usageLabel}</span>)
                      : <span className={styles.unusedBadge}>Disponible</span>}
                  </div>
                  <small className={styles.resourceDetails}>
                    {resource.kind === "image"
                      ? resource.origin === "bundled"
                        ? `${imageFormat(resource.src)} existente · reutilizable por referencia`
                        : `${resource.width}×${resource.height} · WebP seguro`
                      : "WebM validado · master reutilizable"}
                  </small>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={contextualStyles.libraryGroupEmpty}>
            No hay {kind === "image" ? "imágenes" : "videos"} guardados todavía.
          </div>
        )}
      </section>
    );
  }

  const galleryPendingLabel = !gallerySelectionReady
    ? "IMAGEN REQUERIDA"
    : pendingGalleryCrops.length === 1
      ? "1 RECORTE NO CONFIRMADO"
      : `${pendingGalleryCrops.length} RECORTES NO CONFIRMADOS`;
  const galleryCropActionLabel = galleryCropReady
    ? "Recortes confirmados"
    : pendingGalleryCrops.length > 1
      ? `${pendingGalleryCrops.length} recortes no confirmados`
      : "Recorte no confirmado";
  const gatePendingLabel = !mandatoryRequirementsReady
    ? "Confirma Portada 4:5, Hero 3:1, Card 3:2, Contenedor adaptable y al menos una imagen de Galería con su recorte confirmado."
    : "Completa el Fondo adaptable que activaste o vuelve a usar el fondo global.";

  return (
    <div className={styles.mediaWorkspace}>
      <section className={styles.summarySection} aria-labelledby="multimedia-summary-heading">
        <div className={styles.compactHeading}>
          <div>
            <span>RESUMEN MULTIMEDIA</span>
            <h2 id="multimedia-summary-heading">Requisitos obligatorios de destinos</h2>
          </div>
          <p>Portada, Hero, Card y Contenedor tienen recurso, modo y recorte independientes. Cada imagen de Galería elige y confirma su propia relación. Fondo permanece opcional mientras use el global.</p>
        </div>
        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <DestinationThumbnailSet
              mode={coverMode}
              imageSrc={coverResource?.src ?? null}
              imageViewport={imageMedia?.cover}
              videoSrc={activeCoverVideo?.src ?? null}
              videoViewport={coverVideo?.viewport}
              frameAspect={4 / 5}
              label="Resumen Portada"
              summary
            />
            {!((coverMode !== "video" && coverResource) || (coverMode !== "image" && activeCoverVideo)) && <span className={styles.summaryIcon}>{coverMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <MonitorPlay size={22} aria-hidden="true" />}</span>}
            <div><span>PORTADA · {REQUIRED_DESTINATION_ASPECTS.cover}</span><strong>{modeLabel(coverMode)}</strong><RequirementStatus ready={coverCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <DestinationThumbnailSet
              mode={heroMode}
              imageSrc={heroResource?.src ?? null}
              imageViewport={imageMedia?.hero}
              videoSrc={activeHeroVideo?.src ?? null}
              videoViewport={heroVideo?.viewport}
              frameAspect={3}
              label="Resumen Hero"
              summary
            />
            {!((heroMode !== "video" && heroResource) || (heroMode !== "image" && activeHeroVideo)) && <span className={styles.summaryIcon}>{heroMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <MonitorPlay size={22} aria-hidden="true" />}</span>}
            <div><span>HERO · {REQUIRED_DESTINATION_ASPECTS.hero}</span><strong>{modeLabel(heroMode)}</strong><RequirementStatus ready={heroCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <DestinationThumbnailSet
              mode={cardMode}
              imageSrc={cardResource?.src ?? null}
              imageViewport={imageMedia?.card}
              videoSrc={activeCardVideo?.src ?? null}
              videoViewport={activeCardVideoViewport}
              frameAspect={3 / 2}
              label="Resumen Card"
              summary
            />
            {!((cardMode !== "video" && cardResource) || (cardMode !== "image" && activeCardVideo)) && <span className={styles.summaryIcon}>{cardMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <Clapperboard size={22} aria-hidden="true" />}</span>}
            <div><span>CARD · {REQUIRED_DESTINATION_ASPECTS.card}</span><strong>{modeLabel(cardMode)}</strong><RequirementStatus ready={cardCropReady} pending="RECORTE PENDIENTE" /></div>
          </article>
          <article className={styles.summaryCard}>
            <DestinationThumbnailSet
              mode={detailMode}
              imageSrc={detailResource?.src ?? null}
              imageViewport={imageMedia?.detail}
              videoSrc={activeDetailVideo?.src ?? null}
              videoViewport={detailVideo?.viewport}
              frameAspect={16 / 9}
              label="Resumen Contenedor"
              summary
            />
            {!((detailMode !== "video" && detailResource) || (detailMode !== "image" && activeDetailVideo)) && <span className={styles.summaryIcon}>{detailMode === "image" ? <ImageIcon size={22} aria-hidden="true" /> : <MonitorPlay size={22} aria-hidden="true" />}</span>}
            <div><span>CONTENEDOR · ADAPTABLE</span><strong>{modeLabel(detailMode)}</strong><RequirementStatus ready={detailCropReady} pending="RECORTE PENDIENTE" readyLabel="RECORTE ADAPTABLE CONFIRMADO" /></div>
          </article>
          <article className={styles.summaryCard}>
            {firstGalleryResource ? (
              <AdminMediaThumbnail
                kind="image"
                src={firstGalleryResource.src}
                viewport={imageMedia?.gallery?.[firstGalleryResource.src]}
                mode="destination"
                frameAspect={resolveGameImageCropAspectRatio(imageMedia?.gallery?.[firstGalleryResource.src])}
                label="Resumen Galería"
                className={styles.summaryThumb}
              />
            ) : <span className={styles.summaryIcon}><Images size={22} aria-hidden="true" /></span>}
            <div><span>GALERÍA · MÍNIMO 1</span><strong>{screenshots.length} de 8 capturas</strong><RequirementStatus ready={galleryReady} pending={galleryPendingLabel} readyLabel="IMÁGENES Y RECORTES LISTOS" /></div>
          </article>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <section className={styles.numberedSection} aria-labelledby="destination-assignment-heading">
            <div className={styles.sectionTitleRow}>
              <div><span>01</span><div><h2 id="destination-assignment-heading">Asignación de destinos</h2><p>Portada, Hero, Card, Contenedor y Fondo eligen su modo y recursos de forma independiente. Fondo es opcional y puede volver al global; Galería permite elegir la relación de cada captura. Rojo indica lo que falta y verde confirma cada paso.</p></div></div>
            </div>

            <div className={styles.assignmentGrid}>
              <article className={styles.assignmentCard}>
                <header><div><span>A</span><h3>Portada del juego</h3></div><small>Recorte obligatorio · 4:5</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="cover" mode={coverMode} disabled={stale} />
                <div className={styles.currentResource}>
                  <DestinationThumbnailSet
                    mode={coverMode}
                    imageSrc={coverResource?.src ?? null}
                    imageViewport={imageMedia?.cover}
                    videoSrc={activeCoverVideo?.src ?? null}
                    videoViewport={coverVideo?.viewport}
                    frameAspect={4 / 5}
                    label="Portada"
                  />
                  {!((coverMode !== "video" && coverResource) || (coverMode !== "image" && activeCoverVideo)) && <span className={styles.currentIcon}>{coverMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <MonitorPlay size={20} aria-hidden="true" />}</span>}
                  <div><span>Modo activo</span><strong>{modeLabel(coverMode)}</strong><small>{coverMode === "hover-video" ? `${coverImage ? shortName(coverImage) : "Imagen pendiente"} + ${activeCoverVideo ? shortName(activeCoverVideo.src) : "video pendiente"}` : coverMode === "video" ? activeCoverVideo ? shortName(activeCoverVideo.src) : "Selecciona un video" : coverImage ? shortName(coverImage) : "Selecciona una imagen"}</small></div>
                </div>
                {destinationActions("cover", coverMode, Boolean(coverImage), Boolean(coverVideo), coverImageCropReady, coverVideoCropReady)}
                <RequirementStatus ready={coverCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 4:5" />
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>B</span><h3>Hero de inicio</h3></div><small>Recorte obligatorio · 3:1</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="hero" mode={heroMode} disabled={stale} />
                <div className={styles.currentResource}>
                  <DestinationThumbnailSet
                    mode={heroMode}
                    imageSrc={heroResource?.src ?? null}
                    imageViewport={imageMedia?.hero}
                    videoSrc={activeHeroVideo?.src ?? null}
                    videoViewport={heroVideo?.viewport}
                    frameAspect={3}
                    label="Hero"
                  />
                  {!((heroMode !== "video" && heroResource) || (heroMode !== "image" && activeHeroVideo)) && <span className={styles.currentIcon}>{heroMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <MonitorPlay size={20} aria-hidden="true" />}</span>}
                  <div><span>Modo activo</span><strong>{modeLabel(heroMode)}</strong><small>{heroMode === "hover-video" ? `${heroImage ? shortName(heroImage) : "Imagen pendiente"} + ${activeHeroVideo ? shortName(activeHeroVideo.src) : "video pendiente"}` : heroMode === "video" ? activeHeroVideo ? shortName(activeHeroVideo.src) : "Selecciona un video" : heroImage ? shortName(heroImage) : "Selecciona una imagen"}</small></div>
                </div>
                {destinationActions("hero", heroMode, Boolean(heroImage), Boolean(heroVideo), heroImageCropReady, heroVideoCropReady)}
                <RequirementStatus ready={heroCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 3:1" />
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>C</span><h3>Card del juego</h3></div><small>Recorte obligatorio · 3:2</small></header>
                <ModeSwitch action={endpoint} revision={assignmentRevision} target="card" mode={cardMode} disabled={stale} />
                <div className={styles.currentResource}>
                  <DestinationThumbnailSet
                    mode={cardMode}
                    imageSrc={cardResource?.src ?? null}
                    imageViewport={imageMedia?.card}
                    videoSrc={activeCardVideo?.src ?? null}
                    videoViewport={activeCardVideoViewport}
                    frameAspect={3 / 2}
                    label="Card"
                  />
                  {!((cardMode !== "video" && cardResource) || (cardMode !== "image" && activeCardVideo)) && <span className={styles.currentIcon}>{cardMode === "image" ? <ImageIcon size={20} aria-hidden="true" /> : <Clapperboard size={20} aria-hidden="true" />}</span>}
                  <div><span>Recurso independiente</span><strong>{modeLabel(cardMode)}</strong><small>{cardMode === "hover-video" ? `${cardImage ? shortName(cardImage) : "Imagen pendiente"} + ${activeCardVideo ? shortName(activeCardVideo.src) : "video pendiente"}` : cardMode === "video" ? activeCardVideo ? shortName(activeCardVideo.src) : "Selecciona un video" : cardImage ? shortName(cardImage) : "Selecciona una imagen propia para Card"}</small></div>
                </div>
                {destinationActions("card", cardMode, Boolean(cardImage), Boolean(resolvedCardClip), cardImageCropReady, cardVideoCropReady)}
                <RequirementStatus ready={cardCropReady} pending="COMPLETA LOS RECURSOS Y RECORTES · 3:2" />
              </article>

              <GameBackgroundMediaEditor
                slug={slug}
                revision={assignmentRevision}
                resources={resources}
                assignment={{
                  mode: backgroundMode,
                  image: backgroundImage,
                  imageViewport: imageMedia?.background ?? null,
                  video: backgroundVideo,
                }}
                stale={stale}
              />

              <GameDetailMediaEditor
                slug={slug}
                revision={assignmentRevision}
                endpoint={endpoint}
                resources={resources}
                assignment={{
                  mode: detailMode,
                  image: detailImage,
                  imageViewport: imageMedia?.detail ?? null,
                  video: detailVideo,
                }}
                stale={stale}
                onAddResource={openAddResource}
              />

              <article className={`${styles.assignmentCard} ${contextualStyles.galleryAssignmentCard}`}>
                <header><div><span>F</span><h3>Galería del juego</h3></div><small>Obligatoria · mínimo 1 imagen · relación elegible</small></header>
                <div className={styles.currentResource}>
                  {firstGalleryResource ? (
                    <AdminMediaThumbnail
                      kind="image"
                      src={firstGalleryResource.src}
                      viewport={imageMedia?.gallery?.[firstGalleryResource.src]}
                      mode="destination"
                      frameAspect={resolveGameImageCropAspectRatio(imageMedia?.gallery?.[firstGalleryResource.src])}
                      label="Primera captura de Galería"
                      className={styles.currentThumb}
                    />
                  ) : <span className={styles.currentIcon}><Images size={20} aria-hidden="true" /></span>}
                  <div><span>Capturas asignadas</span><strong>{screenshots.length} de 8</strong><small>Cada captura elige 16:9, 3:1, 3:2, 1:1, 4:5, 9:16 o Libre y debe confirmar su recorte. Quitar una captura no destruye el recurso.</small></div>
                </div>
                {renderGalleryAssignedItems(true)}
                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target="gallery-image"
                    resources={resources}
                    kind="image"
                    requirement={{
                      complete: gallerySelectionReady,
                      missingLabel: "Falta seleccionar imagen",
                      completeLabel: "Imagen seleccionada",
                    }}
                    disabled={stale || screenshots.length >= 8}
                    onAddResource={openAddResource}
                  />
                  <button
                    type="button"
                    className={`${styles.editDestinationButton} ${requirementActionClass(galleryCropReady)}`}
                    data-requirement-state={galleryCropReady ? "complete" : "missing"}
                    aria-label="Gestionar galería"
                    disabled={stale || !gallerySelectionReady}
                    onClick={() => setGalleryManagerOpen(true)}
                  >
                    <RequirementActionIcon complete={galleryCropReady} />
                    {galleryCropActionLabel}
                  </button>
                </div>
                <RequirementStatus ready={galleryReady} pending={galleryPendingLabel} readyLabel="REQUISITO CUMPLIDO · RECORTES CONFIRMADOS" />
              </article>
            </div>

            <div className={contextualStyles.continueGate}>
              <div>
                <strong>{allRequirementsReady ? "Multimedia completa" : "No puedes avanzar todavía"}</strong>
                <span>{allRequirementsReady ? "Portada, Hero, Card, Contenedor, Galería y cualquier Fondo activado están listos." : gatePendingLabel}</span>
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
              <div><span>02</span><div><h2 id="shared-library-heading">Biblioteca multimedia compartida</h2><p>Administra los masters reutilizables. Imágenes y videos comparten la misma biblioteca, pero se muestran separados para encontrarlos más rápido.</p></div></div>
              <button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}><Upload size={16} aria-hidden="true" />Agregar nuevo recurso</button>
            </div>
            {loading ? (
              <div className={styles.libraryStatus} role="status">Comprobando recursos multimedia seguros…</div>
            ) : error ? (
              <div className={styles.libraryStatus} role="alert">{error}</div>
            ) : resources.length === 0 ? (
              <div className={styles.emptyLibrary}><FolderOpen size={30} aria-hidden="true" /><strong>La biblioteca todavía está vacía</strong><span>Agrega una imagen o crea un video editorial para empezar.</span><button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}><Plus size={16} aria-hidden="true" />Agregar primer recurso</button></div>
            ) : (
              <div className={contextualStyles.libraryGroups}>
                {renderLibraryGroup("IMÁGENES", "image", images)}
                {renderLibraryGroup("VIDEOS", "video", videos)}
              </div>
            )}
          </section>

          {stale && <div className={styles.staleNotice} role="alert"><Info size={18} aria-hidden="true" /><div><strong>La revisión multimedia cambió</strong><span>Recarga esta página antes de asignar o editar otro recurso.</span></div></div>}
        </div>

        <aside className={styles.helpRail}>
          <section>
            <div className={styles.helpHeading}><Info size={18} aria-hidden="true" /><h2>Requisitos</h2></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Portada · 4:5</strong><span>Imagen, Video o Imagen + hover; cada capa activa confirma selección y encuadre. Esta Portada también alimenta la tarjeta pequeña Siguiente de Inicio.</span></div></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Hero · 3:1</strong><span>Hero panorámico principal de Inicio. Imagen, Video o Imagen + hover; hover exige ambos recursos y ambos recortes 3:1.</span></div></div>
            <div className={styles.helpRule}><Clapperboard size={20} aria-hidden="true" /><div><strong>Card · 3:2</strong><span>Su imagen es independiente de Portada; selección y recorte se validan por separado.</span></div></div>
            <div className={styles.helpRule}><Sparkles size={20} aria-hidden="true" /><div><strong>Fondo · adaptable</strong><span>Es opcional. Puede usar Imagen, Video o Imagen + hover con recorte adaptable propio, o volver al fondo global.</span></div></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Contenedor · adaptable</strong><span>Es obligatorio e independiente del Hero. La ficha adapta X/Y/zoom a su altura real en escritorio y móvil.</span></div></div>
            <div className={styles.helpRule}><Images size={20} aria-hidden="true" /><div><strong>Galería obligatoria · relación elegible</strong><span>Mínimo una imagen. Cada captura elige su relación; Libre habilita arrastre por bordes y esquinas.</span></div></div>
          </section>
          <section className={styles.tipCard}><Sparkles size={20} aria-hidden="true" /><div><strong>Reutilizar sin acoplar</strong><p>Puedes elegir el mismo archivo físico en dos destinos, pero cada asignación y recorte se conserva de forma independiente.</p></div></section>
        </aside>
      </div>

      {previewResource && (
        <AdminMediaLibraryPreview
          kind={previewResource.kind}
          src={previewResource.src}
          name={shortName(previewResource.src)}
          details={previewResource.kind === "image" ? imageMeta(previewResource) : `WebM · ${formatBytes(previewResource.bytes)}`}
          usage={usageLabels(previewResource)}
          onClose={() => setPreviewResource(null)}
        />
      )}

      {editingDestination && (editingVideo || editingImage) && (
        <ContextualMediaDialog eyebrow="RECORTE OBLIGATORIO" title={editingDestination === "cover" ? "Recorte 4:5 de la Portada" : editingDestination === "hero" ? "Recorte 3:1 del Hero" : "Recorte 3:2 de la Card"} description="Debes guardar este recorte para completar el destino. El archivo físico permanece intacto." onClose={() => setEditingDestination(null)}>
          {editingVideo ? (
            <GameVideoViewportEditor slug={slug} revision={assignmentRevision} target={editingVideo.target} source={editingVideo.source} clip={editingVideo.clip} label={editingVideo.label} initialViewport={editingVideo.viewport} onClose={() => setEditingDestination(null)} />
          ) : editingImage ? (
            <ImageViewportEditor slug={slug} revision={assignmentRevision} target={editingImage.target} src={editingImage.src} label={editingImage.label} initialViewport={editingImage.viewport} onClose={() => setEditingDestination(null)} />
          ) : null}
        </ContextualMediaDialog>
      )}

      {editingGalleryImage && galleryEditingResource && (
        <ContextualMediaDialog eyebrow="EDITAR GALERÍA" title="Recorte de la captura" description="Elige una relación o usa Libre para ajustar el marco con sus bordes y esquinas. La imagen original sigue intacta y reutilizable." onClose={() => setEditingGalleryImage(null)}>
          <ImageViewportEditor slug={slug} revision={assignmentRevision} target="gallery" src={editingGalleryImage} resource={editingGalleryImage} label={`Galería · ${shortName(editingGalleryImage)}`} initialViewport={imageMedia?.gallery?.[editingGalleryImage]} onClose={() => setEditingGalleryImage(null)} />
        </ContextualMediaDialog>
      )}

      {galleryManagerOpen && (
        <ContextualMediaDialog eyebrow="GALERÍA DEL JUEGO" title="Gestionar capturas" description="Cada imagen asignada elige su relación y debe confirmar el recorte. Libre permite redimensionar desde bordes y esquinas. Quitar conserva el recurso en la biblioteca." onClose={() => setGalleryManagerOpen(false)}>
          <div className={contextualStyles.galleryManagerHeader}><div><strong>{screenshots.length} de 8 imágenes asignadas</strong><span>{pendingGalleryCrops.length ? `${pendingGalleryCrops.length} recorte${pendingGalleryCrops.length === 1 ? "" : "s"} pendiente${pendingGalleryCrops.length === 1 ? "" : "s"} de confirmar.` : "Todos los recortes están confirmados."}</span></div><ResourcePicker action={endpoint} revision={assignmentRevision} target="gallery-image" resources={resources} kind="image" label="Añadir imagen" disabled={stale || screenshots.length >= 8} onAddResource={openAddResource} /></div>
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
