"use client";

import {
  CheckCircle2,
  Clapperboard,
  ImageIcon,
  Info,
  MonitorPlay,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";
import GameBackgroundMediaEditor from "@/components/admin/GameBackgroundMediaEditor";
import GameDetailMediaEditor from "@/components/admin/GameDetailMediaEditor";
import GameVideoViewportEditor from "@/components/admin/GameVideoViewportEditor";
import ImageViewportEditor from "@/components/admin/ImageViewportEditor";
import {
  type MultimediaLibraryResource,
  type MultimediaLibraryState,
  multimediaShortName,
} from "@/components/admin/game-multimedia-library-types";
import {
  isImageCropConfirmed,
  isVideoCropConfirmed,
  LEGACY_DESTINATION_IMAGE_ASPECTS,
  REQUIRED_DESTINATION_ASPECTS,
} from "@/lib/media/game-media-requirements";
import type {
  GameCardVideo,
  GameDestinationMediaMode,
  GameVideoViewport,
} from "@/types/game";

import styles from "./GameMediaAssignmentsWorkspace.module.css";

const EMPTY_RESOURCES: MultimediaLibraryResource[] = [];
const MODES: Array<{ value: GameDestinationMediaMode; label: string }> = [
  { value: "image", label: "Imagen" },
  { value: "video", label: "Video" },
  { value: "hover-video", label: "Imagen + hover" },
];

type Props = {
  slug: string;
  revision: number;
};

type FixedTarget = "cover" | "hero" | "card";
type EditState = {
  target: FixedTarget;
  kind: "image" | "video";
} | null;

function cardVideoClip(
  card: GameCardVideo | null | undefined,
  heroClip: string | null | undefined,
  legacyClip: string | null | undefined
) {
  if (card?.source === "hero") return heroClip ?? null;
  if (card?.source === "independent") return card.clip;
  return legacyClip ?? null;
}

function cardVideoViewport(
  card: GameCardVideo | null | undefined
): GameVideoViewport | undefined {
  return card?.viewport;
}

function modeLabel(mode: GameDestinationMediaMode) {
  if (mode === "hover-video") return "Imagen + hover";
  return mode === "video" ? "Video" : "Imagen";
}

function needsImage(mode: GameDestinationMediaMode) {
  return mode !== "video";
}

function needsVideo(mode: GameDestinationMediaMode) {
  return mode !== "image";
}

function ResourcePicker({
  slug,
  revision,
  target,
  kind,
  resources,
  selected,
  disabled,
  label,
}: {
  slug: string;
  revision: number;
  target: "cover-image" | "hero-image" | "hero-video" | "card-image" | "card-video";
  kind: "image" | "video";
  resources: MultimediaLibraryResource[];
  selected: string | null;
  disabled: boolean;
  label: string;
}) {
  const available = resources.filter((resource) => resource.kind === kind);
  const ready = Boolean(selected);

  return (
    <details className={styles.picker}>
      <summary data-ready={ready ? "true" : "false"}>
        {ready ? <CheckCircle2 size={15} aria-hidden="true" /> : kind === "image" ? <ImageIcon size={15} aria-hidden="true" /> : <Clapperboard size={15} aria-hidden="true" />}
        {ready ? `${label} seleccionad${kind === "image" ? "a" : "o"}` : `Seleccionar ${label.toLocaleLowerCase("es")}`}
      </summary>
      <div className={styles.pickerPanel}>
        {available.length ? (
          <div className={styles.choices}>
            {available.map((resource) => (
              <form
                key={`${kind}:${resource.src}`}
                method="post"
                action={`/api/admin/content/games/${encodeURIComponent(slug)}/media-library`}
                className={styles.choiceForm}
              >
                <input type="hidden" name="expectedRevision" value={revision} />
                <input type="hidden" name="target" value={target} />
                <input type="hidden" name="resource" value={resource.src} />
                <button type="submit" className={styles.choice} disabled={disabled}>
                  <AdminMediaThumbnail
                    kind={resource.kind}
                    src={resource.src}
                    mode="source"
                    label={multimediaShortName(resource.src)}
                    sizes="64px"
                    playIndicator={resource.kind === "video"}
                    className={styles.choiceThumb}
                  />
                  <span className={styles.choiceCopy}>
                    <strong>{multimediaShortName(resource.src)}</strong>
                    <small>{resource.kind === "image" ? "Imagen de biblioteca" : "Video WebM editorial"}</small>
                  </span>
                </button>
              </form>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            No hay {kind === "image" ? "imágenes" : "videos"} disponibles. Agrega el master desde la Biblioteca multimedia de la columna lateral y vuelve a esta asignación.
          </div>
        )}
      </div>
    </details>
  );
}

function ModeSwitch({
  slug,
  revision,
  target,
  mode,
  disabled,
}: {
  slug: string;
  revision: number;
  target: "hero" | "card";
  mode: GameDestinationMediaMode;
  disabled: boolean;
}) {
  return (
    <form
      method="post"
      action={`/api/admin/content/games/${encodeURIComponent(slug)}/media-library`}
      className={styles.modeSwitch}
      aria-label={`Modo de ${target === "hero" ? "Hero" : "detalle de Card"}`}
    >
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="target" value={`${target}-mode`} />
      {MODES.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="resource"
          value={option.value}
          disabled={disabled}
          aria-pressed={mode === option.value}
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}

function CropButton({
  ready,
  assigned,
  aspect,
  kind,
  disabled,
  onClick,
}: {
  ready: boolean;
  assigned: boolean;
  aspect: string;
  kind: "image" | "video";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.cropButton}
      data-ready={ready ? "true" : "false"}
      disabled={disabled || !assigned}
      onClick={onClick}
    >
      {ready ? <CheckCircle2 size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}
      {ready
        ? `Recorte ${aspect} confirmado`
        : assigned
          ? `Confirmar recorte ${aspect} de ${kind === "image" ? "imagen" : "video"}`
          : `Falta ${kind === "image" ? "imagen" : "video"}`}
    </button>
  );
}

function RequirementLine({ ready, text }: { ready: boolean; text: string }) {
  return (
    <div className={styles.readyLine} data-ready={ready ? "true" : "false"}>
      {ready ? <CheckCircle2 size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
      {text}
    </div>
  );
}

export default function GameMediaAssignmentsWorkspace({
  slug,
  revision,
}: Props) {
  const [state, setState] = useState<MultimediaLibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState>(() => {
    if (typeof window === "undefined") return null;
    if (window.location.hash === "#cover-crop") return { target: "cover", kind: "image" };
    if (window.location.hash === "#hero-crop") return { target: "hero", kind: "image" };
    if (window.location.hash === "#card-crop") return { target: "card", kind: "image" };
    return null;
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/admin/content/games/${encodeURIComponent(slug)}/media-workspace`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error("No se pudo cargar la asignación multimedia del juego.");
        }
        const payload = await response.json() as MultimediaLibraryState;
        if (!controller.signal.aborted) setState(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la asignación multimedia."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [slug]);

  const resources = state?.resources ?? EMPTY_RESOURCES;
  const assignments = state?.assignments;
  const currentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  const imageResources = useMemo(
    () => resources.filter((resource) => resource.kind === "image"),
    [resources]
  );
  const videoResources = useMemo(
    () => resources.filter((resource) => resource.kind === "video"),
    [resources]
  );

  if (loading) {
    return <div className={styles.status} role="status">Cargando asignación de destinos…</div>;
  }
  if (error || !assignments) {
    return <div className={styles.status} role="alert">{error ?? "No se pudo leer la asignación multimedia."}</div>;
  }

  const posterImage = assignments.coverImage;
  const posterViewport = assignments.imageMedia?.cover;
  const posterResource = imageResources.find((resource) => resource.src === posterImage) ?? null;
  const posterReady = Boolean(
    posterImage &&
    isImageCropConfirmed(
      posterViewport,
      REQUIRED_DESTINATION_ASPECTS.cover,
      LEGACY_DESTINATION_IMAGE_ASPECTS.cover
    )
  );

  const cardMode = assignments.cardMode;
  const cardImage = assignments.cardImage;
  const cardImageViewport = assignments.imageMedia?.card;
  const cardImageResource = imageResources.find((resource) => resource.src === cardImage) ?? null;
  const cardImageReady = Boolean(
    cardImage &&
    isImageCropConfirmed(
      cardImageViewport,
      REQUIRED_DESTINATION_ASPECTS.card,
      LEGACY_DESTINATION_IMAGE_ASPECTS.card
    )
  );
  const resolvedCardClip = cardVideoClip(
    assignments.cardVideo,
    assignments.heroVideo?.clip,
    assignments.legacyPreviewClip
  );
  const resolvedCardViewport = cardVideoViewport(assignments.cardVideo);
  const cardVideoResource = videoResources.find((resource) => resource.src === resolvedCardClip) ?? null;
  const cardVideoReady = Boolean(
    resolvedCardClip &&
    isVideoCropConfirmed(
      resolvedCardViewport,
      REQUIRED_DESTINATION_ASPECTS.card
    )
  );
  const cardDetailReady =
    (!needsImage(cardMode) || cardImageReady) &&
    (!needsVideo(cardMode) || cardVideoReady);
  const wholeCardReady = posterReady && cardDetailReady;

  const heroMode = assignments.heroMode;
  const heroImage = assignments.heroImage;
  const heroViewport = assignments.imageMedia?.hero;
  const heroImageResource = imageResources.find((resource) => resource.src === heroImage) ?? null;
  const heroImageReady = Boolean(
    heroImage &&
    isImageCropConfirmed(
      heroViewport,
      REQUIRED_DESTINATION_ASPECTS.hero,
      LEGACY_DESTINATION_IMAGE_ASPECTS.hero
    )
  );
  const heroVideo = assignments.heroVideo;
  const heroVideoResource = videoResources.find((resource) => resource.src === heroVideo?.clip) ?? null;
  const heroVideoReady = Boolean(
    heroVideo?.clip &&
    isVideoCropConfirmed(
      heroVideo.viewport,
      REQUIRED_DESTINATION_ASPECTS.hero
    )
  );
  const heroReady =
    (!needsImage(heroMode) || heroImageReady) &&
    (!needsVideo(heroMode) || heroVideoReady);

  const editImage = editing?.kind === "image"
    ? editing.target === "cover"
      ? posterImage
      : editing.target === "hero"
        ? heroImage
        : cardImage
    : null;
  const editImageViewport = editing?.kind === "image"
    ? editing.target === "cover"
      ? posterViewport
      : editing.target === "hero"
        ? heroViewport
        : cardImageViewport
    : undefined;
  const editVideo = editing?.kind === "video"
    ? editing.target === "hero"
      ? heroVideo?.clip ?? null
      : editing.target === "card"
        ? resolvedCardClip
        : null
    : null;
  const editVideoViewport = editing?.kind === "video"
    ? editing.target === "hero"
      ? heroVideo?.viewport
      : editing.target === "card"
        ? resolvedCardViewport
        : undefined
    : undefined;

  return (
    <div className={styles.root}>
      <section className={styles.intro}>
        <div>
          <span>ASIGNACIÓN DE DESTINOS</span>
          <h2>Card es la presentación principal del juego</h2>
          <p>
            Card concentra la portada inicial 4:5 y la vista informativa 3:2. La portada es siempre una imagen; la vista informativa puede usar imagen, video o imagen + hover. Hero, Contenedor, Fondo y Galería mantienen destinos propios.
          </p>
        </div>
        <span className={styles.revision}>REVISIÓN {currentRevision}</span>
      </section>

      {stale && (
        <div className={styles.stale} role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          La revisión cambió desde que abriste la página. Recarga antes de modificar destinos.
        </div>
      )}

      <div className={styles.grid}>
        <article className={styles.cardDestination} aria-labelledby="card-destination-heading">
          <header className={styles.destinationHeader}>
            <div>
              <b>A</b>
              <h3 id="card-destination-heading">Card del juego</h3>
            </div>
            <small>Portada 4:5 + detalle 3:2</small>
          </header>
          <p className={styles.cardIntro}>
            La portada es el primer estado visual y también alimenta la portada de la ficha. Al revelar información, la misma Card muestra su capa 3:2 con los datos del juego. La Home decide por fila si usa Portada, Info + imagen o Info + video.
          </p>

          <div className={styles.cardLayers}>
            <section className={styles.layer} id="cover-crop" aria-labelledby="card-poster-heading">
              <div className={styles.layerHeader}>
                <div>
                  <strong id="card-poster-heading">Portada inicial</strong>
                  <span>Imagen limpia para el estado poster y la ficha del juego.</span>
                </div>
                <span className={styles.aspect}>4:5</span>
              </div>

              <div className={styles.current}>
                {posterResource ? (
                  <AdminMediaThumbnail
                    kind="image"
                    src={posterResource.src}
                    viewport={posterViewport}
                    mode="destination"
                    frameAspect={4 / 5}
                    label="Card · portada inicial"
                    sizes="96px"
                    className={`${styles.thumb} ${styles.thumbPoster}`}
                  />
                ) : (
                  <ImageIcon size={28} aria-hidden="true" />
                )}
                <div className={styles.currentMeta}>
                  <span>Imagen de portada</span>
                  <strong>{posterImage ? multimediaShortName(posterImage) : "Sin imagen asignada"}</strong>
                  <small>Este layer no reproduce video; evita carga innecesaria y mantiene una portada consistente.</small>
                </div>
              </div>

              <div className={styles.actions}>
                <ResourcePicker
                  slug={slug}
                  revision={currentRevision}
                  target="cover-image"
                  kind="image"
                  resources={imageResources}
                  selected={posterImage}
                  disabled={stale}
                  label="Imagen de portada"
                />
                <CropButton
                  ready={posterReady}
                  assigned={Boolean(posterImage)}
                  aspect="4:5"
                  kind="image"
                  disabled={stale}
                  onClick={() => setEditing({ target: "cover", kind: "image" })}
                />
              </div>
              <RequirementLine
                ready={posterReady}
                text={posterReady ? "PORTADA DE CARD LISTA · 4:5" : "FALTA COMPLETAR LA PORTADA 4:5"}
              />
            </section>

            <section className={styles.layer} id="card-crop" aria-labelledby="card-detail-heading">
              <div className={styles.layerHeader}>
                <div>
                  <strong id="card-detail-heading">Vista informativa</strong>
                  <span>Media 3:2 + título, rating y datos según la variante de Card.</span>
                </div>
                <span className={styles.aspect}>3:2</span>
              </div>

              <ModeSwitch
                slug={slug}
                revision={currentRevision}
                target="card"
                mode={cardMode}
                disabled={stale}
              />

              <div className={styles.current}>
                {cardImageResource ? (
                  <AdminMediaThumbnail
                    kind="image"
                    src={cardImageResource.src}
                    viewport={cardImageViewport}
                    mode="destination"
                    frameAspect={3 / 2}
                    label="Card · detalle 3:2"
                    sizes="96px"
                    className={`${styles.thumb} ${styles.thumbDetail}`}
                  />
                ) : cardVideoResource ? (
                  <AdminMediaThumbnail
                    kind="video"
                    src={cardVideoResource.src}
                    viewport={resolvedCardViewport}
                    mode="destination"
                    frameAspect={3 / 2}
                    label="Card · video 3:2"
                    sizes="96px"
                    playIndicator
                    className={`${styles.thumb} ${styles.thumbDetail}`}
                  />
                ) : (
                  <MonitorPlay size={28} aria-hidden="true" />
                )}
                <div className={styles.currentMeta}>
                  <span>Modo de detalle</span>
                  <strong>{modeLabel(cardMode)}</strong>
                  <small>
                    {cardMode === "hover-video"
                      ? `${cardImage ? multimediaShortName(cardImage) : "Imagen pendiente"} + ${resolvedCardClip ? multimediaShortName(resolvedCardClip) : "video pendiente"}`
                      : cardMode === "video"
                        ? resolvedCardClip ? multimediaShortName(resolvedCardClip) : "Video pendiente"
                        : cardImage ? multimediaShortName(cardImage) : "Imagen pendiente"}
                  </small>
                </div>
              </div>

              <div className={styles.actions}>
                {needsImage(cardMode) && (
                  <>
                    <ResourcePicker
                      slug={slug}
                      revision={currentRevision}
                      target="card-image"
                      kind="image"
                      resources={imageResources}
                      selected={cardImage}
                      disabled={stale}
                      label="Imagen 3:2"
                    />
                    <CropButton
                      ready={cardImageReady}
                      assigned={Boolean(cardImage)}
                      aspect="3:2"
                      kind="image"
                      disabled={stale}
                      onClick={() => setEditing({ target: "card", kind: "image" })}
                    />
                  </>
                )}
                {needsVideo(cardMode) && (
                  <>
                    <ResourcePicker
                      slug={slug}
                      revision={currentRevision}
                      target="card-video"
                      kind="video"
                      resources={videoResources}
                      selected={resolvedCardClip}
                      disabled={stale}
                      label="Video 3:2"
                    />
                    <CropButton
                      ready={cardVideoReady}
                      assigned={Boolean(resolvedCardClip)}
                      aspect="3:2"
                      kind="video"
                      disabled={stale}
                      onClick={() => setEditing({ target: "card", kind: "video" })}
                    />
                  </>
                )}
              </div>
              <RequirementLine
                ready={cardDetailReady}
                text={cardDetailReady ? "DETALLE DE CARD LISTO · 3:2" : "FALTA COMPLETAR EL DETALLE 3:2"}
              />
            </section>
          </div>

          <div className={styles.destinationBody}>
            <RequirementLine
              ready={wholeCardReady}
              text={wholeCardReady ? "CARD COMPLETA · PORTADA + DETALLE" : "CARD INCOMPLETA · REVISA SUS DOS CAPAS"}
            />
          </div>
        </article>

        <article className={styles.destination} aria-labelledby="hero-destination-heading">
          <header className={styles.destinationHeader} id="hero-crop">
            <div>
              <b>B</b>
              <h3 id="hero-destination-heading">Hero de inicio</h3>
            </div>
            <small>Obligatorio · 3:1</small>
          </header>
          <div className={styles.destinationBody}>
            <ModeSwitch
              slug={slug}
              revision={currentRevision}
              target="hero"
              mode={heroMode}
              disabled={stale}
            />

            <div className={styles.current}>
              {heroImageResource ? (
                <AdminMediaThumbnail
                  kind="image"
                  src={heroImageResource.src}
                  viewport={heroViewport}
                  mode="destination"
                  frameAspect={3}
                  label="Hero 3:1"
                  sizes="96px"
                  className={`${styles.thumb} ${styles.thumbDetail}`}
                />
              ) : heroVideoResource ? (
                <AdminMediaThumbnail
                  kind="video"
                  src={heroVideoResource.src}
                  viewport={heroVideo?.viewport}
                  mode="destination"
                  frameAspect={3}
                  label="Hero video 3:1"
                  sizes="96px"
                  playIndicator
                  className={`${styles.thumb} ${styles.thumbDetail}`}
                />
              ) : (
                <MonitorPlay size={28} aria-hidden="true" />
              )}
              <div className={styles.currentMeta}>
                <span>Modo Hero</span>
                <strong>{modeLabel(heroMode)}</strong>
                <small>Destino panorámico independiente de la Card.</small>
              </div>
            </div>

            <div className={styles.actions}>
              {needsImage(heroMode) && (
                <>
                  <ResourcePicker
                    slug={slug}
                    revision={currentRevision}
                    target="hero-image"
                    kind="image"
                    resources={imageResources}
                    selected={heroImage}
                    disabled={stale}
                    label="Imagen Hero"
                  />
                  <CropButton
                    ready={heroImageReady}
                    assigned={Boolean(heroImage)}
                    aspect="3:1"
                    kind="image"
                    disabled={stale}
                    onClick={() => setEditing({ target: "hero", kind: "image" })}
                  />
                </>
              )}
              {needsVideo(heroMode) && (
                <>
                  <ResourcePicker
                    slug={slug}
                    revision={currentRevision}
                    target="hero-video"
                    kind="video"
                    resources={videoResources}
                    selected={heroVideo?.clip ?? null}
                    disabled={stale}
                    label="Video Hero"
                  />
                  <CropButton
                    ready={heroVideoReady}
                    assigned={Boolean(heroVideo?.clip)}
                    aspect="3:1"
                    kind="video"
                    disabled={stale}
                    onClick={() => setEditing({ target: "hero", kind: "video" })}
                  />
                </>
              )}
            </div>
            <RequirementLine
              ready={heroReady}
              text={heroReady ? "HERO LISTO · 3:1" : "HERO INCOMPLETO · 3:1"}
            />
          </div>
        </article>

        <GameBackgroundMediaEditor
          slug={slug}
          revision={currentRevision}
          resources={resources}
          assignment={{
            mode: assignments.backgroundMode,
            image: assignments.backgroundImage,
            imageViewport: assignments.imageMedia?.background ?? null,
            video: assignments.backgroundVideo,
          }}
          stale={stale}
        />

        <GameDetailMediaEditor
          slug={slug}
          revision={currentRevision}
          endpoint={`/api/admin/content/games/${encodeURIComponent(slug)}/media-library`}
          resources={resources}
          assignment={{
            mode: assignments.detailMode,
            image: assignments.detailImage,
            imageViewport: assignments.imageMedia?.detail ?? null,
            video: assignments.detailVideo,
          }}
          stale={stale}
          onAddResource={() => {
            document.querySelector<HTMLElement>("[data-multimedia-library-open]")?.click();
          }}
        />
      </div>

      <div className={styles.hint}>
        <strong>Biblioteca compartida:</strong> los masters se crean una sola vez y se reutilizan por referencia. Si necesitas agregar una imagen o video nuevo, usa la Biblioteca multimedia de la columna lateral; ningún recurso se sube ni se publica automáticamente desde esta vista.
      </div>

      {editing?.kind === "image" && editImage && (
        <ContextualMediaDialog
          eyebrow={editing.target === "cover" ? "CARD · PORTADA" : editing.target === "card" ? "CARD · DETALLE" : "HERO"}
          title={editing.target === "cover" ? "Recorte 4:5 de la portada de Card" : editing.target === "card" ? "Recorte 3:2 de la vista informativa" : "Recorte 3:1 del Hero"}
          description="Se guarda únicamente el encuadre editorial. El archivo físico permanece intacto y reutilizable."
          onClose={() => setEditing(null)}
        >
          <ImageViewportEditor
            slug={slug}
            revision={currentRevision}
            target={editing.target}
            src={editImage}
            label={editing.target === "cover" ? "Card · portada 4:5" : editing.target === "card" ? "Card · detalle 3:2" : "Hero · 3:1"}
            initialViewport={editImageViewport}
            onClose={() => setEditing(null)}
          />
        </ContextualMediaDialog>
      )}

      {editing?.kind === "video" && editVideo && editVideoViewport && editing.target !== "cover" && (
        <ContextualMediaDialog
          eyebrow={editing.target === "card" ? "CARD · DETALLE" : "HERO"}
          title={editing.target === "card" ? "Recorte 3:2 del video de Card" : "Recorte 3:1 del video Hero"}
          description="El WebM se reutiliza por referencia; este editor sólo confirma el encuadre del destino."
          onClose={() => setEditing(null)}
        >
          <GameVideoViewportEditor
            slug={slug}
            revision={currentRevision}
            target={editing.target}
            source={editing.target === "hero" ? "hero" : assignments.cardVideo?.source ?? "independent"}
            clip={editVideo}
            label={editing.target === "card" ? "Card · video 3:2" : "Hero · video 3:1"}
            initialViewport={editVideoViewport}
            onClose={() => setEditing(null)}
          />
        </ContextualMediaDialog>
      )}
    </div>
  );
}
