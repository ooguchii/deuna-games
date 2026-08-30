import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  verifyAdminSession,
} from "@/lib/admin/session";
import type {
  GameHardwareRequirements,
} from "@/types/game";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string | string[];
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

export default async function AdminGameEditorPage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ slug }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const item = await getEditorialItem("game", slug);

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
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
            Edita la ficha, los datos avanzados, los requisitos, la multimedia y la configuración de descarga desde un único borrador versionado.
          </p>
        </div>
        <span className={styles.draftState}>
          {item.status === "synced"
            ? "Sin cambios"
            : "Borrador modificado"}
        </span>
      </header>

      <EditorStateNotice state={state} />

      {!item.sourcePresent && (
        <div className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}>
          Este juego ya no está presente en los archivos fuente. Se conserva para revisión y recuperación.
        </div>
      )}

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>DATOS PRINCIPALES</span>
            <h2>Ficha editorial</h2>
          </div>
          <p>
            Estos campos forman parte del borrador versionado del juego.
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
              Guardar no publica. La revisión anterior seguirá disponible debajo.
            </p>
            <button type="submit">
              Guardar ficha
            </button>
          </div>
        </form>
      </section>

      <section
        id="datos-avanzados"
        className={styles.editorPanel}
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>DATOS AVANZADOS</span>
            <h2>Identidad y clasificación</h2>
          </div>
          <p>
            Completa la información que alimenta etiquetas, detalles, filtros y metadatos de cada ficha.
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
              La categoría principal sigue funcionando como respaldo cuando un juego no tiene géneros o plataformas específicos configurados.
            </p>
            <button type="submit">
              Guardar datos avanzados
            </button>
          </div>
        </form>
      </section>

      <section
        id="requisitos"
        className={styles.editorPanel}
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>REQUISITOS</span>
            <h2>Compatibilidad del sistema</h2>
          </div>
          <p>
            Los mínimos se conservan también en el formato anterior para que las vistas existentes sigan siendo compatibles.
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

      <section
        id="multimedia"
        className={styles.editorPanel}
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>MULTIMEDIA</span>
            <h2>Portada, hero y galería</h2>
          </div>
          <p>
            Puedes subir WebP al almacén editorial persistente o seguir usando imágenes incluidas en /public/images.
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
              Se aceptan hasta 8 capturas, sin duplicados. Las rutas persistentes subidas desde el panel y las imágenes locales permitidas se validan antes de guardar.
            </p>
            <button type="submit">
              Guardar multimedia
            </button>
          </div>
        </form>
      </section>

      <section
        id="descargas"
        className={styles.editorPanel}
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>DESCARGAS</span>
            <h2>Página de descarga</h2>
          </div>
          <p>
            Esta configuración alimenta la pantalla pública cuando el borrador pasa a publicación.
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
              Las direcciones se validan antes de guardarse. No se aceptan URLs HTTP ni direcciones HTTPS con usuario o contraseña embebidos.
            </p>
            <button type="submit">
              Guardar descargas
            </button>
          </div>
        </form>
      </section>

      <EditorialHistory
        revisions={item.revisions}
        currentRevision={item.revision}
      />
    </>
  );
}
