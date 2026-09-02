"use client";

import Image from "next/image";
import {
  CheckCircle2,
  Clapperboard,
  FolderOpen,
  ImageIcon,
  Images,
  Info,
  Link2,
  MonitorPlay,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
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
import { DEFAULT_PREVIEW_VIEWPORT } from "@/lib/media/preview-video-policy";
import type {
  GameCardVideo,
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
type HeroDraftMode = "image" | "video";
type AddResourceKind = "image" | "video";

type LibraryState = {
  revision: number;
  resources: LibraryResource[];
  assignments: {
    coverImage: string | null;
    heroImage: string | null;
    screenshots: string[];
    imageMedia: GameImageMedia | null;
    heroMode: HeroDraftMode;
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
  target: "hero" | "card";
  source: "hero" | "independent";
  clip: string;
  viewport: GameVideoViewport;
  label: string;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(
      bytes >= 10 * 1024 * 1024 ? 0 : 1
    )} MB`;
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
    typeof viewport.x === "number" &&
    viewport.x >= 0 &&
    viewport.x <= 1 &&
    typeof viewport.y === "number" &&
    viewport.y >= 0 &&
    viewport.y <= 1 &&
    typeof viewport.zoom === "number" &&
    viewport.zoom >= 1 &&
    viewport.zoom <= 3
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
    (assignments.heroMode !== "image" && assignments.heroMode !== "video") ||
    !Array.isArray(assignments.screenshots) ||
    (assignments.imageMedia !== null &&
      assignments.imageMedia !== undefined &&
      !isImageMedia(assignments.imageMedia))
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
      <Image
        src={resource.src}
        alt={alt}
        fill
        sizes="(max-width: 760px) 88vw, 280px"
      />
    </div>
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
      {kind === "image" ? (
        <ImageIcon size={18} aria-hidden="true" />
      ) : (
        <MonitorPlay size={18} aria-hidden="true" />
      )}
      <span>{label}</span>
    </>
  );

  if (disabled) {
    return (
      <button type="button" className={styles.selectResourceButton} disabled>
        {buttonContent}
      </button>
    );
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
                  <span className={styles.choiceThumb}>
                    <Image src={resource.src} alt="" fill sizes="96px" />
                  </span>
                ) : (
                  <span className={styles.choiceVideoIcon}>
                    <Clapperboard size={21} aria-hidden="true" />
                  </span>
                )}
                <span className={styles.choiceMeta}>
                  <strong>{shortName(resource.src)}</strong>
                  <small>
                    {resource.kind === "image"
                      ? imageMeta(resource)
                      : `WebM · ${formatBytes(resource.bytes)}`}
                  </small>
                </span>
              </AssignmentForm>
            ))}
          </div>
        ) : (
          <p className={styles.emptyPicker}>
            No hay {kind === "image" ? "imágenes" : "videos"} disponibles todavía.
          </p>
        )}

        <div className={contextualStyles.pickerFooter}>
          <button
            type="button"
            className={contextualStyles.pickerAddButton}
            onClick={() => onAddResource(kind)}
          >
            <Plus size={16} aria-hidden="true" />
            Agregar nuevo recurso
          </button>
        </div>
      </div>
    </details>
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
  const [heroDraftMode, setHeroDraftMode] = useState<HeroDraftMode>("image");
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [editingGalleryImage, setEditingGalleryImage] = useState<string | null>(null);
  const [galleryManagerOpen, setGalleryManagerOpen] = useState(false);
  const [addResourceKind, setAddResourceKind] = useState<AddResourceKind | null>(null);

  const endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`;

  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        const parsed = parseLibraryState(payload);
        if (!response.ok || !parsed) {
          throw new Error("No se pudo cargar la biblioteca multimedia compartida.");
        }
        if (cancelled) return;
        setState(parsed);
        setHeroDraftMode(parsed.assignments.heroMode);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar la biblioteca multimedia."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const resources = state?.resources ?? [];
  const images = resources.filter(
    (resource): resource is ResourceImage => resource.kind === "image"
  );
  const videos = resources.filter(
    (resource): resource is ResourceVideo => resource.kind === "video"
  );
  const coverImage = state?.assignments.coverImage ?? initialCoverImage ?? null;
  const heroImage = state?.assignments.heroImage ?? initialHeroImage ?? null;
  const screenshots = state?.assignments.screenshots ?? [...initialScreenshots];
  const imageMedia = state?.assignments.imageMedia ?? null;
  const heroVideo = state?.assignments.heroVideo ?? null;
  const currentHeroMode = state?.assignments.heroMode ?? heroDraftMode;
  const heroModePending = heroDraftMode !== currentHeroMode;
  const resolvedCardClip = cardClip(state);
  const assignmentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  function imageBySrc(src: string | null) {
    return src ? images.find((resource) => resource.src === src) ?? null : null;
  }

  const coverResource = imageBySrc(coverImage);
  const heroResource = imageBySrc(heroImage);
  const firstGalleryResource = imageBySrc(screenshots[0] ?? null);
  const activeCardVideo = videos.find((resource) => resource.src === resolvedCardClip) ?? null;

  function usageLabels(resource: LibraryResource) {
    const labels: string[] = [];
    if (resource.kind === "image") {
      if (resource.src === coverImage) labels.push("Portada");
      if (resource.src === heroImage && currentHeroMode === "image") labels.push("Hero");
      if (screenshots.includes(resource.src)) labels.push("Galería");
      if (resource.src === coverImage) labels.push("Card base");
    } else {
      if (resource.src === heroVideo?.clip) labels.push("Hero");
      if (resource.src === resolvedCardClip) labels.push("Card");
    }
    return labels;
  }

  function videoEditorConfig(destination: Destination): VideoEditorConfig | null {
    if (destination === "hero") {
      if (!heroVideo) return null;
      return {
        target: "hero",
        source: "hero",
        clip: heroVideo.clip,
        viewport: heroVideo.viewport,
        label: "Hero de inicio",
      };
    }

    if (destination !== "card") return null;
    const card = state?.assignments.cardVideo;
    if (card?.source === "hero" && heroVideo) {
      return {
        target: "card",
        source: "hero",
        clip: heroVideo.clip,
        viewport: card.viewport,
        label: "Card · mismo WebM del Hero",
      };
    }
    if (card?.source === "independent") {
      return {
        target: "card",
        source: "independent",
        clip: card.clip,
        viewport: card.viewport,
        label: "Card · WebM independiente",
      };
    }
    if (state?.assignments.legacyPreviewClip) {
      return {
        target: "card",
        source: "independent",
        clip: state.assignments.legacyPreviewClip,
        viewport: { ...DEFAULT_PREVIEW_VIEWPORT },
        label: "Card · preview heredado",
      };
    }
    return null;
  }

  function imageEditorConfig(destination: Destination) {
    if (destination === "cover" && coverImage) {
      return {
        target: "cover" as const,
        src: coverImage,
        viewport: imageMedia?.cover,
        label: `Portada · ${shortName(coverImage)}`,
      };
    }
    if (destination === "hero" && heroDraftMode === "image" && heroImage) {
      return {
        target: "hero" as const,
        src: heroImage,
        viewport: imageMedia?.hero,
        label: `Hero · ${shortName(heroImage)}`,
      };
    }
    if (destination === "card" && !resolvedCardClip && coverImage) {
      return {
        target: "card" as const,
        src: coverImage,
        viewport: imageMedia?.card ?? imageMedia?.cover,
        label: `Card · ${shortName(coverImage)}`,
      };
    }
    return null;
  }

  const editingVideo = editingDestination ? videoEditorConfig(editingDestination) : null;
  const editingImage = editingDestination && !editingVideo
    ? imageEditorConfig(editingDestination)
    : null;
  const galleryEditingResource = editingGalleryImage
    ? imageBySrc(editingGalleryImage)
    : null;

  function openDestination(destination: Destination) {
    if (stale) return;
    const video = videoEditorConfig(destination);
    const image = imageEditorConfig(destination);
    if (video || image) {
      setEditingDestination(destination);
      return;
    }
    if (destination === "hero" && heroDraftMode === "video") {
      setAddResourceKind("video");
      return;
    }
    setAddResourceKind("image");
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
          <span>Todavía no hay imágenes asignadas a la Galería.</span>
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
                <Image
                  src={src}
                  alt={`Captura ${index + 1}`}
                  fill
                  sizes={compact ? "120px" : "240px"}
                />
              </div>
              <div className={contextualStyles.galleryItemMeta}>
                <strong>{shortName(src)}</strong>
                <small>{resource ? imageMeta(resource) : `Captura ${index + 1}`}</small>
              </div>
              <div className={contextualStyles.galleryItemActions}>
                <button
                  type="button"
                  className={contextualStyles.galleryEditButton}
                  disabled={stale}
                  onClick={() => openGalleryImage(src)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Editar
                </button>
                <form method="post" action={endpoint}>
                  <input type="hidden" name="expectedRevision" value={assignmentRevision} />
                  <input type="hidden" name="target" value="gallery-remove" />
                  <input type="hidden" name="resource" value={src} />
                  <button
                    type="submit"
                    className={contextualStyles.galleryRemoveButton}
                    disabled={stale}
                    aria-label={`Quitar ${shortName(src)} de la Galería`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Quitar
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.mediaWorkspace}>
      <section className={styles.summarySection} aria-labelledby="multimedia-summary-heading">
        <div className={styles.compactHeading}>
          <div>
            <span>RESUMEN MULTIMEDIA</span>
            <h2 id="multimedia-summary-heading">Estado actual de los destinos</h2>
          </div>
          <p>Biblioteca única, recursos reutilizables y encuadres independientes sin duplicar archivos.</p>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            {coverResource ? (
              <span className={styles.summaryThumb}><Image src={coverResource.src} alt="" fill sizes="88px" /></span>
            ) : (
              <span className={styles.summaryIcon}><ImageIcon size={22} aria-hidden="true" /></span>
            )}
            <div>
              <span>PORTADA</span>
              <strong>{coverImage ? shortName(coverImage) : "Sin asignar"}</strong>
              <small><CheckCircle2 size={13} aria-hidden="true" />{coverImage ? "Asignada" : "Pendiente"}</small>
            </div>
          </article>

          <article className={styles.summaryCard}>
            {currentHeroMode === "video" ? (
              <span className={styles.summaryIcon}><MonitorPlay size={22} aria-hidden="true" /></span>
            ) : heroResource ? (
              <span className={styles.summaryThumb}><Image src={heroResource.src} alt="" fill sizes="88px" /></span>
            ) : (
              <span className={styles.summaryIcon}><ImageIcon size={22} aria-hidden="true" /></span>
            )}
            <div>
              <span>HERO</span>
              <strong>
                {currentHeroMode === "video"
                  ? heroVideo ? shortName(heroVideo.clip) : "Video pendiente"
                  : heroImage ? shortName(heroImage) : "Sin asignar"}
              </strong>
              <small><CheckCircle2 size={13} aria-hidden="true" />{currentHeroMode === "video" ? "Modo video" : "Modo imagen"}</small>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}><Clapperboard size={22} aria-hidden="true" /></span>
            <div>
              <span>CARD</span>
              <strong>{resolvedCardClip ? shortName(resolvedCardClip) : "Portada estática"}</strong>
              <small>
                <CheckCircle2 size={13} aria-hidden="true" />
                {state?.assignments.cardVideo?.source === "hero"
                  ? "Comparte Hero"
                  : resolvedCardClip ? "Preview asignado" : "Imagen compartida"}
              </small>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}><Images size={22} aria-hidden="true" /></span>
            <div>
              <span>GALERÍA</span>
              <strong>{screenshots.length} de 8 capturas</strong>
              <small><CheckCircle2 size={13} aria-hidden="true" />{screenshots.length ? "Disponible" : "Pendiente"}</small>
            </div>
          </article>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <section className={styles.numberedSection} aria-labelledby="shared-library-heading">
            <div className={styles.sectionTitleRow}>
              <div>
                <span>01</span>
                <div>
                  <h2 id="shared-library-heading">Biblioteca multimedia compartida</h2>
                  <p>Sube una vez y reutiliza. Portada, Hero, Card y Galería apuntan al mismo archivo físico cuando conviene.</p>
                </div>
              </div>
              <button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}>
                <Upload size={16} aria-hidden="true" />
                Agregar nuevo recurso
              </button>
            </div>

            {loading ? (
              <div className={styles.libraryStatus} role="status">Comprobando recursos multimedia seguros…</div>
            ) : error ? (
              <div className={styles.libraryStatus} role="alert">{error}</div>
            ) : resources.length === 0 ? (
              <div className={styles.emptyLibrary}>
                <FolderOpen size={30} aria-hidden="true" />
                <strong>La biblioteca todavía está vacía</strong>
                <span>Agrega una imagen o crea un video editorial para empezar.</span>
                <button type="button" className={styles.secondaryAction} onClick={() => openAddResource("image")}>
                  <Plus size={16} aria-hidden="true" />
                  Agregar primer recurso
                </button>
              </div>
            ) : (
              <div className={styles.libraryGrid}>
                {resources.map((resource) => {
                  const labels = usageLabels(resource);
                  return (
                    <article key={resource.src} className={styles.libraryCard}>
                      <div className={styles.libraryCardHeading}>
                        <div>
                          <span>
                            {resource.kind === "video"
                              ? "VIDEO"
                              : resource.origin === "bundled" ? "IMAGEN EXISTENTE" : "IMAGEN"}
                          </span>
                          <strong>{shortName(resource.src)}</strong>
                        </div>
                        <small>{formatBytes(resource.bytes)}</small>
                      </div>

                      {resource.kind === "image" ? (
                        <ResourceArtwork resource={resource} alt="Recurso de la biblioteca multimedia" />
                      ) : (
                        <div className={styles.videoPlaceholder}>
                          <MonitorPlay size={30} aria-hidden="true" />
                          <span>WebM interno</span>
                          <small>No se reproduce hasta abrir un editor.</small>
                        </div>
                      )}

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
            )}
          </section>

          <section className={styles.numberedSection} aria-labelledby="destination-assignment-heading">
            <div className={styles.sectionTitleRow}>
              <div>
                <span>02</span>
                <div>
                  <h2 id="destination-assignment-heading">Asignación de destinos</h2>
                  <p>Selecciona el recurso y usa “Editar destino” para ajustar la zona visible. La edición abre sólo cuando la necesitas.</p>
                </div>
              </div>
            </div>

            <div className={styles.assignmentGrid}>
              <article className={styles.assignmentCard}>
                <header><div><span>A</span><h3>Portada del juego</h3></div><small>Imagen</small></header>
                <div className={styles.currentResource}>
                  {coverResource ? (
                    <span className={styles.currentThumb}><Image src={coverResource.src} alt="" fill sizes="72px" /></span>
                  ) : (
                    <span className={styles.currentIcon}><ImageIcon size={20} aria-hidden="true" /></span>
                  )}
                  <div>
                    <span>Recurso asignado</span>
                    <strong>{coverImage ? shortName(coverImage) : "Sin recurso"}</strong>
                    <small>{coverResource ? imageMeta(coverResource) : "Selecciona una imagen de la biblioteca"}</small>
                  </div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target="cover-image" resources={resources} kind="image" disabled={stale} onAddResource={openAddResource} />
                  <button
                    type="button"
                    className={`${styles.editDestinationButton} ${!coverImage ? contextualStyles.editButtonDisabled : ""}`}
                    disabled={!coverImage || stale}
                    onClick={() => openDestination("cover")}
                  >
                    Editar destino
                  </button>
                </div>
                <small className={styles.assignmentStatus}><CheckCircle2 size={13} aria-hidden="true" />{coverImage ? "Asignada · encuadre editable" : "Pendiente"}</small>
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>B</span><h3>Hero de inicio</h3></div><small>Imagen o video</small></header>
                <div className={styles.modeSwitch} role="group" aria-label="Modo del Hero">
                  <button type="button" className={heroDraftMode === "image" ? styles.modeActive : ""} onClick={() => setHeroDraftMode("image")}>Imagen</button>
                  <button type="button" className={heroDraftMode === "video" ? styles.modeActive : ""} onClick={() => setHeroDraftMode("video")}>Video</button>
                </div>
                <div className={styles.currentResource}>
                  {heroDraftMode === "image" && heroResource ? (
                    <span className={styles.currentThumb}><Image src={heroResource.src} alt="" fill sizes="72px" /></span>
                  ) : (
                    <span className={styles.currentIcon}>
                      {heroDraftMode === "video" ? <MonitorPlay size={20} aria-hidden="true" /> : <ImageIcon size={20} aria-hidden="true" />}
                    </span>
                  )}
                  <div>
                    <span>{heroModePending ? "Modo preparado" : "Recurso asignado"}</span>
                    <strong>
                      {heroDraftMode === "video"
                        ? heroVideo ? shortName(heroVideo.clip) : "Selecciona un video"
                        : heroImage ? shortName(heroImage) : "Selecciona una imagen"}
                    </strong>
                    <small>
                      {heroModePending
                        ? "El modo se aplica al elegir un recurso. La fuente anterior sigue en la biblioteca."
                        : heroDraftMode === "video"
                          ? "Video activo · encuadre editable sin recortar tiempo."
                          : "Imagen activa · foco y zoom editables."}
                    </small>
                  </div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target={heroDraftMode === "video" ? "hero-video" : "hero-image"}
                    resources={resources}
                    kind={heroDraftMode}
                    disabled={stale}
                    onAddResource={openAddResource}
                  />
                  <button type="button" className={styles.editDestinationButton} disabled={stale} onClick={() => openDestination("hero")}>Editar destino</button>
                </div>
                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {heroModePending ? "Cambio pendiente de recurso" : currentHeroMode === "video" ? "Video activo" : heroImage ? "Imagen activa" : "Pendiente"}
                </small>
              </article>

              <article className={styles.assignmentCard}>
                <header><div><span>C</span><h3>Card del juego</h3></div><small>Imagen o preview</small></header>
                <div className={styles.currentResource}>
                  {activeCardVideo ? (
                    <span className={styles.currentIcon}><Clapperboard size={20} aria-hidden="true" /></span>
                  ) : coverResource ? (
                    <span className={styles.currentThumb}><Image src={coverResource.src} alt="" fill sizes="72px" /></span>
                  ) : (
                    <span className={styles.currentIcon}><ImageIcon size={20} aria-hidden="true" /></span>
                  )}
                  <div>
                    <span>{activeCardVideo ? "Video asignado" : "Imagen compartida"}</span>
                    <strong>{activeCardVideo ? shortName(activeCardVideo.src) : coverImage ? shortName(coverImage) : "Sin recurso"}</strong>
                    <small>
                      {state?.assignments.cardVideo?.source === "hero"
                        ? "Mismos bytes del Hero · encuadre propio"
                        : activeCardVideo
                          ? "WebM de biblioteca · encuadre propio"
                          : "Usa la misma portada física con encuadre de Card independiente."}
                    </small>
                  </div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target="card-video" resources={resources} kind="video" disabled={stale} onAddResource={openAddResource} />
                  <AssignmentForm action={endpoint} revision={assignmentRevision} target="card-match-hero" resource="" disabled={stale || !heroVideo}>
                    <Link2 size={17} aria-hidden="true" />
                    <span className={styles.choiceMeta}>
                      <strong>Igualar al Hero</strong>
                      <small>{heroVideo ? "Mismo WebM, sin duplicar" : "Disponible cuando Hero usa video"}</small>
                    </span>
                  </AssignmentForm>
                  <button
                    type="button"
                    className={`${styles.editDestinationButton} ${!resolvedCardClip && !coverImage ? contextualStyles.editButtonDisabled : ""}`}
                    disabled={stale || (!resolvedCardClip && !coverImage)}
                    onClick={() => openDestination("card")}
                  >
                    Editar destino
                  </button>
                </div>
                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {state?.assignments.cardVideo?.source === "hero"
                    ? "Comparte Hero · encuadre propio"
                    : activeCardVideo ? "Preview asignado" : coverImage ? "Imagen compartida · encuadre propio" : "Pendiente"}
                </small>
              </article>

              <article className={`${styles.assignmentCard} ${contextualStyles.galleryAssignmentCard}`}>
                <header><div><span>D</span><h3>Galería del juego</h3></div><small>Hasta 8 imágenes</small></header>
                <div className={styles.currentResource}>
                  {firstGalleryResource ? (
                    <span className={styles.currentThumb}><Image src={firstGalleryResource.src} alt="" fill sizes="72px" /></span>
                  ) : (
                    <span className={styles.currentIcon}><Images size={20} aria-hidden="true" /></span>
                  )}
                  <div>
                    <span>Capturas asignadas</span>
                    <strong>{screenshots.length} de 8</strong>
                    <small>Cada captura se puede encuadrar o quitar sin borrar el recurso de la biblioteca.</small>
                  </div>
                </div>

                {renderGalleryAssignedItems(true)}

                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target="gallery-image"
                    resources={resources}
                    kind="image"
                    label="Añadir desde biblioteca"
                    disabled={stale || screenshots.length >= 8}
                    onAddResource={openAddResource}
                  />
                  <button
                    type="button"
                    className={styles.editDestinationButton}
                    disabled={stale}
                    onClick={() => setGalleryManagerOpen(true)}
                  >
                    Gestionar galería
                  </button>
                </div>
                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {screenshots.length ? `${screenshots.length} captura${screenshots.length === 1 ? "" : "s"} · editables` : "Pendiente"}
                </small>
              </article>
            </div>
          </section>

          {stale && (
            <div className={styles.staleNotice} role="alert">
              <Info size={18} aria-hidden="true" />
              <div>
                <strong>La revisión multimedia cambió</strong>
                <span>Recarga esta página antes de asignar o editar otro recurso.</span>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.helpRail}>
          <section>
            <div className={styles.helpHeading}><Info size={18} aria-hidden="true" /><h2>Reglas y ayuda</h2></div>
            <div className={styles.helpRule}><FolderOpen size={20} aria-hidden="true" /><div><strong>Todo sale de la biblioteca</strong><span>Un recurso físico puede servir a varios destinos.</span></div></div>
            <div className={styles.helpRule}><MonitorPlay size={20} aria-hidden="true" /><div><strong>Hero: imagen o video</strong><span>Nunca se muestran ambos a la vez.</span></div></div>
            <div className={styles.helpRule}><Link2 size={20} aria-hidden="true" /><div><strong>Encuadres independientes</strong><span>Card, Hero y Galería pueden mostrar zonas distintas del mismo archivo.</span></div></div>
            <div className={styles.helpRule}><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Editar no duplica</strong><span>Posición y zoom se guardan como metadata visual.</span></div></div>
          </section>
          <section className={styles.tipCard}>
            <Sparkles size={20} aria-hidden="true" />
            <div><strong>Consejo avanzado</strong><p>Usa el punto focal para mantener personajes o elementos importantes dentro de la zona visible.</p></div>
          </section>
        </aside>
      </div>

      {editingDestination && (editingVideo || editingImage) && (
        <ContextualMediaDialog
          eyebrow="EDITAR DESTINO"
          title={editingDestination === "cover" ? "Encuadre de la Portada" : editingDestination === "hero" ? "Encuadre del Hero" : "Encuadre de la Card"}
          description="Sólo cambia cómo se presenta el recurso en este destino. El archivo físico permanece intacto y reutilizable."
          onClose={() => setEditingDestination(null)}
        >
          {editingVideo ? (
            <GameVideoViewportEditor
              slug={slug}
              revision={assignmentRevision}
              target={editingVideo.target}
              source={editingVideo.source}
              clip={editingVideo.clip}
              label={editingVideo.label}
              initialViewport={editingVideo.viewport}
              onClose={() => setEditingDestination(null)}
            />
          ) : editingImage ? (
            <ImageViewportEditor
              slug={slug}
              revision={assignmentRevision}
              target={editingImage.target}
              src={editingImage.src}
              label={editingImage.label}
              initialViewport={editingImage.viewport}
              onClose={() => setEditingDestination(null)}
            />
          ) : null}
        </ContextualMediaDialog>
      )}

      {editingGalleryImage && galleryEditingResource && (
        <ContextualMediaDialog
          eyebrow="EDITAR GALERÍA"
          title="Encuadre de la captura"
          description="Ajusta sólo la zona visible de esta captura. La imagen original sigue intacta y reutilizable."
          onClose={() => setEditingGalleryImage(null)}
        >
          <ImageViewportEditor
            slug={slug}
            revision={assignmentRevision}
            target="gallery"
            src={editingGalleryImage}
            resource={editingGalleryImage}
            label={`Galería · ${shortName(editingGalleryImage)}`}
            initialViewport={imageMedia?.gallery?.[editingGalleryImage]}
            onClose={() => setEditingGalleryImage(null)}
          />
        </ContextualMediaDialog>
      )}

      {galleryManagerOpen && (
        <ContextualMediaDialog
          eyebrow="GALERÍA DEL JUEGO"
          title="Gestionar capturas"
          description="Edita el encuadre o quita una captura de la Galería. Quitarla no elimina el archivo de la biblioteca compartida."
          onClose={() => setGalleryManagerOpen(false)}
        >
          <div className={contextualStyles.galleryManagerHeader}>
            <div>
              <strong>{screenshots.length} de 8 imágenes asignadas</strong>
              <span>Los cambios de encuadre son independientes para cada captura.</span>
            </div>
            <ResourcePicker
              action={endpoint}
              revision={assignmentRevision}
              target="gallery-image"
              resources={resources}
              kind="image"
              label="Añadir imagen"
              disabled={stale || screenshots.length >= 8}
              onAddResource={openAddResource}
            />
          </div>
          {renderGalleryAssignedItems()}
        </ContextualMediaDialog>
      )}

      {addResourceKind && (
        <ContextualMediaDialog
          eyebrow="BIBLIOTECA COMPARTIDA"
          title="Agregar nuevo recurso"
          description="Crea o importa el recurso una sola vez. Después podrás asignarlo y encuadrarlo por destino."
          onClose={() => setAddResourceKind(null)}
        >
          <div className={`${styles.editorSteps} ${contextualStyles.addTabs}`}>
            <button type="button" className={addResourceKind === "image" ? styles.editorStepActive : ""} onClick={() => setAddResourceKind("image")}>
              <ImageIcon size={17} aria-hidden="true" />Imagen
            </button>
            <button type="button" className={addResourceKind === "video" ? styles.editorStepActive : ""} onClick={() => setAddResourceKind("video")}>
              <Clapperboard size={17} aria-hidden="true" />Video
            </button>
          </div>

          {addResourceKind === "image" ? (
            <div className={`${styles.uploadDetails} ${styles.uploadBody}`}>
              <p className={contextualStyles.addIntro}>
                El WebP queda guardado en la biblioteca por hash. No cambia Portada, Hero, Card ni Galería hasta que lo selecciones.
              </p>
              <GameMediaUploadForm
                slug={slug}
                revision={assignmentRevision}
                screenshotCount={screenshotCount}
                libraryOnly
              />
            </div>
          ) : (
            <div className={styles.videoEditorHost}>
              <p className={contextualStyles.editorModeNote}>
                <Info size={17} aria-hidden="true" />
                <span><strong>Crear video editorial.</strong>{" "}Aquí eliges la fuente y el tramo una vez. Después, “Editar destino” sólo modifica el encuadre visual y nunca vuelve a cortar el tiempo.</span>
              </p>
              {videoEditor}
            </div>
          )}
        </ContextualMediaDialog>
      )}
    </div>
  );
}
