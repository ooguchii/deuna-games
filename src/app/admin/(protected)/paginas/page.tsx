import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  ExternalLink,
  Pencil,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  PUBLIC_PAGES_EDITORIAL_KEY,
} from "@/data/public-pages-config";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getAboutConfigPublicationState,
  getPublicPagesConfigPublicationState,
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

function PublicationStatus({
  pending,
}: {
  pending: boolean | undefined;
}) {
  return pending ? (
    <span className={styles.statusPending}>
      <CircleSlash2 size={14} aria-hidden="true" />
      Cambios sin publicar
    </span>
  ) : (
    <span className={styles.statusOk}>
      <CheckCircle2 size={14} aria-hidden="true" />
      Publicada
    </span>
  );
}

export default async function AdminPagesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [aboutItem, publicItem, parameters] = await Promise.all([
    getEditorialItem("about_config", "about"),
    getEditorialItem(
      "public_pages_config",
      PUBLIC_PAGES_EDITORIAL_KEY
    ),
    searchParams,
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  let aboutPublication = null;
  let publicPublication = null;

  try {
    [aboutPublication, publicPublication] = await Promise.all([
      aboutItem
        ? getAboutConfigPublicationState()
        : Promise.resolve(null),
      publicItem
        ? getPublicPagesConfigPublicationState()
        : Promise.resolve(null),
    ]);
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de una página editorial."
    );
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PÁGINAS EDITORIALES</span>
          <h1>Páginas</h1>
          <p>
            Administra contenido institucional y presentación de superficies públicas como borradores versionados. La estructura, navegación y lógica del producto permanecen protegidas.
          </p>
        </div>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>2 grupos editoriales</strong>
          <span>Edición estructurada y publicación explícita</span>
        </div>

        {!aboutItem && !publicItem ? (
          <p className={styles.emptyState}>
            Aplica las migraciones e importa el contenido editorial para habilitar las páginas.
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
                {aboutItem && (
                  <tr>
                    <th scope="row">
                      <strong>Quiénes somos</strong>
                      <span>/quienes-somos</span>
                    </th>
                    <td>
                      <PublicationStatus
                        pending={aboutPublication?.hasUnpublishedChanges}
                      />
                    </td>
                    <td>
                      {aboutPublication
                        ? `#${aboutPublication.publicationNumber}`
                        : "No disponible"}
                    </td>
                    <td>{aboutItem.revision}</td>
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
                )}

                {publicItem && (
                  <tr>
                    <th scope="row">
                      <strong>Presentación pública</strong>
                      <span>/juegos · /actualizaciones · /requisitos</span>
                    </th>
                    <td>
                      <PublicationStatus
                        pending={publicPublication?.hasUnpublishedChanges}
                      />
                    </td>
                    <td>
                      {publicPublication
                        ? `#${publicPublication.publicationNumber}`
                        : "No disponible"}
                    </td>
                    <td>{publicItem.revision}</td>
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
                          href="/admin/paginas/presentacion"
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Editar
                        </Link>
                        <Link
                          className={styles.tableAction}
                          href="/juegos"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                          Ver pública
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
