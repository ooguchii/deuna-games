"use client";

import {
  BookOpen,
  CheckCircle2,
  Clapperboard,
  FolderOpen,
  ImageIcon,
  Images,
  Info,
  MonitorPlay,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AdminMediaLibraryPreview from "@/components/admin/AdminMediaLibraryPreview";
import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GameVideoLibraryEditor from "@/components/admin/GameVideoLibraryEditor";
import {
  formatMultimediaBytes,
  type MultimediaLibraryResource,
  type MultimediaLibraryState,
  multimediaShortName,
} from "@/components/admin/game-multimedia-library-types";

import styles from "./GameMultimediaShell.module.css";

type Props = {
  slug: string;
  revision: number;
  screenshotCount: number;
};

type AddKind = "image" | "video";

function resourceDetail(resource: MultimediaLibraryResource) {
  if (resource.kind === "video") {
    return `Video WebM · ${formatMultimediaBytes(resource.bytes)}`;
  }
  if (resource.width !== null && resource.height !== null) {
    return `${resource.width}×${resource.height} · ${formatMultimediaBytes(resource.bytes)}`;
  }
  return `Imagen · ${formatMultimediaBytes(resource.bytes)}`;
}

export default function GameMultimediaUtilityRail({
  slug,
  revision,
  screenshotCount,
}: Props) {
  const [state, setState] = useState<MultimediaLibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [previewResource, setPreviewResource] = useState<MultimediaLibraryResource | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error("No se pudo cargar la biblioteca multimedia.");
        const payload = await response.json() as MultimediaLibraryState;
        if (!controller.signal.aborted) setState(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [slug]);

  const resources = state?.resources ?? [];
  const images = useMemo(
    () => resources.filter((resource) => resource.kind === "image"),
    [resources]
  );
  const videos = useMemo(
    () => resources.filter((resource) => resource.kind === "video"),
    [resources]
  );
  const previewResources = resources.slice(0, 3);
  const currentRevision = state?.revision ?? revision;
  const stale = state !== null && state.revision !== revision;

  function deleteForm(resource: MultimediaLibraryResource) {
    if (resource.kind === "image" && resource.origin === "bundled") {
      return <span className={styles.libraryBundledBadge}>Base</span>;
    }

    return (
      <form
        action={`/api/admin/content/games/${encodeURIComponent(slug)}/media-resource-delete`}
        method="post"
      >
        <input type="hidden" name="expectedRevision" value={currentRevision} />
        <input
          type="hidden"
          name="target"
          value={resource.kind === "image" ? "image-delete" : "video-delete"}
        />
        <input type="hidden" name="resource" value={resource.src} />
        <button
          type="submit"
          className={styles.libraryDeleteButton}
          disabled={stale}
          aria-label={`Eliminar ${multimediaShortName(resource.src)} de la biblioteca`}
          title="Eliminar de la biblioteca"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </form>
    );
  }

  function renderLibraryGroup(
    title: string,
    kind: "image" | "video",
    group: MultimediaLibraryResource[]
  ) {
    return (
      <section className={styles.libraryDialogGroup}>
        <div className={styles.libraryDialogHeading}>
          <div>
            {kind === "image" ? <ImageIcon size={17} aria-hidden="true" /> : <Clapperboard size={17} aria-hidden="true" />}
            <strong>{title}</strong>
          </div>
          <span>{group.length} recurso{group.length === 1 ? "" : "s"}</span>
        </div>
        {group.length ? (
          <div className={styles.libraryDialogGrid}>
            {group.map((resource) => (
              <article key={`${resource.kind}:${resource.src}`} className={styles.libraryResourceCard}>
                <div className={styles.libraryArtworkWrap}>
                  <button
                    type="button"
                    className={styles.libraryArtworkButton}
                    onClick={() => setPreviewResource(resource)}
                    aria-label={`Abrir vista grande de ${multimediaShortName(resource.src)}`}
                  >
                    <AdminMediaThumbnail
                      kind={resource.kind}
                      src={resource.src}
                      mode="source"
                      label={multimediaShortName(resource.src)}
                      sizes="220px"
                      playIndicator={resource.kind === "video"}
                    />
                  </button>
                  {deleteForm(resource)}
                </div>
                <div className={styles.libraryResourceMeta}>
                  <strong title={resource.src}>{multimediaShortName(resource.src)}</strong>
                  <small>{resourceDetail(resource)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.libraryEmptyGroup}>No hay {kind === "image" ? "imágenes" : "videos"} guardados todavía.</div>
        )}
      </section>
    );
  }

  return (
    <aside className={styles.utilityRail} aria-label="Herramientas multimedia">
      <section className={styles.utilityCard}>
        <div className={styles.utilityHeading}>
          <div>
            <span className={styles.utilityIcon}><FolderOpen size={17} aria-hidden="true" /></span>
            <div>
              <strong>Biblioteca multimedia</strong>
              <small>Masters reutilizables</small>
            </div>
          </div>
          <span className={styles.libraryTotal}>{resources.length}</span>
        </div>

        {loading ? (
          <div className={styles.utilityStatus}>Cargando recursos…</div>
        ) : error ? (
          <div className={styles.utilityStatus} role="alert">{error}</div>
        ) : (
          <>
            <div className={styles.libraryCounts}>
              <span><ImageIcon size={14} aria-hidden="true" />{images.length} imágenes</span>
              <span><Clapperboard size={14} aria-hidden="true" />{videos.length} videos</span>
            </div>

            {previewResources.length ? (
              <div className={styles.libraryMiniGrid}>
                {previewResources.map((resource) => (
                  <button
                    key={`${resource.kind}:${resource.src}`}
                    type="button"
                    className={styles.libraryMiniButton}
                    onClick={() => setPreviewResource(resource)}
                    title={multimediaShortName(resource.src)}
                  >
                    <AdminMediaThumbnail
                      kind={resource.kind}
                      src={resource.src}
                      mode="source"
                      label={multimediaShortName(resource.src)}
                      sizes="88px"
                      playIndicator={resource.kind === "video"}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.utilityEmpty}>
                <Images size={22} aria-hidden="true" />
                <span>La biblioteca todavía está vacía.</span>
              </div>
            )}
          </>
        )}

        <div className={styles.utilityActions}>
          <button type="button" className={styles.brandAction} onClick={() => setLibraryOpen(true)} disabled={loading || Boolean(error)}>
            <FolderOpen size={16} aria-hidden="true" />
            Abrir biblioteca
          </button>
          <button type="button" className={styles.secondaryAction} onClick={() => setAddKind("image")} disabled={stale}>
            <Plus size={16} aria-hidden="true" />
            Agregar recurso
          </button>
        </div>
      </section>

      <section className={styles.utilityCard}>
        <div className={styles.utilityHeading}>
          <div>
            <span className={styles.utilityIcon}><BookOpen size={17} aria-hidden="true" /></span>
            <div>
              <strong>Ayuda y reglas</strong>
              <small>Requisitos por destino</small>
            </div>
          </div>
        </div>
        <p className={styles.utilityCopy}>Las reglas siguen disponibles sin ocupar permanentemente la pantalla de trabajo.</p>
        <button type="button" className={styles.secondaryAction} onClick={() => setHelpOpen(true)}>
          <Info size={16} aria-hidden="true" />
          Ver requisitos multimedia
        </button>
      </section>

      {stale && (
        <div className={styles.utilityStale} role="alert">
          Esta página quedó detrás de la revisión multimedia actual. Recarga antes de editar.
        </div>
      )}

      {libraryOpen && (
        <ContextualMediaDialog
          eyebrow="BIBLIOTECA MULTIMEDIA"
          title="Biblioteca multimedia compartida"
          description="Imágenes y videos se guardan una sola vez y pueden reutilizarse en distintos destinos con encuadres independientes."
          onClose={() => setLibraryOpen(false)}
        >
          <div className={styles.libraryDialogTopbar}>
            <div>
              <strong>{resources.length} recursos</strong>
              <span>{images.length} imágenes · {videos.length} videos</span>
            </div>
            <button type="button" className={styles.brandAction} onClick={() => setAddKind("image")} disabled={stale}>
              <Upload size={16} aria-hidden="true" />
              Agregar nuevo recurso
            </button>
          </div>
          <div className={styles.libraryDialogGroups}>
            {renderLibraryGroup("IMÁGENES", "image", images)}
            {renderLibraryGroup("VIDEOS", "video", videos)}
          </div>
        </ContextualMediaDialog>
      )}

      {helpOpen && (
        <ContextualMediaDialog
          eyebrow="AYUDA MULTIMEDIA"
          title="Reglas de los destinos"
          description="Consulta estas reglas cuando las necesites; el área principal queda reservada para el trabajo editorial."
          onClose={() => setHelpOpen(false)}
        >
          <div className={styles.helpRules}>
            <div><MonitorPlay size={18} aria-hidden="true" /><p><strong>Portada · 4:5</strong><span>Imagen, Video o Imagen + hover. Cada capa activa confirma selección y encuadre.</span></p></div>
            <div><MonitorPlay size={18} aria-hidden="true" /><p><strong>Hero · 16:9</strong><span>Imagen, Video o Imagen + hover. Hover exige ambos recursos y sus recortes.</span></p></div>
            <div><Clapperboard size={18} aria-hidden="true" /><p><strong>Card · 3:2</strong><span>Su imagen y video pueden ser independientes y se validan por separado.</span></p></div>
            <div><Sparkles size={18} aria-hidden="true" /><p><strong>Fondo · adaptable</strong><span>Es opcional. Puede usar Imagen, Video o Imagen + hover, o volver al fondo global.</span></p></div>
            <div><MonitorPlay size={18} aria-hidden="true" /><p><strong>Contenedor · adaptable</strong><span>Es obligatorio e independiente del Hero; adapta foco y zoom al tamaño real de la ficha.</span></p></div>
            <div><Images size={18} aria-hidden="true" /><p><strong>Galería · mínimo 1 recurso</strong><span>Admite hasta 8 imágenes y videos combinados. Cada elemento confirma su propio recorte y conserva su orden editorial.</span></p></div>
            <div><CheckCircle2 size={18} aria-hidden="true" /><p><strong>Reutilizar sin acoplar</strong><span>El mismo archivo físico puede aparecer en varios destinos sin compartir encuadre ni recorte.</span></p></div>
          </div>
        </ContextualMediaDialog>
      )}

      {addKind && (
        <ContextualMediaDialog
          eyebrow="BIBLIOTECA COMPARTIDA"
          title="Agregar nuevo recurso"
          description="Crea o importa el master una sola vez. Después podrás asignarlo a cualquier destino o a Galería."
          onClose={() => setAddKind(null)}
        >
          <div className={styles.addTabs} role="group" aria-label="Tipo de recurso">
            <button type="button" data-active={addKind === "image"} onClick={() => setAddKind("image")}>
              <ImageIcon size={16} aria-hidden="true" /> Imagen
            </button>
            <button type="button" data-active={addKind === "video"} onClick={() => setAddKind("video")}>
              <Clapperboard size={16} aria-hidden="true" /> Video
            </button>
          </div>
          {addKind === "image" ? (
            <div className={styles.addResourceBody}>
              <p>El WebP queda guardado por hash y no completa ningún destino hasta que lo asignes.</p>
              <GameMediaUploadForm
                slug={slug}
                revision={currentRevision}
                screenshotCount={screenshotCount}
                libraryOnly
              />
            </div>
          ) : (
            <div className={styles.addResourceBody}>
              <p>El WebM editorial se crea como master reutilizable. Los recortes de cada destino se guardan después como metadata.</p>
              <GameVideoLibraryEditor slug={slug} revision={currentRevision} />
            </div>
          )}
        </ContextualMediaDialog>
      )}

      {previewResource && (
        <AdminMediaLibraryPreview
          kind={previewResource.kind}
          src={previewResource.src}
          name={multimediaShortName(previewResource.src)}
          details={resourceDetail(previewResource)}
          usage={[]}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </aside>
  );
}
