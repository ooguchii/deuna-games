import {
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";

import {
  isAdminEnabled,
} from "@/lib/admin/database-config";

import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminLoginPage({
  searchParams,
}: LoginPageProps) {
  if (!isAdminEnabled()) notFound();

  const parameters = await searchParams;
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const message =
    state === "credenciales"
      ? "No fue posible iniciar la sesión. Revisa los datos o espera antes de intentarlo otra vez."
      : state === "solicitud"
        ? "La solicitud fue rechazada por seguridad. Vuelve a abrir esta página e inténtalo otra vez."
        : null;

  return (
    <main
      id="main-content"
      className={styles.loginPage}
    >
      <section
        className={styles.loginPanel}
        aria-labelledby="admin-login-title"
      >
        <div className={styles.loginBadge}>
          <ShieldCheck size={18} aria-hidden="true" />
          Acceso privado por VPN
        </div>

        <span className={styles.loginIcon}>
          <LockKeyhole size={30} aria-hidden="true" />
        </span>

        <h1 id="admin-login-title">
          Panel de administración
        </h1>
        <p>
          Esta zona requiere la VPN privada y la cuenta propietaria. No utiliza rastreadores ni servicios externos de autenticación.
        </p>

        {message && (
          <div
            className={styles.loginError}
            role="alert"
          >
            {message}
          </div>
        )}

        <form
          className={styles.loginForm}
          action="/api/admin/auth/login"
          method="post"
        >
          <label htmlFor="admin-username">
            Nombre de acceso
          </label>
          <input
            id="admin-username"
            name="username"
            type="text"
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9._-]+"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <label htmlFor="admin-password">
            Contraseña
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            maxLength={128}
            autoComplete="current-password"
            required
          />

          <button type="submit">
            Entrar de forma segura
          </button>
        </form>

        <small className={styles.loginFootnote}>
          La sesión dura como máximo el tiempo configurado en el servidor y puede revocarse desde PostgreSQL.
        </small>
      </section>
    </main>
  );
}
