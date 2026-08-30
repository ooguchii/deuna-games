import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  Pencil,
  Plus,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  listPublicationStates,
} from "@/lib/admin/publication-overview";
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

export default async function AdminUpdatesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [items, publicationStates, parameters] =
    await Promise.all([
      listEditorialItems("game_update"),
      listPublicationStates("game_update"),
      searchParams,
    ]);
  const publicationByKey = new Map(
    (publicationStates ?? []).map((item) => [
      item.key,
      item,
    ])
  );
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>VERSIONES EDITORIALES</span>
          <h1>Actualizaciones</h1>
          <p>
            Cada edición queda como borrador recuperable y sólo llega a la web pública mediante una publicación explícita.
          </p>
        </div>
        <Link
          href="/admin/actualizaciones/nueva"
          className={styles.tableAction}
        >
          <Plus size={15} aria-hidden="true" />
          Nueva actualización
        </Link>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>
            {items.length} actualizaciones editoriales
          </strong>
          <span>
            {publicationStates
              ? "Publicación controlada"
              : "Edición en borrador"}
          </span>
        </div>

        {items.length === 0 ? (
          <p className={styles.emptyState}>
            Importa las actualizaciones fuente o crea una nueva como borrador privado.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Identidad</th>
                  <th scope="col">Juego</th>
                  <th scope="col">Versión</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Publicación</th>
                  <th scope="col">Revisión</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const publication =
                    publicationByKey.get(item.key);
                  const pending = publication
                    ? publication.hasUnpublishedChanges
                    : item.status !== "synced";

                  return (
                    <tr key={item.key}>
                      <th scope="row">
                        <strong>{item.payload.id}</strong>
                        <span>{item.payload.type}</span>
                      </th>
                      <td>{item.payload.gameSlug}</td>
                      <td>{item.payload.version}</td>
                      <td>
                        {pending ? (
                          <span className={styles.statusPending}>
                            <CircleSlash2 size={14} aria-hidden="true" />
                            Sin publicar
                          </span>
                        ) : (
                          <span className={styles.statusOk}>
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Publicada
                          </span>
                        )}
                      </td>
                      <td>
                        {publication
                          ? `#${publication.publicationNumber}`
                          : "No disponible"}
                      </td>
                      <td>{item.revision}</td>
                      <td>
                        <Link
                          className={styles.tableAction}
                          href={`/admin/actualizaciones/${encodeURIComponent(item.key)}`}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
