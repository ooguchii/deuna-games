import {
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import {
  getAdminSecurityOverview,
} from "@/lib/admin/security-overview";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const eventLabels: Record<string, string> = {
  owner_created: "Cuenta propietaria creada",
  administrator_created: "Cuenta administrativa creada",
  login_succeeded: "Inicio de sesión correcto",
  login_failed: "Intento de acceso rechazado",
  login_blocked: "Acceso bloqueado temporalmente",
  logout: "Sesión cerrada",
};

export default async function AdminSecurityPage() {
  const session = await verifyAdminSession();
  const security =
    await getAdminSecurityOverview();

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>SEGURIDAD</span>
          <h1>Sesiones y accesos</h1>
          <p>
            Este registro contiene únicamente actividad de tu propia cuenta administrativa. No guarda IP, dispositivo, ubicación ni navegación de visitantes.
          </p>
        </div>
      </header>

      <section className={styles.securityGrid}>
        <article>
          <span><KeyRound size={22} aria-hidden="true" /></span>
          <div>
            <strong>{security.activeSessions}</strong>
            <p>Sesiones activas</p>
          </div>
        </article>
        <article>
          <span><ShieldCheck size={22} aria-hidden="true" /></span>
          <div>
            <strong>
              {new Intl.DateTimeFormat("es", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              }).format(session.expiresAt)} UTC
            </strong>
            <p>Vencimiento de esta sesión</p>
          </div>
        </article>
      </section>

      <section className={styles.eventPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>EVENTOS RECIENTES</span>
            <h2>Actividad administrativa</h2>
          </div>
        </div>

        {security.events.length > 0 ? (
          <ol className={styles.eventList}>
            {security.events.map((event) => (
              <li key={event.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>
                    {eventLabels[event.type] ??
                      "Evento administrativo"}
                  </strong>
                  <time dateTime={event.occurredAt.toISOString()}>
                    {new Intl.DateTimeFormat("es", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: "UTC",
                    }).format(event.occurredAt)}{" "}
                    UTC
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyState}>
            Todavía no hay eventos administrativos registrados.
          </p>
        )}
      </section>
    </>
  );
}
