import {
  CheckCircle2,
  CircleSlash2,
} from "lucide-react";

import { games } from "@/data/games";
import {
  resolveGameDownload,
} from "@/lib/games/download";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  await verifyAdminSession();

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>CATÁLOGO</span>
          <h1>Juegos</h1>
          <p>
            Revisión protegida del catálogo activo. La edición se habilitará cuando el contenido se migre a PostgreSQL con historial de cambios.
          </p>
        </div>
      </header>

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>{games.length} juegos</strong>
          <span>Modo de sólo lectura</span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Juego</th>
                <th scope="col">Categoría</th>
                <th scope="col">Versión</th>
                <th scope="col">Requisitos</th>
                <th scope="col">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => {
                const downloadable = Boolean(
                  resolveGameDownload(game)
                );

                return (
                  <tr key={game.slug}>
                    <th scope="row">
                      <strong>{game.title}</strong>
                      <span>{game.slug}</span>
                    </th>
                    <td>{game.category}</td>
                    <td>{game.version ?? "Sin versión"}</td>
                    <td>
                      {game.requirements ? (
                        <span className={styles.statusOk}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Cargados
                        </span>
                      ) : (
                        <span className={styles.statusPending}>
                          <CircleSlash2 size={14} aria-hidden="true" />
                          Pendientes
                        </span>
                      )}
                    </td>
                    <td>
                      {downloadable ? (
                        <span className={styles.statusOk}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Disponible
                        </span>
                      ) : (
                        <span className={styles.statusPending}>
                          <CircleSlash2 size={14} aria-hidden="true" />
                          No configurada
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
