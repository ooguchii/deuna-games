import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  Pencil,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  listEditorialItems,
} from "@/lib/admin/content-service";
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
  const [items, parameters] = await Promise.all([
    listEditorialItems("game"),
    searchParams,
  ]);
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
            Los cambios se guardan como borradores versionados en PostgreSQL. No alteran todavía la web pública.
          </p>
        </div>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>{items.length} juegos importados</strong>
          <span>Edición en borrador</span>
        </div>

        {items.length === 0 ? (
          <p className={styles.emptyState}>
            Ejecuta `npm run admin:import-content` desde la copia privada del VPS.
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
                  <th scope="col">Revisión</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
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
                      {item.status === "synced" ? (
                        <span className={styles.statusOk}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Sin cambios
                        </span>
                      ) : (
                        <span className={styles.statusPending}>
                          <CircleSlash2 size={14} aria-hidden="true" />
                          Borrador
                        </span>
                      )}
                    </td>
                    <td>{item.revision}</td>
                    <td>
                      <Link
                        className={styles.tableAction}
                        href={`/admin/juegos/${encodeURIComponent(item.key)}`}
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
