import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GameDownloadEditor from "@/components/admin/GameDownloadEditor";
import GameEditorFormActions from "@/components/admin/GameEditorFormActions";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GamePerformanceEditor from "@/components/admin/GamePerformanceEditor";
import GamePlatformEditor from "@/components/admin/GamePlatformEditor";
import GameTaxonomyMultiSelect from "@/components/admin/GameTaxonomyMultiSelect";
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
import type {
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

const gameSections = [
  "ficha",
  "datos",
  "requisitos",
  "rendimiento",
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

function publicationLabel(
  identity: Awaited<
    ReturnType<typeof getGamePublicationIdentity>
  >,
  fallbackSynced: boolean
) {
  if (!identity) {
    return fallbackSynced
      ? "Sin cambios"
      : "Borrador modificado";
  }

  if (
    identity.panelCreated &&
    !identity.everPublished
  ) {
    return "Sin publicar";
  }

  if (!identity.publicVisible) {
    return `Oculto · Pub. #${identity.publicationNumber}`;
  }

  if (identity.hasUnpublishedChanges) {
    return `Cambios pendientes · Pub. #${identity.publicationNumber}`;
  }

  return `Publicado · #${identity.publicationNumber}`;
}

function normalizeClassification(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function fallbackTerms(
  values: readonly string[]
): GameTaxonomyTerm[] {
  const labels = new Map<string, string>();

  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const normalized = normalizeClassification(label);
    if (!labels.has(normalized)) labels.set(normalized, label);
  }

  return [...labels.values()].map((label, index) => ({
    key: `legacy-${index}`,
    label,
    active: true,
  }));
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
  const [item, publicationIdentity, taxonomyItem] = await Promise.all([
    getEditorialItem("game", slug),
    getGamePublicationIdentity(slug),
    getEditorialItem("game_taxonomy", "games"),
  ]);

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const section = resolveGameSection(parameters.seccion);
  const panelCreated =
    publicationIdentity?.panelCreated ?? false;
  const game = item.payload;
  const taxonomy = taxonomyItem?.payload;
  const currentClassifications = [
    game.category,
    ...(game.genres ?? []),
  ];
  const currentClassificationSet = new Set(
    currentClassifications.map(normalizeClassification)
  );
  const classificationTerms =
    taxonomy?.classifications.filter(
      (term) =>
        term.active ||
        currentClassificationSet.has(
          normalizeClassification(term.label)
        )
    ) ?? fallbackTerms(currentClassifications);
  const tagTerms = taxonomy?.tags ??
    fallbackTerms(game.tags ?? []);
  const download = game.download;
  const requirements = game.requirements;
  const minimum =
    requirements?.minimum ??
    legacyMinimum(requirements);
  const recommended = requirements?.recommended;
  const coreAction =
    `/api/admin/content/games/${encodeURIComponent(slug)}`;
  const advancedAction = `${coreAction}/advanced`;
  const requirementsAction = `${coreAction}/requirements`;
  const performanceAction = `${coreAction}/performance`;
  const mediaAction = `${coreAction}/media`;
  const downloadAction = `${coreAction}/download`;

  return (
    <>
      <Link href="/admin/juegos" className={styles.backLink}>
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a juegos
      </Link>

      <AdminPageHeader
        eyebrow={<>JUEGO · REVISIÓN {item.revision}</>}
        title={game.title}
        description="Trabaja una sección a la vez. Guardar conserva el borrador y Publicar sigue siendo una acción separada."
        action={<div
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
          <Link
            href={`/admin/juegos/${encodeURIComponent(slug)}/publicacion`}
            className={styles.draftState}
          >
            {publicationLabel(
              publicationIdentity,
              item.status === "synced"
            )}
          </Link>
        </div>}
      />

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
              Título, descripción, clasificación principal y datos de presentación.
            </p>
          </div>

          <form
            className={styles.editorForm}
            method="post"
            action={coreAction}
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
              <span>Clasificación principal</span>
              <select
                name="category"
                defaultValue={game.category}
                required
              >
                {classificationTerms.map((term) => (
                  <option key={term.key} value={term.label}>
                    {term.label}{term.active ? "" : " · Inactiva"}
                  </option>
                ))}
              </select>
              <small>
                Todas las opciones provienen de la misma lista de Clasificaciones en Catálogos. La principal sólo define cuál se muestra primero en la ficha interna del juego.
              </small>
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

            <GameEditorFormActions
              note="Guardar no publica. La revisión anterior seguirá disponible en Historial."
              action={coreAction}
              continueTo="datos"
              saveLabel="Guardar ficha"
              continueLabel="Guardar y continuar a Datos"
            />
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
              Información para clasificaciones adicionales, etiquetas, plataformas y metadatos de la ficha.
            </p>
          </div>

          <form
            className={styles.editorForm}
            method="post"
            action={advancedAction}
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

            <GameTaxonomyMultiSelect
              name="genresText"
              label="Clasificaciones adicionales"
              terms={classificationTerms}
              initialValues={game.genres ?? []}
              maximum={20}
            />

            <GameTaxonomyMultiSelect
              name="tagsText"
              label="Etiquetas"
              terms={tagTerms}
              initialValues={game.tags ?? []}
              maximum={30}
            />

            <GamePlatformEditor
              initialPlatforms={game.platforms ?? []}
            />

            <GameEditorFormActions
              note="La clasificación principal y las adicionales salen de una única lista maestra; un mismo juego nunca se contará dos veces dentro de la misma clasificación."
              action={advancedAction}
              continueTo="requisitos"
              saveLabel="Guardar datos avanzados"
              continueLabel="Guardar y continuar a Requisitos"
            />
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
            action={requirementsAction}
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

            <GameEditorFormActions
              note="Si todos los campos quedan vacíos, el juego quedará sin requisitos editoriales configurados."
              action={requirementsAction}
              continueTo="rendimiento"
              saveLabel="Guardar requisitos"
              continueLabel="Guardar y continuar a Rendimiento"
            />
          </form>
        </section>
      )}

      {section === "rendimiento" && (
        <GamePerformanceEditor
          slug={slug}
          revision={item.revision}
          action={performanceAction}
          calibration={game.performance}
        />
      )}

      {section === "multimedia" && (
        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>MULTIMEDIA</span>
              <h2>Portada, hero y galería</h2>
            </div>
            <p>
              Sube una imagen de tu equipo o impórtala desde una URL HTTPS. El panel la normaliza a WebP seguro antes de guardarla.
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
            action={mediaAction}
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

            <GameEditorFormActions
              note="Se aceptan hasta 8 capturas sin duplicados y las rutas se validan antes de guardar."
              action={mediaAction}
              continueTo="descargas"
              saveLabel="Guardar multimedia"
              continueLabel="Guardar y continuar a Descargas"
            />
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
            action={downloadAction}
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

            <GameEditorFormActions
              note="Las direcciones se validan antes de guardarse y no se aceptan URLs HTTP inseguras."
              action={downloadAction}
              continueTo="publicacion"
              saveLabel="Guardar descargas"
              continueLabel="Guardar y revisar Publicación"
            />
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
