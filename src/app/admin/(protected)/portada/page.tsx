import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import PublicationPanel from "@/components/admin/PublicationPanel";
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

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

function asText(values: string[]) {
  return values.join("\n");
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
  const config = item.payload;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PORTADA · REVISIÓN {item.revision}</span>
          <h1>Curaduría de Inicio</h1>
          <p>
            Define qué juegos tienen prioridad en Hero, Populares, Bajos recursos y Recomendados. Los slugs ocultos o inexistentes se omiten de forma segura y la portada completa huecos cuando corresponde.
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
              Usa un slug por línea o separados por coma. Guardar no modifica la portada pública hasta pulsar Publicar borrador.
            </p>
            <button type="submit">
              Guardar borrador
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
                <th scope="col">Categoría</th>
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

      <EditorialHistory
        revisions={item.revisions}
        currentRevision={item.revision}
      />
    </>
  );
}
