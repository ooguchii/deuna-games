import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import GameDownloadEditor from "@/components/admin/GameDownloadEditor";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GamePlatformEditor from "@/components/admin/GamePlatformEditor";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getGamePublicationIdentity,
} from "@/lib/admin/publication-overview";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import type {
  GameHardwareRequirements,
} from "@/types/game";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

const gameSections = [
  "ficha",
  "datos",
  "requisitos",
  "multimedia",
  "descargas",
  "historial",
] as const;

type GameSection = (typeof gameSections)[number];

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string | string[];
    seccion?: string | string[];
  }>;
};

function legacyMinimum(
  requirements: GameHardwareRequirements | undefined
) {
  if (!requirements) return undefined;

  const minimum: GameHardwareRequirements = {
    system: requirements.system,
    processor: requirements.processor,
    ram: requirements.ram,
    graphics: requirements.graphics,
    storage: requirements.storage,
  };

  return Object.values(minimum).some(Boolean)
    ? minimum
    : undefined;
}

function resolveGameSection(
  value: string | string[] | undefined
): GameSection {
  const candidate = Array.isArray(value)
    ? value[0]
    : value;

  return gameSections.includes(candidate as GameSection)
    ? (candidate as GameSection)
    : "ficha";
}

export default async function AdminGameEditorPage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ slug }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const [item, publicationIdentity] = await Promise.all([
    getEditorialItem("game", slug),
    getGamePublicationIdentity(slug),
  ]);

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const section = resolveGameSection(parameters.seccion);
  const panelCreated =
    publicationIdentity?.panelCreated ?? false;
  const game = item.payload;
  const download = game.download;
  const requirements = game.requirements;
  const minimum =
    requirements?.minimum ??
    legacyMinimum(requirements);
  const recommended = requirements?.recommended;

  return (
    <>
      <Link href="/admin/juegos" className={styles.backLink}>
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a juegos
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>JUEGO · REVISIÓN {item.revision}</span>
          <h1>{game.title}</h1>
          <p>
            Trabaja una sección a la vez. Guardar conserva el borrador y Publicar sigue siendo una acción separada.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Link
            href={`/admin/juegos/${encodeURIComponent(slug)}/vista-previa`}
            className={styles.tableAction}
          >
            <Eye size={14} aria-hidden="true" />
            Vista previa
          </Link>
          <span className={styles.draftState}>
            {item.status === "synced"
              ? "Sin cambios"
              : "Borrador modificado"}
          </span>
        </div>
      </header>

      <EditorStateNotice state={state} />

      {!item.sourcePresent && !panelCreated && (
        <div className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}>
          Este juego ya no está presente en los archivos fuente. Se conserva para revisión y recuperación.
        </div>
      )}

      {section === "ficha" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>DATOS PRINCIPALES</span>
              <h2>Ficha editorial</h2>
            </div>
            <p>
              Título, descripción, categoría y datos de presentación principales.
            </p>
          </div>

          <form
            className={styles.editorForm}
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}`}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={item.revision}
            />

            <label className={styles.fieldWide}>
              <span>Título</span>
              <input
                name="title"
                defaultValue={game.title}
                maxLength={140}
                required
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Descripción</span>
              <textarea
                name="description"
                defaultValue={game.description}
                maxLength={2500}
                rows={6}
                required
              />
            </label>

            <label>
              <span>Categoría</span>
              <input
                name="category"
                defaultValue={game.category}
                maxLength={80}
                required
              />
            </label>

            <label>
              <span>Versión</span>
              <input
                name="version"
                defaultValue={game.version ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Insignia</span>
              <input
                name="badge"
                defaultValue={game.badge ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Valoración (0–5)</span>
              <input
                name="rating"
                type="number"
                min="0"
                max="5"
                step="0.01"
                defaultValue={game.rating ?? ""}
              />
            </label>

            <label>
              <span>Reseñas</span>
              <input
                name="reviews"
                defaultValue={game.reviews ?? ""}
                maxLength={30}
                placeholder="12.4K"
              />
            </label>

            <label>
              <span>Texto alternativo</span>
              <input
                name="imageAlt"
                defaultValue={game.imageAlt}
                maxLength={240}
                required
              />
            </label>

            <div className={styles.formActions}>
              <p>
                Guardar no publica. La revisión anterior seguirá disponible en Historial.
              </p>
              <button type="submit">
                Guardar ficha
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "datos" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>DATOS AVANZADOS</span>
              <h2>Identidad y clasificación</h2>
            </div>
            <p>
              Información para etiquetas, filtros, plataformas y metadatos de la ficha.
            </p>
          </div>

          <form
            className={styles.editorForm}
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}/advanced`}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={item.revision}
            />

            <label>
              <span>Título corto</span>
              <input
                name="shortTitle"
                defaultValue={game.shortTitle ?? ""}
                maxLength={140}
              />
            </label>

            <label>
              <span>Parte destacada del título</span>
              <input
                name="highlightedTitle"
                defaultValue={game.highlightedTitle ?? ""}
                maxLength={140}
              />
            </label>

            <label>
              <span>Desarrollador</span>
              <input
                name="developer"
                defaultValue={game.developer ?? ""}
                maxLength={160}
              />
            </label>

            <label>
              <span>Editor / publisher</span>
              <input
                name="publisher"
                defaultValue={game.publisher ?? ""}
                maxLength={160}
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Fecha de lanzamiento</span>
              <input
                name="releaseDate"
                defaultValue={game.releaseDate ?? ""}
                maxLength={40}
                placeholder="25/02/2022"
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Géneros — separados por coma o por línea</span>
              <textarea
                name="genresText"
                defaultValue={(game.genres ?? []).join(", ")}
                maxLength={1800}
                rows={3}
                placeholder="RPG, Acción"
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Etiquetas — separadas por coma o por línea</span>
              <textarea
                name="tagsText"
                defaultValue={(game.tags ?? []).join(", ")}
                maxLength={2600}
                rows={4}
                placeholder="Mundo abierto, Fantasía oscura, Un jugador"
              />
            </label>

            <GamePlatformEditor
              initialPlatforms={game.platforms ?? []}
            />

            <div className={styles.formActions}>
              <p>
                La categoría principal sigue funcionando como respaldo cuando no hay géneros o plataformas específicos.
              </p>
              <button type="submit">
                Guardar datos avanzados
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "requisitos" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>REQUISITOS</span>
              <h2>Compatibilidad del sistema</h2>
            </div>
            <p>
              Configura mínimos y recomendados sin mezclar esta tarea con el resto de la ficha.
            </p>
          </div>

          <form
            className={styles.editorForm}
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}/requirements`}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={item.revision}
            />

            <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
              <strong>Requisitos mínimos</strong>
              <span>Equipo base para ejecutar el juego</span>
            </div>

            <label>
              <span>Sistema operativo</span>
              <input
                name="minimumSystem"
                defaultValue={minimum?.system ?? ""}
                maxLength={240}
                placeholder="Windows 10 de 64 bits"
              />
            </label>

            <label>
              <span>Procesador</span>
              <input
                name="minimumProcessor"
                defaultValue={minimum?.processor ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Memoria RAM</span>
              <input
                name="minimumRam"
                defaultValue={minimum?.ram ?? ""}
                maxLength={240}
                placeholder="12 GB"
              />
            </label>

            <label>
              <span>Gráficos</span>
              <input
                name="minimumGraphics"
                defaultValue={minimum?.graphics ?? ""}
                maxLength={240}
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Almacenamiento</span>
              <input
                name="minimumStorage"
                defaultValue={minimum?.storage ?? ""}
                maxLength={240}
                placeholder="60 GB"
              />
            </label>

            <div className={`${styles.tableSummary} ${styles.fieldWide}`}>
              <strong>Requisitos recomendados</strong>
              <span>Configuración sugerida para una mejor experiencia</span>
            </div>

            <label>
              <span>Sistema operativo</span>
              <input
                name="recommendedSystem"
                defaultValue={recommended?.system ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Procesador</span>
              <input
                name="recommendedProcessor"
                defaultValue={recommended?.processor ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Memoria RAM</span>
              <input
                name="recommendedRam"
                defaultValue={recommended?.ram ?? ""}
                maxLength={240}
              />
            </label>

            <label>
              <span>Gráficos</span>
              <input
                name="recommendedGraphics"
                defaultValue={recommended?.graphics ?? ""}
                maxLength={240}
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Almacenamiento</span>
              <input
                name="recommendedStorage"
                defaultValue={recommended?.storage ?? ""}
                maxLength={240}
              />
            </label>

            <div className={styles.formActions}>
              <p>
                Si todos los campos quedan vacíos, el juego quedará sin requisitos editoriales configurados.
              </p>
              <button type="submit">
                Guardar requisitos
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "multimedia" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>MULTIMEDIA</span>
              <h2>Portada, hero y galería</h2>
            </div>
            <p>
              Sube WebP al almacén persistente o usa imágenes locales permitidas.
            </p>
          </div>

          <GameMediaUploadForm
            slug={slug}
            revision={item.revision}
            screenshotCount={game.screenshots?.length ?? 0}
          />

          <form
            className={styles.editorForm}
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}/media`}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={item.revision}
            />

            <label className={styles.fieldWide}>
              <span>Ruta de portada</span>
              <input
                name="coverImage"
                defaultValue={game.coverImage ?? ""}
                maxLength={400}
                placeholder="Ruta local de la portada"
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Ruta de imagen hero</span>
              <input
                name="heroImage"
                defaultValue={game.heroImage ?? ""}
                maxLength={400}
                placeholder="Ruta local de la imagen hero"
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Galería — una ruta por línea</span>
              <textarea
                name="screenshotsText"
                defaultValue={(game.screenshots ?? []).join("\n")}
                maxLength={3500}
                rows={7}
                placeholder="Una ruta local por línea"
              />
            </label>

            <div className={styles.formActions}>
              <p>
                Se aceptan hasta 8 capturas sin duplicados y las rutas se validan antes de guardar.
              </p>
              <button type="submit">
                Guardar multimedia
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "descargas" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>DESCARGAS</span>
              <h2>Página de descarga</h2>
            </div>
            <p>
              Gestiona tamaño, plataforma y fuentes sin abandonar el workspace del juego.
            </p>
          </div>

          {download?.href && (
            <div className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}>
              Este borrador conserva un enlace principal heredado. Las nuevas fuentes se añadirán sin eliminarlo hasta completar la migración del formato antiguo.
            </div>
          )}

          <form
            className={styles.editorForm}
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}/download`}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={item.revision}
            />

            <label>
              <span>Tamaño total (GB)</span>
              <input
                name="sizeGb"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={download?.sizeGb ?? ""}
                placeholder="60"
              />
            </label>

            <label>
              <span>Cantidad de archivos</span>
              <input
                name="fileCount"
                type="number"
                min="1"
                max="10000"
                step="1"
                defaultValue={download?.fileCount ?? ""}
                placeholder="1"
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Plataforma mostrada</span>
              <input
                name="platform"
                defaultValue={download?.platform ?? ""}
                maxLength={80}
                placeholder="Windows"
              />
            </label>

            <GameDownloadEditor
              initialSources={download?.sources ?? []}
            />

            <div className={styles.formActions}>
              <p>
                Las direcciones se validan antes de guardarse y no se aceptan URLs HTTP inseguras.
              </p>
              <button type="submit">
                Guardar descargas
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "historial" && (
        <EditorialHistory
          revisions={item.revisions}
          currentRevision={item.revision}
        />
      )}
    </>
  );
}
