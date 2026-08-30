import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import HomePresentationEditor from "@/components/admin/HomePresentationEditor";
import PublicationPanel from "@/components/admin/PublicationPanel";
import {
  resolveHomeConfig,
} from "@/data/home-config";
import {
  getEditorialItem,
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  getHomeConfigPublicationState,
} from "@/lib/admin/publication-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const sections = [
  "curaduria",
  "presentacion",
  "publicacion",
  "historial",
] as const;

type HomeAdminSection = (typeof sections)[number];

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
    seccion?: string | string[];
  }>;
};

function asText(values: string[]) {
  return values.join("\n");
}

function resolveSection(
  value: string | string[] | undefined
): HomeAdminSection {
  const candidate = Array.isArray(value)
    ? value[0]
    : value;

  return sections.includes(candidate as HomeAdminSection)
    ? (candidate as HomeAdminSection)
    : "curaduria";
}

export default async function AdminHomeEditorPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [item, games, parameters] = await Promise.all([
    getEditorialItem("home_config", "home"),
    listEditorialItems("game"),
    searchParams,
  ]);

  if (!item) notFound();

  let publicationState = null;

  try {
    publicationState =
      await getHomeConfigPublicationState();
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de la portada."
    );
  }

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const section = resolveSection(parameters.seccion);
  const config = item.payload;
  const resolved = resolveHomeConfig(config);

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PORTADA · REVISIÓN {item.revision}</span>
          <h1>Inicio</h1>
          <p>
            Administra curaduría, orden, visibilidad y textos de Inicio sin mezclar contenido con la lógica de los componentes. Todo queda en borrador hasta publicar.
          </p>
        </div>
        <span className={styles.draftState}>
          {publicationState?.hasUnpublishedChanges
            ? "Cambios sin publicar"
            : item.status === "synced"
              ? "Sin cambios"
              : "Borrador guardado"}
        </span>
      </header>

      <EditorStateNotice state={state} />

      {section === "curaduria" && (
        <>
          <section className={styles.editorPanel}>
            <form
              className={styles.editorForm}
              method="post"
              action="/api/admin/content/home"
            >
              <input
                type="hidden"
                name="expectedRevision"
                value={item.revision}
              />

              <label className={styles.fieldWide}>
                <span>Hero · hasta 8 prioridades</span>
                <textarea
                  name="heroSlugsText"
                  defaultValue={asText(config.heroSlugs)}
                  rows={7}
                  maxLength={4000}
                />
              </label>

              <label className={styles.fieldWide}>
                <span>Populares · hasta 24 prioridades</span>
                <textarea
                  name="popularSlugsText"
                  defaultValue={asText(config.popularSlugs)}
                  rows={9}
                  maxLength={4000}
                />
              </label>

              <label className={styles.fieldWide}>
                <span>Bajos recursos · hasta 24 juegos</span>
                <textarea
                  name="lowSpecSlugsText"
                  defaultValue={asText(config.lowSpecSlugs)}
                  rows={9}
                  maxLength={4000}
                />
              </label>

              <label className={styles.fieldWide}>
                <span>Recomendados · hasta 24 prioridades</span>
                <textarea
                  name="recommendedSlugsText"
                  defaultValue={asText(config.recommendedSlugs)}
                  rows={9}
                  maxLength={4000}
                />
              </label>

              <div className={styles.formActions}>
                <p>
                  Usa un slug por línea o separados por coma. Esta ventana decide qué juegos priorizar; Presentación decide cómo ordenar y titular los bloques.
                </p>
                <button type="submit">
                  Guardar curaduría
                </button>
              </div>
            </form>
          </section>

          <section className={styles.tablePanel}>
            <div className={styles.tableSummary}>
              <strong>{games.length} juegos editoriales disponibles</strong>
              <span>Referencia de slugs</span>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Juego</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Clasificación principal</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.key}>
                      <th scope="row">{game.payload.title}</th>
                      <td>{game.key}</td>
                      <td>{game.payload.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {section === "presentacion" && (
        <HomePresentationEditor
          config={resolved}
          revision={item.revision}
        />
      )}

      {section === "publicacion" && (
        <section className={styles.editorPanel}>
          {publicationState ? (
            <PublicationPanel
              state={publicationState}
              requestState={state}
              publishAction="/api/admin/content/home/publish"
              restoreActionBase="/api/admin/content/home-publications"
            />
          ) : (
            <p>
              La infraestructura de publicación todavía no está disponible en esta base. Aplica las migraciones e importa el contenido editorial antes de publicar la portada.
            </p>
          )}
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
