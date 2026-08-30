import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  ExternalLink,
  Pencil,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getAboutConfigPublicationState,
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

export default async function AdminPagesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [item, parameters] = await Promise.all([
    getEditorialItem("about_config", "about"),
    searchParams,
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  let publicationState = null;

  if (item) {
    try {
      publicationState =
        await getAboutConfigPublicationState();
    } catch {
      console.error(
        "No se pudo leer el estado de publicación de Quiénes somos."
      );
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PÁGINAS EDITORIALES</span>
          <h1>Páginas</h1>
          <p>
            Administra textos institucionales como contenido versionado. La estructura visual permanece protegida y la web pública sólo cambia al publicar.
          </p>
        </div>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>1 página institucional</strong>
          <span>Edición estructurada</span>
        </div>

        {!item ? (
          <p className={styles.emptyState}>
            Aplica las migraciones e importa el contenido editorial para habilitar la página institucional.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Página</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Publicación</th>
                  <th scope="col">Revisión</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <strong>Quiénes somos</strong>
                    <span>/quienes-somos</span>
                  </th>
                  <td>
                    {publicationState?.hasUnpublishedChanges ? (
                      <span className={styles.statusPending}>
                        <CircleSlash2 size={14} aria-hidden="true" />
                        Cambios sin publicar
                      </span>
                    ) : (
                      <span className={styles.statusOk}>
                        <CheckCircle2 size={14} aria-hidden="true" />
                        Publicada
                      </span>
                    )}
                  </td>
                  <td>
                    {publicationState
                      ? `#${publicationState.publicationNumber}`
                      : "No disponible"}
                  </td>
                  <td>{item.revision}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        className={styles.tableAction}
                        href="/admin/paginas/quienes-somos"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Editar
                      </Link>
                      <Link
                        className={styles.tableAction}
                        href="/quienes-somos"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        Ver pública
                      </Link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
