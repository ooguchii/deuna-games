import Link from "next/link";
import {
  ArrowRight,
  Database,
  Gamepad2,
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
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await verifyAdminSession();
  const [security, editorial] = await Promise.all([
    getAdminSecurityOverview(),
    getEditorialOverview(),
  ]);

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>PANEL PRIVADO</span>
          <h1>Resumen de administración</h1>
          <p>
            Área editorial segura: borradores versionados en PostgreSQL, recuperación y control de sesiones.
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
          <strong>{games.length}</strong>
          <p>Juegos públicos</p>
        </article>
        <article>
          <span><RefreshCcw size={20} aria-hidden="true" /></span>
          <strong>{gameUpdates.length}</strong>
          <p>Actualizaciones públicas</p>
        </article>
        <article>
          <span><Database size={20} aria-hidden="true" /></span>
          <strong>{editorial.modified}</strong>
          <p>Borradores modificados</p>
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
            Los cambios permanecen privados hasta implementar una publicación explícita y auditada.
          </p>
        </div>

        <div className={styles.moduleGrid}>
          <Link href="/admin/juegos">
            <Gamepad2 size={23} aria-hidden="true" />
            <div>
              <strong>Revisar juegos</strong>
              <span>
                Títulos, categorías, versiones, requisitos y disponibilidad.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <Link href="/admin/actualizaciones">
            <RefreshCcw size={23} aria-hidden="true" />
            <div>
              <strong>Revisar actualizaciones</strong>
              <span>
                Versiones, fechas y relación con cada juego.
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
                Identidad pública versionada, sin exponer secretos ni opciones del servidor.
              </span>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
