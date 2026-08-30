import Link from "next/link";
import {
  ArrowRight,
  Database,
  Gamepad2,
  LayoutTemplate,
  RefreshCcw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { games } from "@/data/games";
import { gameUpdates } from "@/data/updates";
import {
  getAdminSecurityOverview,
} from "@/lib/admin/security-overview";
import {
  getEditorialOverview,
} from "@/lib/admin/content-service";
import {
  getPublicationOverview,
  type RecentPublication,
} from "@/lib/admin/publication-overview";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

function publicationPath(
  type: RecentPublication["type"],
  key: string
) {
  if (type === "game") {
    return `/admin/juegos/${encodeURIComponent(key)}/vista-previa`;
  }

  if (type === "game_update") {
    return `/admin/actualizaciones/${encodeURIComponent(key)}`;
  }

  if (type === "home_config") {
    return "/admin/portada";
  }

  return "/admin/configuracion";
}

function publicationTypeLabel(
  type: RecentPublication["type"]
) {
  if (type === "game") return "Juego";
  if (type === "game_update") return "Actualización";
  if (type === "home_config") return "Portada";
  return "Configuración";
}

function formatPublicationDate(value: Date) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

export default async function AdminDashboardPage() {
  await verifyAdminSession();
  const [security, editorial, publication] =
    await Promise.all([
      getAdminSecurityOverview(),
      getEditorialOverview(),
      getPublicationOverview(),
    ]);
  const publicGames = publication.available
    ? publication.games
    : games.length;
  const publicUpdates = publication.available
    ? publication.updates
    : gameUpdates.length;
  const pending = publication.available
    ? publication.pending
    : editorial.modified;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PANEL PRIVADO</span>
          <h1>Resumen de administración</h1>
          <p>
            Área editorial segura: borradores versionados, publicaciones separadas, recuperación e historial auditable en PostgreSQL.
          </p>
        </div>

        <span className={styles.secureState}>
          <ShieldCheck size={17} aria-hidden="true" />
          Acceso protegido
        </span>
      </header>

      <section
        className={styles.metricGrid}
        aria-label="Resumen del contenido"
      >
        <article>
          <span><Gamepad2 size={20} aria-hidden="true" /></span>
          <strong>{publicGames}</strong>
          <p>Juegos con snapshot público</p>
        </article>
        <article>
          <span><RefreshCcw size={20} aria-hidden="true" /></span>
          <strong>{publicUpdates}</strong>
          <p>Actualizaciones con snapshot</p>
        </article>
        <article>
          <span><Database size={20} aria-hidden="true" /></span>
          <strong>{pending}</strong>
          <p>Cambios sin publicar</p>
        </article>
        <article>
          <span><ShieldCheck size={20} aria-hidden="true" /></span>
          <strong>{security.activeSessions}</strong>
          <p>Sesiones activas</p>
        </article>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>CONTROL DE CONTENIDO</span>
            <h2>Estado actual del catálogo</h2>
          </div>
          <p>
            {publication.available
              ? "Guardar conserva un borrador privado. Publicar crea un snapshot auditable y restaurable."
              : "La publicación explícita quedará disponible al aplicar la migración editorial pendiente."}
          </p>
        </div>

        <div className={styles.moduleGrid}>
          <Link href="/admin/juegos">
            <Gamepad2 size={23} aria-hidden="true" />
            <div>
              <strong>Revisar juegos</strong>
              <span>
                Títulos, categorías, versiones, requisitos, descargas y publicación.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <Link href="/admin/actualizaciones">
            <RefreshCcw size={23} aria-hidden="true" />
            <div>
              <strong>Revisar actualizaciones</strong>
              <span>
                Versiones, fechas, publicación y relación con cada juego.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <Link href="/admin/portada">
            <LayoutTemplate size={23} aria-hidden="true" />
            <div>
              <strong>Organizar portada</strong>
              <span>
                Prioridades de Hero, Populares, Bajos recursos y Recomendados con publicación versionada.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <Link href="/admin/seguridad">
            <ShieldCheck size={23} aria-hidden="true" />
            <div>
              <strong>Comprobar seguridad</strong>
              <span>
                Sesiones y eventos administrativos sin rastreo de visitantes.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <Link href="/admin/configuracion">
            <Settings2 size={23} aria-hidden="true" />
            <div>
              <strong>Configuración editorial</strong>
              <span>
                Identidad pública versionada, publicable y restaurable sin exponer secretos ni opciones del servidor.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {publication.available && publication.recent.length > 0 && (
        <section className={styles.tablePanel}>
          <div className={styles.tableSummary}>
            <strong>Publicaciones recientes</strong>
            <span>{publication.recent.length} movimientos</span>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Contenido</th>
                  <th scope="col">Publicación</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Fecha UTC</th>
                </tr>
              </thead>
              <tbody>
                {publication.recent.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">
                      <Link
                        href={publicationPath(entry.type, entry.key)}
                      >
                        <strong>{entry.key}</strong>
                        <span>
                          {publicationTypeLabel(entry.type)}
                        </span>
                      </Link>
                    </th>
                    <td>#{entry.publicationNumber}</td>
                    <td>
                      <span
                        className={
                          entry.action === "rollback"
                            ? styles.statusPending
                            : styles.statusOk
                        }
                      >
                        {entry.action === "rollback"
                          ? "Restauración"
                          : "Publicación"}
                      </span>
                    </td>
                    <td>{formatPublicationDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
