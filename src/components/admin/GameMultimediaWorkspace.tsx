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
  src: string;
  digest: string;
  bytes: number;
  width: number;
  height: number;
};

type ResourceVideo = {
  kind: "video";
  src: string;
  digest: string;
  bytes: number;
};

type LibraryResource = ResourceImage | ResourceVideo;
type Destination = "cover" | "hero" | "card" | "gallery";
type HeroDraftMode = "image" | "video";

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
  videoEditor: ReactNode;
};

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

function cardClip(state: LibraryState | null) {
  const card = state?.assignments.cardVideo;
  if (card?.source === "hero") return state?.assignments.heroVideo?.clip ?? null;
  if (card?.source === "independent") return card.clip;
  return state?.assignments.legacyPreviewClip ?? null;
}

function isLibraryResource(value: unknown): value is LibraryResource {
  if (!value || typeof value !== "object") return false;
  const resource = value as Partial<LibraryResource>;
  if (
    typeof resource.src !== "string" ||
    typeof resource.digest !== "string" ||
    typeof resource.bytes !== "number"
  ) {
    return false;
  }
  if (resource.kind === "video") return true;
  if (resource.kind !== "image") return false;
  return (
    typeof (resource as Partial<ResourceImage>).width === "number" &&
    typeof (resource as Partial<ResourceImage>).height === "number"
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
}: {
  action: string;
  revision: number;
  target: string;
  resources: LibraryResource[];
  kind: LibraryResource["kind"];
  label?: string;
  disabled?: boolean;
}) {
  const available = resources.filter((resource) => resource.kind === kind);

  return (
    <details className={styles.resourcePicker}>
      <summary
        className={styles.selectResourceButton}
        aria-disabled={disabled || available.length === 0}
      >
        {kind === "image" ? <ImageIcon size={18} /> : <MonitorPlay size={18} />}
        <span>{label}</span>
      </summary>
      <div className={styles.resourcePickerPanel}>
        <div className={styles.resourcePickerHeading}>
          <strong>{kind === "image" ? "Imágenes disponibles" : "Videos disponibles"}</strong>
          <span>{available.length} recurso{available.length === 1 ? "" : "s"}</span>
        </div>
        {available.length === 0 ? (
          <p className={styles.emptyPicker}>
            Todavía no hay recursos de este tipo. Sube uno desde la biblioteca compartida.
          </p>
        ) : (
          <div className={styles.resourceChoiceGrid}>
            {available.map((resource) => (
              <AssignmentForm
                key={resource.src}
                action={action}
                revision={revision}
                target={target}
                resource={resource.src}
                disabled={disabled}
              >
                {resource.kind === "image" ? (
                  <span className={styles.choiceThumb}>
                    <Image src={resource.src} alt="" fill sizes="96px" />
                  </span>
                ) : (
                  <span className={styles.choiceVideoIcon}>
                    <Clapperboard size={21} />
                  </span>
                )}
                <span className={styles.choiceMeta}>
                  <strong>{shortName(resource.src)}</strong>
                  <small>
                    {resource.kind === "image"
                      ? `${resource.width}×${resource.height} · ${formatBytes(resource.bytes)}`
                      : `WebM · ${formatBytes(resource.bytes)}`}
                  </small>
                </span>
              </AssignmentForm>
            ))}
          </div>
        )}
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
  videoEditor,
}: Props) {
  const [state, setState] = useState<LibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination>("hero");
  const [heroDraftMode, setHeroDraftMode] = useState<HeroDraftMode>("image");

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
  const images = useMemo(
    () => resources.filter((resource): resource is ResourceImage => resource.kind === "image"),
    [resources]
  );
  const videos = useMemo(
    () => resources.filter((resource): resource is ResourceVideo => resource.kind === "video"),
    [resources]
  );
  const coverImage = state?.assignments.coverImage ?? initialCoverImage ?? null;
  const heroImage = state?.assignments.heroImage ?? initialHeroImage ?? null;
  const screenshots = state?.assignments.screenshots ?? [...initialScreenshots];
  const heroVideo = state?.assignments.heroVideo ?? null;
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
  const activeHeroVideo = videos.find((resource) => resource.src === heroVideo?.clip) ?? null;
  const activeCardVideo = videos.find((resource) => resource.src === resolvedCardClip) ?? null;

  function usageLabels(resource: LibraryResource) {
    const labels: string[] = [];
    if (resource.kind === "image") {
      if (resource.src === coverImage) labels.push("Portada");
      if (resource.src === heroImage && !heroVideo) labels.push("Hero");
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
      <section className={styles.summarySection} aria-labelledby="multimedia-summary-heading">
        <div className={styles.compactHeading}>
          <div>
            <span>RESUMEN MULTIMEDIA</span>
            <h2 id="multimedia-summary-heading">Estado actual de los destinos</h2>
          </div>
          <p>Una vista rápida antes de entrar a la biblioteca o al editor.</p>
        </div>
        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            {coverResource ? (
              <span className={styles.summaryThumb}><Image src={coverResource.src} alt="" fill sizes="88px" /></span>
            ) : <span className={styles.summaryIcon}><ImageIcon size={22} /></span>}
            <div><span>PORTADA</span><strong>{coverImage ? shortName(coverImage) : "Sin asignar"}</strong><small><CheckCircle2 size={13} /> {coverImage ? "Asignada" : "Pendiente"}</small></div>
          </article>
          <article className={styles.summaryCard}>
            {heroDraftMode === "video" ? (
              <span className={styles.summaryIcon}><MonitorPlay size={22} /></span>
            ) : heroResource ? (
              <span className={styles.summaryThumb}><Image src={heroResource.src} alt="" fill sizes="88px" /></span>
            ) : <span className={styles.summaryIcon}><ImageIcon size={22} /></span>}
            <div><span>HERO</span><strong>{heroDraftMode === "video" ? (heroVideo ? shortName(heroVideo.clip) : "Video pendiente") : (heroImage ? shortName(heroImage) : "Sin asignar")}</strong><small><CheckCircle2 size={13} /> {heroDraftMode === "video" ? "Modo video" : "Modo imagen"}</small></div>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}><Clapperboard size={22} /></span>
            <div><span>CARD</span><strong>{resolvedCardClip ? shortName(resolvedCardClip) : "Portada estática"}</strong><small><CheckCircle2 size={13} /> {state?.assignments.cardVideo?.source === "hero" ? "Comparte Hero" : resolvedCardClip ? "Preview asignado" : "Sin video"}</small></div>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}><Images size={22} /></span>
            <div><span>GALERÍA</span><strong>{screenshots.length} de 8 capturas</strong><small><CheckCircle2 size={13} /> {screenshots.length ? "Disponible" : "Pendiente"}</small></div>
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
                  <p>Los WebP y WebM seguros del juego viven una sola vez en el almacén editorial y pueden reasignarse sin duplicar archivos.</p>
                </div>
              </div>
              <a href="#subir-recurso" className={styles.secondaryAction}><Upload size={16} /> Subir nuevo recurso</a>
            </div>

            {loading ? (
              <div className={styles.libraryStatus} role="status">Comprobando recursos multimedia seguros…</div>
            ) : error ? (
              <div className={styles.libraryStatus} role="alert">{error}</div>
            ) : resources.length === 0 ? (
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
                        <div>
                          <span>{resource.kind === "image" ? "IMAGEN" : "VIDEO"}</span>
                          <strong>{shortName(resource.src)}</strong>
                        </div>
                        <small>{formatBytes(resource.bytes)}</small>
                      </div>
                      {resource.kind === "image" ? (
                        <ResourceArtwork resource={resource} alt="Recurso de la biblioteca multimedia" />
                      ) : (
                        <div className={styles.videoPlaceholder}>
                          <MonitorPlay size={30} />
                          <span>WebM interno</span>
                          <small>No se reproduce hasta abrir el editor.</small>
                        </div>
                      )}
                      <div className={styles.usageRow}>
                        {labels.length ? labels.map((label) => <span key={label}>{label}</span>) : <span className={styles.unusedBadge}>Disponible</span>}
                      </div>
                      <small className={styles.resourceDetails}>
                        {resource.kind === "image" ? `${resource.width}×${resource.height} · WebP` : "WebM validado · master reutilizable"}
                      </small>
                    </article>
                  );
                })}
              </div>
            )}

            <details className={styles.uploadDetails} id="subir-recurso">
              <summary><Plus size={17} /> Subir o importar una imagen nueva</summary>
              <div className={styles.uploadBody}>
                <p>La imagen se guarda por hash en esta biblioteca. Puedes asignarla ahora a Portada, Hero o Galería y reutilizarla después desde cualquier selector.</p>
                <GameMediaUploadForm
                  slug={slug}
                  revision={revision}
                  screenshotCount={screenshotCount}
                />
              </div>
            </details>
          </section>

          <section className={styles.numberedSection} aria-labelledby="destination-assignment-heading">
            <div className={styles.sectionTitleRow}>
              <div>
                <span>02</span>
                <div>
                  <h2 id="destination-assignment-heading">Asignación de destinos</h2>
                  <p>Cada destino apunta a un recurso de la misma biblioteca. Seleccionar sólo cambia referencias; no crea otra copia.</p>
                </div>
              </div>
            </div>

            <div className={styles.assignmentGrid}>
              <article className={`${styles.assignmentCard} ${selectedDestination === "cover" ? styles.assignmentActive : ""}`}>
                <header><div><span>A</span><h3>Portada del juego</h3></div><small>Imagen</small></header>
                <div className={styles.currentResource}>
                  {coverResource ? <span className={styles.currentThumb}><Image src={coverResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}><ImageIcon size={20} /></span>}
                  <div><span>Recurso asignado</span><strong>{coverImage ? shortName(coverImage) : "Sin recurso"}</strong><small>{coverResource ? `${coverResource.width}×${coverResource.height} · ${formatBytes(coverResource.bytes)}` : "Selecciona una imagen de la biblioteca"}</small></div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target="cover-image" resources={resources} kind="image" disabled={stale} />
                  <button type="button" className={styles.editDestinationButton} onClick={() => setSelectedDestination("cover")}>Editar destino</button>
                </div>
                <small className={styles.assignmentStatus}><CheckCircle2 size={13} /> {coverImage ? "Asignada" : "Pendiente"}</small>
              </article>

              <article className={`${styles.assignmentCard} ${selectedDestination === "hero" ? styles.assignmentActive : ""}`}>
                <header><div><span>B</span><h3>Hero de inicio</h3></div><small>Modo exclusivo</small></header>
                <div className={styles.modeSwitch} role="group" aria-label="Modo del Hero">
                  <button type="button" className={heroDraftMode === "image" ? styles.modeActive : ""} onClick={() => setHeroDraftMode("image")}>Imagen</button>
                  <button type="button" className={heroDraftMode === "video" ? styles.modeActive : ""} onClick={() => setHeroDraftMode("video")}>Video</button>
                </div>
                <div className={styles.currentResource}>
                  {heroDraftMode === "image" && heroResource ? <span className={styles.currentThumb}><Image src={heroResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}>{heroDraftMode === "video" ? <MonitorPlay size={20} /> : <ImageIcon size={20} />}</span>}
                  <div><span>Recurso asignado</span><strong>{heroDraftMode === "video" ? (heroVideo ? shortName(heroVideo.clip) : "Selecciona un video") : (heroImage ? shortName(heroImage) : "Selecciona una imagen")}</strong><small>{heroDraftMode === "video" ? "El video reemplaza visualmente a la imagen, sin borrarla de la biblioteca." : "Sólo la imagen queda activa en el Hero."}</small></div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target={heroDraftMode === "video" ? "hero-video" : "hero-image"} resources={resources} kind={heroDraftMode} disabled={stale} />
                  <button type="button" className={styles.editDestinationButton} onClick={() => setSelectedDestination("hero")}>Editar destino</button>
                </div>
                <small className={styles.assignmentStatus}><CheckCircle2 size={13} /> {heroDraftMode === "video" ? (heroVideo ? "Video activo" : "Pendiente de asignar") : (heroImage ? "Imagen activa" : "Pendiente de asignar")}</small>
              </article>

              <article className={`${styles.assignmentCard} ${selectedDestination === "card" ? styles.assignmentActive : ""}`}>
                <header><div><span>C</span><h3>Card del juego</h3></div><small>Preview animado</small></header>
                <div className={styles.currentResource}>
                  {activeCardVideo ? <span className={styles.currentIcon}><Clapperboard size={20} /></span> : coverResource ? <span className={styles.currentThumb}><Image src={coverResource.src} alt="" fill sizes="72px" /></span> : <span className={styles.currentIcon}><ImageIcon size={20} /></span>}
                  <div><span>{activeCardVideo ? "Video asignado" : "Imagen base"}</span><strong>{activeCardVideo ? shortName(activeCardVideo.src) : coverImage ? shortName(coverImage) : "Sin recurso"}</strong><small>{state?.assignments.cardVideo?.source === "hero" ? "Mismos bytes del Hero · encuadre propio" : activeCardVideo ? "WebM de biblioteca · sin copia extra" : "La Card usa la portada mientras no tenga preview de video."}</small></div>
                </div>
                <div className={styles.assignmentActions}>
                  <ResourcePicker action={endpoint} revision={assignmentRevision} target="card-video" resources={resources} kind="video" disabled={stale} />
                  <AssignmentForm action={endpoint} revision={assignmentRevision} target="card-match-hero" resource="" disabled={stale || !heroVideo}>
                    <Link2 size={17} />
                    <span className={styles.choiceMeta}><strong>Igualar al Hero</strong><small>{heroVideo ? "Mismo WebM, sin duplicar" : "Disponible cuando Hero usa video"}</small></span>
                  </AssignmentForm>
                  <button type="button" className={styles.editDestinationButton} onClick={() => setSelectedDestination("card")}>Editar destino</button>
                </div>
                <small className={styles.assignmentStatus}><CheckCircle2 size={13} /> {state?.assignments.cardVideo?.source === "hero" ? "Comparte Hero" : activeCardVideo ? "Preview asignado" : "Portada estática"}</small>
              </article>
            </div>
          </section>

          <section className={styles.numberedSection} aria-labelledby="destination-editor-heading">
            <div className={styles.sectionTitleRow}>
              <div>
                <span>03</span>
                <div>
                  <h2 id="destination-editor-heading">Editor del destino seleccionado</h2>
                  <p>
                    Editando: <strong>{selectedDestination === "cover" ? "Portada del juego" : selectedDestination === "hero" ? `Hero de inicio · ${heroDraftMode === "video" ? "Video" : "Imagen"}` : selectedDestination === "card" ? "Card del juego" : "Galería"}</strong>
                  </p>
                </div>
              </div>
            </div>

            {selectedDestination === "hero" && heroDraftMode === "video" ? (
              <div className={styles.videoEditorHost}>{videoEditor}</div>
            ) : selectedDestination === "card" ? (
              <div className={styles.videoEditorHost}>{videoEditor}</div>
            ) : (
              <div className={styles.focusEditor}>
                <nav className={styles.editorSteps} aria-label="Secciones del editor multimedia">
                  <button type="button" className={styles.editorStepActive}>1 <span>Fuente y carga</span></button>
                  <button type="button" disabled>2 <span>Alt text</span></button>
                  <button type="button" disabled>3 <span>Enfoque visual</span></button>
                  <button type="button" disabled>4 <span>Ajuste y procesamiento</span></button>
                </nav>
                <div className={styles.focusContent}>
                  <div className={styles.focusSource}>
                    <span>Fuente del recurso</span>
                    <strong>Biblioteca compartida</strong>
                    <p>Usa “Seleccionar recurso” en la tarjeta del destino o sube una imagen nueva. Las opciones de ajuste seguro existentes siguen disponibles en el cargador.</p>
                    <a href="#subir-recurso" className={styles.secondaryAction}><Upload size={16} /> Subir nueva imagen</a>
                  </div>
                  <div className={styles.focusPreview}>
                    <span>Vista previa</span>
                    {selectedDestination === "cover" && coverResource ? (
                      <ResourceArtwork resource={coverResource} alt="Vista previa de portada" />
                    ) : selectedDestination === "hero" && heroResource ? (
                      <ResourceArtwork resource={heroResource} alt="Vista previa del Hero" />
                    ) : (
                      <div className={styles.emptyPreview}><ImageIcon size={28} /><span>Sin imagen asignada</span></div>
                    )}
                  </div>
                  {selectedDestination === "hero" && (
                    <div className={styles.disabledVideoCard}>
                      <div><Clapperboard size={22} /><span>VIDEO EDITORIAL · HERO + CARD</span></div>
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
              <Info size={18} />
              <div><strong>La revisión multimedia cambió</strong><span>Recarga esta página antes de asignar otro recurso para no pisar cambios más recientes.</span></div>
            </div>
          )}
        </div>

        <aside className={styles.helpRail}>
          <section>
            <div className={styles.helpHeading}><Info size={18} /><h2>Reglas y ayuda</h2></div>
            <div className={styles.helpRule}><FolderOpen size={20} /><div><strong>Todo sale de la biblioteca compartida</strong><span>Sube una vez y reutiliza el mismo archivo por referencia.</span></div></div>
            <div className={styles.helpRule}><MonitorPlay size={20} /><div><strong>Hero: imagen o video</strong><span>Nunca se muestran ambos a la vez. Cambiar de modo no borra el archivo anterior.</span></div></div>
            <div className={styles.helpRule}><Link2 size={20} /><div><strong>Card sin duplicados</strong><span>Puede compartir exactamente el WebM del Hero con otro encuadre.</span></div></div>
            <div className={styles.helpRule}><CheckCircle2 size={20} /><div><strong>Asignar no recodifica</strong><span>Elegir un recurso existente sólo cambia metadata del borrador.</span></div></div>
          </section>
          <section className={styles.tipCard}>
            <Sparkles size={20} />
            <div><strong>Consejo avanzado</strong><p>Conserva un punto focal claro y evita texto importante en los bordes; Hero y Card pueden aplicar encuadres distintos al mismo video.</p></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
