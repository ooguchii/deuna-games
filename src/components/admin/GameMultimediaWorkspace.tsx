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
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import type {
  GameCardVideo,
  GameHeroVideo,
} from "@/types/game";

import styles from "./GameMultimediaEditor.module.css";

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
const EMPTY_LIBRARY_RESOURCES: LibraryResource[] = [];

type LibraryState = {
  revision: number;
  resources: LibraryResource[];
  assignments: {
    coverImage: string | null;
    heroImage: string | null;
    screenshots: string[];
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
  heroVideoEditor: ReactNode;
  cardVideoEditor: ReactNode;
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
  return extension && extension.length <= 5
    ? extension
    : "IMAGEN";
}

function imageMeta(resource: ResourceImage) {
  const size = formatBytes(resource.bytes);
  if (
    resource.width !== null &&
    resource.height !== null
  ) {
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
    return (
      resource.origin === "editorial" &&
      typeof resource.digest === "string"
    );
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
    !Array.isArray(assignments.screenshots)
  ) {
    return null;
  }

  return {
    revision: root.revision,
    resources: root.resources,
    assignments,
  };
}

function ResourceArtwork({
  resource,
  alt,
}: {
  resource: ResourceImage;
  alt: string;
}) {
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

function ImageArtwork({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className={styles.resourceArtwork}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 760px) 88vw, 320px"
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
      <button
        type="submit"
        className={styles.resourceChoice}
        disabled={disabled}
      >
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
}: {
  action: string;
  revision: number;
  target: string;
  resources: LibraryResource[];
  kind: LibraryResource["kind"];
  label?: string;
  disabled?: boolean;
}) {
  const available = resources.filter(
    (resource) => resource.kind === kind
  );
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

  if (available.length === 0) {
    return (
      <div className={styles.resourcePicker}>
        <button
          type="button"
          className={styles.selectResourceButton}
          disabled
        >
          {buttonContent}
        </button>
        <p className={styles.emptyPicker}>
          No hay {kind === "image" ? "imágenes" : "videos"} disponibles todavía.
        </p>
      </div>
    );
  }

  if (disabled) {
    return (
      <button
        type="button"
        className={styles.selectResourceButton}
        disabled
      >
        {buttonContent}
      </button>
    );
  }

  return (
    <details className={styles.resourcePicker}>
      <summary className={styles.selectResourceButton}>
        {buttonContent}
      </summary>
      <div className={styles.resourcePickerPanel}>
        <div className={styles.resourcePickerHeading}>
          <strong>
            {kind === "image"
              ? "Imágenes disponibles"
              : "Videos disponibles"}
          </strong>
          <span>
            {available.length} recurso
            {available.length === 1 ? "" : "s"}
          </span>
        </div>
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
                  <Image
                    src={resource.src}
                    alt=""
                    fill
                    sizes="96px"
                  />
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
      </div>
    </details>
  );
}

export default function GameMultimediaWorkspace({
  slug,
  revision,
  screenshotCount,
  initialCoverImage,
  initialHeroImage,
  initialScreenshots = [],
  heroVideoEditor,
  cardVideoEditor,
}: Props) {
  const [state, setState] = useState<LibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination>("hero");
  const [heroDraftMode, setHeroDraftMode] = useState<HeroDraftMode>("image");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const endpoint =
    `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`;

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
          throw new Error(
            "No se pudo cargar la biblioteca multimedia compartida."
          );
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

  const resources = state?.resources ?? EMPTY_LIBRARY_RESOURCES;
  const images = useMemo(
    () => resources.filter((resource): resource is ResourceImage => resource.kind === "image"),
    [resources]
  );
  const videos = useMemo(
    () => resources.filter((resource): resource is ResourceVideo => resource.kind === "video"),
    [resources]
  );
  const coverImage =
    state?.assignments.coverImage ?? initialCoverImage ?? null;
  const heroImage =
    state?.assignments.heroImage ?? initialHeroImage ?? null;
  const screenshots =
    state?.assignments.screenshots ?? [...initialScreenshots];
  const heroVideo = state?.assignments.heroVideo ?? null;
  const currentHeroMode =
    state?.assignments.heroMode ?? heroDraftMode;
  const heroModePending = heroDraftMode !== currentHeroMode;
  const resolvedCardClip = cardClip(state);
  const assignmentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  function imageBySrc(src: string | null) {
    return src
      ? images.find((resource) => resource.src === src) ?? null
      : null;
  }

  const coverResource = imageBySrc(coverImage);
  const heroResource = imageBySrc(heroImage);
  const activeHeroVideo = videos.find(
    (resource) => resource.src === heroVideo?.clip
  ) ?? null;
  const activeCardVideo = videos.find(
    (resource) => resource.src === resolvedCardClip
  ) ?? null;

  function usageLabels(resource: LibraryResource) {
    const labels: string[] = [];

    if (resource.kind === "image") {
      if (resource.src === coverImage) labels.push("Portada");
      if (
        resource.src === heroImage &&
        currentHeroMode === "image"
      ) {
        labels.push("Hero");
      }
      if (screenshots.includes(resource.src)) labels.push("Galería");
      if (resource.src === coverImage) labels.push("Card base");
    } else {
      if (resource.src === heroVideo?.clip) labels.push("Hero");
      if (resource.src === resolvedCardClip) labels.push("Card");
    }

    return labels;
  }

  return (
    <div className={styles.mediaWorkspace}>
      <section
        className={styles.summarySection}
        aria-labelledby="multimedia-summary-heading"
      >
        <div className={styles.compactHeading}>
          <div>
            <h2 id="multimedia-summary-heading">Resumen multimedia</h2>
          </div>
          <p>Estado real del borrador y de los recursos asignados.</p>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            {coverImage ? (
              <span className={styles.summaryThumb}><Image src={coverImage} alt="" fill sizes="88px" /></span>
            ) : <span className={styles.summaryIcon}><ImageIcon size={22} /></span>}
            <div><span>PORTADA</span><strong>{coverImage ? shortName(coverImage) : "Sin asignar"}</strong><small><CheckCircle2 size={13} /> {coverImage ? "Asignada" : "Pendiente"}</small></div>
          </article>

          <article className={styles.summaryCard}>
            {currentHeroMode === "video" ? (
              <span className={styles.summaryIcon}><MonitorPlay size={22} /></span>
            ) : heroImage ? (
              <span className={styles.summaryThumb}><Image src={heroImage} alt="" fill sizes="88px" /></span>
            ) : <span className={styles.summaryIcon}><ImageIcon size={22} /></span>}
            <div><span>HERO</span><strong>{currentHeroMode === "video" ? (heroVideo ? shortName(heroVideo.clip) : "Video pendiente") : (heroImage ? shortName(heroImage) : "Sin asignar")}</strong><small><CheckCircle2 size={13} /> {currentHeroMode === "video" ? "Modo video" : "Modo imagen"}</small></div>
          </article>

          <article className={styles.summaryCard}>
            {resolvedCardClip ? (
              <span className={styles.summaryIcon}><Clapperboard size={22} /></span>
            ) : coverImage ? (
              <span className={styles.summaryThumb}><Image src={coverImage} alt="" fill sizes="88px" /></span>
            ) : <span className={styles.summaryIcon}><ImageIcon size={22} /></span>}
            <div><span>CARD</span><strong>{resolvedCardClip ? shortName(resolvedCardClip) : "Portada estática"}</strong><small><CheckCircle2 size={13} /> {state?.assignments.cardVideo?.source === "hero" ? "Comparte Hero" : resolvedCardClip ? "Preview asignado" : "Sin video"}</small></div>
          </article>
          <article className={`${styles.summaryCard} ${styles.summaryGalleryCard}`}>
            <div className={styles.summaryGalleryThumbs} aria-hidden="true">
              {screenshots.slice(0, 4).map((src) => (
                <span key={src}><Image src={src} alt="" fill sizes="56px" /></span>
              ))}
              {screenshots.length === 0 && <span className={styles.summaryIcon}><Images size={22} /></span>}
              {screenshots.length > 4 && <b>+{screenshots.length - 4}</b>}
            </div>
            <div><span>GALERÍA</span><strong>{screenshots.length} de 8 capturas</strong><small><CheckCircle2 size={13} /> {screenshots.length ? "Disponible" : "Pendiente"}</small></div>
          </article>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <section
            className={styles.numberedSection}
            aria-labelledby="shared-library-heading"
          >
            <div className={styles.sectionTitleRow}>
              <div>
                <span>01</span>
                <div>
                  <h2 id="shared-library-heading">
                    Biblioteca multimedia compartida
                  </h2>
                  <p>
                    Los recursos seguros del juego viven una sola vez y pueden reasignarse sin duplicar archivos. Las imágenes antiguas ya asignadas también aparecen aquí para reutilizarlas sin volver a subirlas.
                  </p>
                </div>
              </div>
              <a
                href="#subir-recurso"
                className={styles.secondaryAction}
              >
                <Upload size={16} aria-hidden="true" />
                Subir nuevo recurso
              </a>
            </div>

            {loading ? (
              <div className={styles.libraryStatus} role="status">
                Comprobando recursos multimedia seguros…
              </div>
            ) : error ? (
              <div className={styles.libraryStatus} role="alert">{error}</div>
            ) : (
              <>
                <div className={styles.libraryOverviewGrid}>
                  <article className={styles.librarySlot}>
                    <header><span>PORTADA BASE</span><small>{coverResource ? coverResource.origin === "editorial" ? "En almacén" : "Recurso existente" : coverImage ? "Referencia heredada" : "Pendiente"}</small></header>
                    {coverImage ? <ImageArtwork src={coverImage} alt="Portada actualmente asignada" /> : <div className={styles.slotEmpty}><ImageIcon size={25} /><span>Sin portada asignada</span></div>}
                    <strong>{coverImage ? shortName(coverImage) : "Selecciona una imagen"}</strong>
                    <div className={styles.usageRow}><span>Usable en Portada</span><span>Card estática</span></div>
                    <small className={styles.resourceDetails}>{coverResource ? imageMeta(coverResource) : coverImage ? "Asignada fuera del almacén reutilizable" : "Sin recurso"}</small>
                  </article>

                  <article className={styles.librarySlot}>
                    <header><span>HERO IMAGEN</span><small>{heroResource ? heroResource.origin === "editorial" ? "En almacén" : "Recurso existente" : heroImage ? "Referencia heredada" : "Pendiente"}</small></header>
                    {heroImage ? <ImageArtwork src={heroImage} alt="Imagen actualmente asignada al Hero" /> : <div className={styles.slotEmpty}><ImageIcon size={25} /><span>Sin imagen del Hero</span></div>}
                    <strong>{heroImage ? shortName(heroImage) : "Selecciona una imagen"}</strong>
                    <div className={styles.usageRow}><span>Usable en Hero</span></div>
                    <small className={styles.resourceDetails}>{heroResource ? imageMeta(heroResource) : heroImage ? "Se conserva aunque el Hero use video" : "Sin recurso"}</small>
                  </article>

                  <article className={styles.librarySlot}>
                    <header><span>HERO VIDEO MASTER</span><small>{activeHeroVideo ? "En biblioteca" : heroVideo ? "Referencia no disponible" : "Opcional"}</small></header>
                    <div className={styles.videoPlaceholder}>
                      <MonitorPlay size={30} />
                      <span>{heroVideo ? "WebM interno" : "Sin video master"}</span>
                      <small>Se abre sólo dentro del editor.</small>
                    </div>
                    <strong>{heroVideo ? shortName(heroVideo.clip) : "Crea o asigna un video"}</strong>
                    <div className={styles.usageRow}><span>Usable en Hero</span><span>Compartible con Card</span></div>
                    <small className={styles.resourceDetails}>{activeHeroVideo ? `WebM · ${formatBytes(activeHeroVideo.bytes)}` : "No se descarga para mostrar este resumen"}</small>
                  </article>

                  <article className={styles.librarySlot}>
                    <header><span>GALERÍA</span><small>{screenshots.length} de 8</small></header>
                    <div className={styles.galleryStrip}>
                      {screenshots.slice(0, 6).map((src) => (
                        <span key={src}><Image src={src} alt="" fill sizes="96px" /></span>
                      ))}
                      {screenshots.length === 0 && <div className={styles.slotEmpty}><Images size={25} /><span>Sin capturas</span></div>}
                      {screenshots.length > 6 && <b>+{screenshots.length - 6}</b>}
                    </div>
                    <button type="button" className={styles.manageGalleryButton} onClick={() => setGalleryOpen((open) => !open)} aria-expanded={galleryOpen} aria-controls="media-gallery-manager">
                      {galleryOpen ? "Cerrar galería" : "Gestionar galería"}
                    </button>
                    <small className={styles.resourceDetails}>Las capturas asignadas siguen siendo referencias del borrador.</small>
                  </article>
                </div>

                {galleryOpen && (
                  <div className={styles.galleryManager} id="media-gallery-manager">
                    <div className={styles.galleryManagerHeading}>
                      <div><strong>Galería asignada</strong><span>Añade desde la biblioteca o retira una referencia del borrador.</span></div>
                      <ResourcePicker action={endpoint} revision={assignmentRevision} target="gallery-image" resources={resources} kind="image" label="Añadir captura" disabled={stale || screenshots.length >= 8} />
                    </div>
                    {screenshots.length === 0 ? (
                      <p className={styles.emptyPicker}>No hay capturas asignadas. Puedes elegir una imagen existente sin volver a subirla.</p>
                    ) : (
                      <div className={styles.galleryManagerGrid}>
                        {screenshots.map((src) => (
                          <AssignmentForm key={src} action={endpoint} revision={assignmentRevision} target="gallery-remove" resource={src} disabled={stale}>
                            <span className={styles.choiceThumb}><Image src={src} alt="" fill sizes="96px" /></span>
                            <span className={styles.choiceMeta}><strong>{shortName(src)}</strong><small>Retirar de la galería · el archivo no se borra</small></span>
                            <Trash2 size={17} />
                          </AssignmentForm>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <details className={styles.libraryInventory} onToggle={(event) => setLibraryOpen(event.currentTarget.open)}>
                  <summary><FolderOpen size={17} /><span>Ver biblioteca completa</span><small>{resources.length} recurso{resources.length === 1 ? "" : "s"} disponible{resources.length === 1 ? "" : "s"}</small></summary>
                  {libraryOpen && (resources.length === 0 ? (
                    <div className={styles.emptyLibrary}>
                      <FolderOpen size={30} />
                      <strong>La biblioteca todavía está vacía</strong>
                      <span>Sube la primera imagen o crea un video editorial para empezar.</span>
                    </div>
                  ) : (
                    <div className={styles.libraryGrid}>
                      {resources.map((resource) => {
                        const labels = usageLabels(resource);
                        return (
                          <article key={resource.src} className={styles.libraryCard}>
                            <div className={styles.libraryCardHeading}>
                              <div><span>{resource.kind === "video" ? "VIDEO" : resource.origin === "bundled" ? "IMAGEN EXISTENTE" : "IMAGEN"}</span><strong>{shortName(resource.src)}</strong></div>
                              <small>{formatBytes(resource.bytes)}</small>
                            </div>
                            {resource.kind === "image" ? <ResourceArtwork resource={resource} alt="Recurso de la biblioteca multimedia" /> : (
                              <div className={styles.videoPlaceholder}><MonitorPlay size={30} /><span>WebM interno</span><small>No se reproduce hasta abrir el editor.</small></div>
                            )}
                            <div className={styles.usageRow}>{labels.length ? labels.map((label) => <span key={label}>{label}</span>) : <span className={styles.unusedBadge}>Disponible</span>}</div>
                            <small className={styles.resourceDetails}>{resource.kind === "image" ? resource.origin === "bundled" ? `${imageFormat(resource.src)} existente · reutilizable por referencia` : `${imageMeta(resource)} · WebP seguro` : "WebM validado · master reutilizable"}</small>
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </details>
              </>
            )}

            <details
              className={styles.uploadDetails}
              id="subir-recurso"
            >
              <summary>
                <Plus size={17} aria-hidden="true" />
                Subir o importar una imagen nueva
              </summary>
              <div className={styles.uploadBody}>
                <p>
                  El nuevo WebP se guarda por hash sin modificar Portada, Hero ni Galería. Después lo asignas desde cualquiera de los selectores de destino.
                </p>
                <GameMediaUploadForm
                  slug={slug}
                  revision={revision}
                  screenshotCount={screenshotCount}
                  libraryOnly
                />
              </div>
            </details>
          </section>

          <section
            className={styles.numberedSection}
            aria-labelledby="destination-assignment-heading"
          >
            <div className={styles.sectionTitleRow}>
              <div>
                <span>02</span>
                <div>
                  <h2 id="destination-assignment-heading">
                    Asignación de destinos
                  </h2>
                  <p>
                    Cada destino apunta a un recurso de la misma biblioteca. Seleccionar sólo cambia referencias; no crea otra copia.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.assignmentGrid}>
              <article
                className={`${styles.assignmentCard} ${
                  selectedDestination === "cover"
                    ? styles.assignmentActive
                    : ""
                }`}
              >
                <header>
                  <div>
                    <span>A</span>
                    <h3>Portada del juego</h3>
                  </div>
                  <small>Imagen</small>
                </header>
                <div className={styles.currentResource}>
                  {coverResource ? (
                    <span className={styles.currentThumb}>
                      <Image
                        src={coverResource.src}
                        alt=""
                        fill
                        sizes="72px"
                      />
                    </span>
                  ) : (
                    <span className={styles.currentIcon}>
                      <ImageIcon size={20} aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <span>Recurso asignado</span>
                    <strong>
                      {coverImage
                        ? shortName(coverImage)
                        : "Sin recurso"}
                    </strong>
                    <small>
                      {coverResource
                        ? imageMeta(coverResource)
                        : "Selecciona una imagen de la biblioteca"}
                    </small>
                  </div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target="cover-image"
                    resources={resources}
                    kind="image"
                    disabled={stale}
                  />
                  <button
                    type="button"
                    className={styles.editDestinationButton}
                    onClick={() => setSelectedDestination("cover")}
                  >
                    Editar destino
                  </button>
                </div>
                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {coverImage ? "Asignada" : "Pendiente"}
                </small>
              </article>

              <article
                className={`${styles.assignmentCard} ${
                  selectedDestination === "hero"
                    ? styles.assignmentActive
                    : ""
                }`}
              >
                <header>
                  <div>
                    <span>B</span>
                    <h3>Hero de inicio</h3>
                  </div>
                  <small>Imagen o video</small>
                </header>

                <div
                  className={styles.modeSwitch}
                  role="group"
                  aria-label="Modo del Hero"
                >
                  <button
                    type="button"
                    className={
                      heroDraftMode === "image"
                        ? styles.modeActive
                        : ""
                    }
                    onClick={() => setHeroDraftMode("image")}
                  >
                    Imagen
                  </button>
                  <button
                    type="button"
                    className={
                      heroDraftMode === "video"
                        ? styles.modeActive
                        : ""
                    }
                    onClick={() => setHeroDraftMode("video")}
                  >
                    Video
                  </button>
                </div>

                <div className={styles.currentResource}>
                  {heroDraftMode === "image" && heroResource ? (
                    <span className={styles.currentThumb}>
                      <Image
                        src={heroResource.src}
                        alt=""
                        fill
                        sizes="72px"
                      />
                    </span>
                  ) : (
                    <span className={styles.currentIcon}>
                      {heroDraftMode === "video" ? (
                        <MonitorPlay size={20} aria-hidden="true" />
                      ) : (
                        <ImageIcon size={20} aria-hidden="true" />
                      )}
                    </span>
                  )}
                  <div>
                    <span>
                      {heroModePending
                        ? "Modo preparado"
                        : "Recurso asignado"}
                    </span>
                    <strong>
                      {heroDraftMode === "video"
                        ? heroVideo
                          ? shortName(heroVideo.clip)
                          : "Selecciona un video"
                        : heroImage
                          ? shortName(heroImage)
                          : "Selecciona una imagen"}
                    </strong>
                    <small>
                      {heroModePending
                        ? "Selecciona un recurso para aplicar el cambio de modo. El recurso anterior seguirá en la biblioteca."
                        : heroDraftMode === "video"
                          ? "El video está activo; la imagen anterior permanece reutilizable."
                          : "Sólo la imagen está activa en el Hero."}
                    </small>
                  </div>
                </div>

                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target={
                      heroDraftMode === "video"
                        ? "hero-video"
                        : "hero-image"
                    }
                    resources={resources}
                    kind={heroDraftMode}
                    disabled={stale}
                  />
                  <button
                    type="button"
                    className={styles.editDestinationButton}
                    onClick={() => setSelectedDestination("hero")}
                  >
                    Editar destino
                  </button>
                </div>

                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {heroModePending
                    ? "Cambio pendiente de recurso"
                    : currentHeroMode === "video"
                      ? "Video activo"
                      : heroImage
                        ? "Imagen activa"
                        : "Pendiente"}
                </small>
              </article>

              <article
                className={`${styles.assignmentCard} ${
                  selectedDestination === "card"
                    ? styles.assignmentActive
                    : ""
                }`}
              >
                <header>
                  <div>
                    <span>C</span>
                    <h3>Card del juego</h3>
                  </div>
                  <small>Preview animado</small>
                </header>

                <div className={styles.currentResource}>
                  {activeCardVideo ? (
                    <span className={styles.currentIcon}>
                      <Clapperboard size={20} aria-hidden="true" />
                    </span>
                  ) : coverResource ? (
                    <span className={styles.currentThumb}>
                      <Image
                        src={coverResource.src}
                        alt=""
                        fill
                        sizes="72px"
                      />
                    </span>
                  ) : (
                    <span className={styles.currentIcon}>
                      <ImageIcon size={20} aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <span>
                      {activeCardVideo
                        ? "Video asignado"
                        : "Imagen base"}
                    </span>
                    <strong>
                      {activeCardVideo
                        ? shortName(activeCardVideo.src)
                        : coverImage
                          ? shortName(coverImage)
                          : "Sin recurso"}
                    </strong>
                    <small>
                      {state?.assignments.cardVideo?.source === "hero"
                        ? "Mismos bytes del Hero · encuadre propio"
                        : activeCardVideo
                          ? "WebM de biblioteca · sin copia extra"
                          : "La Card usa la portada mientras no tenga preview de video."}
                    </small>
                  </div>
                </div>

                <div className={styles.assignmentActions}>
                  <ResourcePicker
                    action={endpoint}
                    revision={assignmentRevision}
                    target="card-video"
                    resources={resources}
                    kind="video"
                    disabled={stale}
                  />
                  <AssignmentForm
                    action={endpoint}
                    revision={assignmentRevision}
                    target="card-match-hero"
                    resource=""
                    disabled={stale || !heroVideo}
                  >
                    <Link2 size={17} aria-hidden="true" />
                    <span className={styles.choiceMeta}>
                      <strong>Igualar al Hero</strong>
                      <small>
                        {heroVideo
                          ? "Mismo WebM, sin duplicar"
                          : "Disponible cuando Hero usa video"}
                      </small>
                    </span>
                  </AssignmentForm>
                  <button
                    type="button"
                    className={styles.editDestinationButton}
                    onClick={() => setSelectedDestination("card")}
                  >
                    Editar destino
                  </button>
                </div>

                <small className={styles.assignmentStatus}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {state?.assignments.cardVideo?.source === "hero"
                    ? "Comparte Hero"
                    : activeCardVideo
                      ? "Preview asignado"
                      : "Portada estática"}
                </small>
              </article>

            </div>
          </section>

          <section
            className={styles.numberedSection}
            aria-labelledby="destination-editor-heading"
          >
            <div className={styles.sectionTitleRow}>
              <div>
                <span>03</span>
                <div>
                  <h2 id="destination-editor-heading">
                    Editor del destino seleccionado
                  </h2>
                  <p>
                    Editando: <strong>
                      {selectedDestination === "cover"
                        ? "Portada del juego"
                        : selectedDestination === "hero"
                          ? `Hero de inicio · ${heroDraftMode === "video" ? "Video" : "Imagen"}`
                          : "Card del juego"}
                    </strong>
                  </p>
                </div>
              </div>
            </div>

            {selectedDestination === "hero" && heroDraftMode === "video" ? (
              <div className={styles.videoEditorHost}>{heroVideoEditor}</div>
            ) : selectedDestination === "card" ? (
              <div className={styles.videoEditorHost}>{cardVideoEditor}</div>
            ) : (
              <div className={styles.focusEditor}>
                <nav className={styles.editorSteps} aria-label="Secciones del editor multimedia">
                  <span className={styles.editorStepActive}>1 <b>Fuente actual</b></span>
                  <span>2 <b>Asignación</b></span>
                  <span>3 <b>Vista previa</b></span>
                  <a href="#subir-recurso">4 <b>Ajuste al subir</b></a>
                </nav>
                <div className={styles.focusContent}>
                  <div className={styles.focusSource}>
                    <span>Fuente del recurso</span>
                    <strong>
                      {selectedDestination === "cover"
                        ? coverResource
                          ? coverResource.origin === "editorial"
                            ? "Almacén editorial"
                            : "Recurso existente"
                          : coverImage
                            ? "Referencia heredada"
                            : "Sin recurso"
                        : heroResource
                          ? heroResource.origin === "editorial"
                            ? "Almacén editorial"
                            : "Recurso existente"
                          : heroImage
                            ? "Referencia heredada"
                            : "Sin recurso"}
                    </strong>
                    <p>Selecciona una imagen disponible o sube una nueva. Reasignar una referencia existente no duplica el archivo.</p>
                    <ResourcePicker
                      action={endpoint}
                      revision={assignmentRevision}
                      target={selectedDestination === "cover" ? "cover-image" : "hero-image"}
                      resources={resources}
                      kind="image"
                      disabled={stale}
                    />
                    <a href="#subir-recurso" className={styles.secondaryAction}>
                      <Upload size={16} aria-hidden="true" />
                      Subir nueva imagen
                    </a>
                  </div>
                  <div className={styles.focusPreview}>
                    <span>Vista previa</span>
                    {selectedDestination === "cover" && coverImage ? (
                      <ImageArtwork src={coverImage} alt="Vista previa de portada" />
                    ) : selectedDestination === "hero" && heroImage ? (
                      <ImageArtwork src={heroImage} alt="Vista previa del Hero" />
                    ) : (
                      <div className={styles.emptyPreview}>
                        <ImageIcon size={28} aria-hidden="true" />
                        <span>Sin imagen asignada</span>
                      </div>
                    )}
                  </div>
                  {selectedDestination === "hero" && (
                    <div className={styles.disabledVideoCard}>
                      <div>
                        <Clapperboard size={22} aria-hidden="true" />
                        <span>VIDEO EDITORIAL · HERO + CARD</span>
                      </div>
                      <strong>Deshabilitado en modo Imagen</strong>
                      <p>Cambia el modo del Hero a Video para abrir el editor de master, recorte y encuadre.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {stale && (
            <div className={styles.staleNotice} role="alert">
              <Info size={18} aria-hidden="true" />
              <div>
                <strong>La revisión multimedia cambió</strong>
                <span>
                  Recarga esta página antes de asignar otro recurso para no pisar cambios más recientes.
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.helpRail}>
          <section>
            <div className={styles.helpHeading}>
              <Info size={18} aria-hidden="true" />
              <h2>Reglas y ayuda</h2>
            </div>
            <div className={styles.helpRule}>
              <FolderOpen size={20} aria-hidden="true" />
              <div>
                <strong>Todo sale de la biblioteca compartida</strong>
                <span>
                  Sube una vez y reutiliza el mismo archivo por referencia. Los recursos históricos ya asignados también se recuperan.
                </span>
              </div>
            </div>
            <div className={styles.helpRule}>
              <MonitorPlay size={20} aria-hidden="true" />
              <div>
                <strong>Hero: imagen o video</strong>
                <span>
                  Nunca se muestran ambos a la vez. Cambiar de modo no borra el archivo anterior.
                </span>
              </div>
            </div>
            <div className={styles.helpRule}>
              <Link2 size={20} aria-hidden="true" />
              <div>
                <strong>Card sin duplicados</strong>
                <span>
                  Puede compartir exactamente el WebM del Hero con otro encuadre.
                </span>
              </div>
            </div>
            <div className={styles.helpRule}>
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>Asignar no recodifica</strong>
                <span>
                  Elegir un recurso existente sólo cambia metadata del borrador.
                </span>
              </div>
            </div>
          </section>

          <section className={styles.tipCard}>
            <Sparkles size={20} aria-hidden="true" />
            <div>
              <strong>Consejo avanzado</strong>
              <p>
                Conserva un punto focal claro y evita texto importante en los bordes; Hero y Card pueden aplicar encuadres distintos al mismo video.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
