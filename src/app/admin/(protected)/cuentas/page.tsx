import {
  KeyRound,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

import {
  listAdminAccounts,
} from "@/lib/admin/account-service";
import {
  verifyAdminOwnerSession,
} from "@/lib/admin/session";

import adminStyles from "../../admin.module.css";
import styles from "./accounts.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string;
  }>;
};

const statusMessages: Record<string, { text: string; error?: boolean }> = {
  creado: { text: "Administrador creado. Ya puede iniciar sesión en el panel." },
  activado: { text: "Administrador reactivado." },
  desactivado: { text: "Administrador desactivado y sus sesiones fueron revocadas." },
  clave: { text: "Contraseña restablecida y sesiones anteriores revocadas." },
  usuario: { text: "Ese nombre de usuario ya está en uso.", error: true },
  datos: { text: "Revisa los datos enviados y la política de contraseña.", error: true },
  solicitud: { text: "La solicitud no superó las validaciones de seguridad.", error: true },
  no_encontrado: { text: "La cuenta administrativa indicada no existe.", error: true },
};

function formatDate(value: Date | null) {
  if (!value) return "Nunca";

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

export default async function AdminAccountsPage({ searchParams }: PageProps) {
  await verifyAdminOwnerSession();
  const [accounts, params] = await Promise.all([
    listAdminAccounts(),
    searchParams,
  ]);
  const message = params.estado ? statusMessages[params.estado] : undefined;

  return (
    <>
      <header className={adminStyles.pageHeader}>
        <div>
          <span>ACCESOS</span>
          <h1>Cuentas administrativas</h1>
          <p>
            El Owner conserva el control de accesos. Los administradores pueden trabajar en el panel editorial, pero no crear cuentas, cambiar roles ni modificar al propietario.
          </p>
        </div>
      </header>

      {message && (
        <p
          className={`${styles.notice} ${message.error ? styles.errorNotice : ""}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="create-admin-title">
          <div className={styles.panelHeader}>
            <span>NUEVO ACCESO</span>
            <h2 id="create-admin-title">Crear administrador</h2>
            <p>
              Sólo se requiere usuario y contraseña. El nombre visible es opcional y no se solicita correo, teléfono ni información personal.
            </p>
          </div>

          <form
            className={styles.createForm}
            action="/api/admin/accounts/create"
            method="post"
          >
            <div className={styles.field}>
              <label htmlFor="new-admin-username">Usuario</label>
              <input
                id="new-admin-username"
                name="username"
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9._-]+"
                autoComplete="off"
                required
              />
              <small>3 a 40 caracteres: letras, números, punto, guion o guion bajo.</small>
            </div>

            <div className={styles.field}>
              <label htmlFor="new-admin-display-name">
                Nombre visible <span className={styles.optional}>Opcional</span>
              </label>
              <input
                id="new-admin-display-name"
                name="displayName"
                maxLength={80}
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="new-admin-password">Contraseña inicial</label>
              <input
                id="new-admin-password"
                name="password"
                type="password"
                minLength={16}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <small>Mínimo 16 caracteres, con letra, número y símbolo.</small>
            </div>

            <button type="submit" className={styles.primaryButton}>
              <UserPlus size={17} aria-hidden="true" />
              Crear administrador
            </button>
          </form>
        </section>

        <section className={styles.panel} aria-labelledby="admin-accounts-title">
          <div className={styles.panelHeader}>
            <span>EQUIPO</span>
            <h2 id="admin-accounts-title">Accesos existentes</h2>
            <p>
              Desactivar una cuenta revoca sus sesiones inmediatamente. Las cuentas no se borran para preservar la autoría del historial editorial.
            </p>
          </div>

          <ol className={styles.accountList}>
            {accounts.map((account) => (
              <li className={styles.accountItem} key={account.id}>
                <div className={styles.accountIdentity}>
                  <div className={styles.accountTitle}>
                    <strong>
                      {account.displayName || account.username}
                    </strong>
                    <span className={styles.badge}>
                      {account.role === "owner" ? "Owner" : "Administrador"}
                    </span>
                    <span className={account.active ? styles.activeBadge : styles.inactiveBadge}>
                      {account.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className={styles.accountMeta}>
                    <span>@{account.username}</span>
                    <span>Último acceso: {formatDate(account.lastLoginAt)} UTC</span>
                    <span>Creada: {formatDate(account.createdAt)} UTC</span>
                  </div>
                </div>

                {account.role === "owner" ? (
                  <div className={styles.ownerNote}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    Cuenta protegida
                  </div>
                ) : (
                  <div className={styles.accountActions}>
                    <form action="/api/admin/accounts/status" method="post">
                      <input type="hidden" name="userId" value={account.id} />
                      <input type="hidden" name="active" value={account.active ? "false" : "true"} />
                      <button
                        type="submit"
                        className={account.active ? styles.dangerButton : styles.secondaryButton}
                      >
                        <UsersRound size={16} aria-hidden="true" />
                        {account.active ? "Desactivar" : "Reactivar"}
                      </button>
                    </form>

                    <form
                      className={styles.passwordForm}
                      action="/api/admin/accounts/password"
                      method="post"
                    >
                      <input type="hidden" name="userId" value={account.id} />
                      <input
                        type="password"
                        name="password"
                        minLength={16}
                        maxLength={128}
                        autoComplete="new-password"
                        aria-label={`Nueva contraseña para ${account.username}`}
                        placeholder="Nueva contraseña"
                        required
                      />
                      <button type="submit" className={styles.secondaryButton}>
                        <KeyRound size={16} aria-hidden="true" />
                        Restablecer
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
