import { gameUpdates } from "@/data/updates";
import {
  getGameBySlug,
} from "@/data/games";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminUpdatesPage() {
  await verifyAdminSession();

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>VERSIONES</span>
          <h1>Actualizaciones</h1>
          <p>
            Vista privada de versiones publicadas y sus relaciones con el catálogo.
          </p>
        </div>
      </header>

      <section className={styles.tablePanel}>
        <div className={styles.tableSummary}>
          <strong>
            {gameUpdates.length} actualizaciones
          </strong>
          <span>Modo de sólo lectura</span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Juego</th>
                <th scope="col">Versión</th>
                <th scope="col">Tipo</th>
                <th scope="col">Fecha UTC</th>
                <th scope="col">Destacada</th>
              </tr>
            </thead>
            <tbody>
              {gameUpdates.map((update) => (
                <tr key={update.id}>
                  <th scope="row">
                    <strong>
                      {getGameBySlug(update.gameSlug)?.title ??
                        update.gameSlug}
                    </strong>
                    <span>{update.id}</span>
                  </th>
                  <td>{update.version}</td>
                  <td>{update.type}</td>
                  <td>
                    {new Intl.DateTimeFormat("es", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(update.publishedAt))}
                  </td>
                  <td>{update.featured ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
