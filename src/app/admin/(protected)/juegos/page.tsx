import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  Eye,
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

export default async function AdminGamesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [items, publicationStates, parameters] =
    await Promise.all([
      listEditorialItems("game"),
      listPublicationStates("game"),
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
          <span>CATÁLOGO EDITORIAL</span>
          <h1>Juegos</h1>
          <p>
            Guardar conserva un borrador versionado. La web pública sólo cambia cuando se crea un snapshot mediante Publicar.
          </p>
        </div>
        <Link
          href="/admin/juegos/nuevo"
          className={styles.tableAction}
        >
          <Plus size={15} aria-hidden="true" />
          Nuevo juego
        </Link>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>{items.length} juegos editoriales</strong>
          <span>
            {publicationStates
              ? "Publicación controlada"
              : "Edición en borrador"}
          </span>
        </div>

        {items.length === 0 ? (
          <p className={styles.emptyState}>
            Importa el catálogo fuente o crea un juego nuevo como borrador privado.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Juego</th>
                  <th scope="col">Categoría</th>
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
                        <strong>{item.payload.title}</strong>
                        <span>{item.key}</span>
                      </th>
                      <td>{item.payload.category}</td>
                      <td>
                        {item.payload.version ?? "Sin versión"}
                      </td>
                      <td>
                        {pending ? (
                          <span className={styles.statusPending}>
                            <CircleSlash2 size={14} aria-hidden="true" />
                            Sin publicar
                          </span>
                        ) : (
                          <span className={styles.statusOk}>
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Publicado
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Link
                            className={styles.tableAction}
                            href={`/admin/juegos/${encodeURIComponent(item.key)}`}
                          >
                            <Pencil size={13} aria-hidden="true" />
                            Editar
                          </Link>
                          <Link
                            className={styles.tableAction}
                            href={`/admin/juegos/${encodeURIComponent(item.key)}/vista-previa`}
                          >
                            <Eye size={13} aria-hidden="true" />
                            Vista previa
                          </Link>
                        </div>
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
