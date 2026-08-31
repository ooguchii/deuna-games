"use client";

import {
  CheckCircle2,
  LogOut,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

import styles from "./account.module.css";

type Profile = {
  username: string;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  createdAt: string;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
};

async function postForm(
  url: string,
  fields: Record<string, string>
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams(fields).toString(),
    credentials: "same-origin",
  });

  return (await response.json()) as ApiResult;
}

export default function AccountProfileClient({
  profile,
}: {
  profile: Profile;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const data = await postForm("/api/account/profile", {
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        bio: String(form.get("bio") ?? ""),
      });

      if (!data.ok) {
        setMessage(
          data.error === "sesion"
            ? "Tu sesión venció. Vuelve a entrar."
            : "No se pudieron guardar los cambios."
        );
        return;
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    setMessage(null);

    try {
      const data = await postForm("/api/account/logout", {
        intent: "logout",
      });

      if (!data.ok) {
        setMessage("No se pudo cerrar la sesión.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.profileLayout}>
      <section className={styles.profilePanel} aria-labelledby="account-profile-title">
        <div className={styles.profileHeader}>
          <div>
            <span className={styles.eyebrow}>TU CUENTA</span>
            <h1 id="account-profile-title">Perfil privado</h1>
            <p>
              Tu usuario es la única identidad obligatoria. Puedes dejar vacíos todos los campos opcionales.
            </p>
          </div>
          <span className={styles.usernameBadge}>@{profile.username}</span>
        </div>

        <form className={styles.profileForm} onSubmit={handleSave}>
          <div className={styles.field}>
            <label htmlFor="profile-display-name">
              Nombre visible <span className={styles.optional}>Opcional</span>
            </label>
            <input
              id="profile-display-name"
              name="displayName"
              defaultValue={profile.displayName ?? ""}
              maxLength={80}
              autoComplete="nickname"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-email">
              Correo <span className={styles.optional}>Opcional</span>
            </label>
            <input
              id="profile-email"
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
              maxLength={254}
              autoComplete="email"
            />
            <p className={styles.hint}>
              Se cifra antes de guardarlo. Puedes eliminarlo dejando este campo vacío.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-bio">
              Bio <span className={styles.optional}>Opcional</span>
            </label>
            <textarea
              id="profile-bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={500}
            />
          </div>

          {message && <p className={styles.message} role="status">{message}</p>}

          <div className={styles.profileActions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleLogout}
              disabled={pending}
            >
              <LogOut size={17} aria-hidden="true" />
              Cerrar sesión
            </button>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={pending}
            >
              {saved ? <CheckCircle2 size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
              {saved ? "Guardado" : pending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>

      <aside className={styles.privacyPanel} aria-labelledby="account-privacy-title">
        <ShieldCheck size={28} aria-hidden="true" />
        <h2 id="account-privacy-title">Privacidad por defecto</h2>
        <p>
          La cuenta está diseñada para funcionar sin convertir tus datos personales en requisito de acceso.
        </p>
        <ul>
          <li><ShieldCheck size={15} aria-hidden="true" /> Sin IP ni historial de navegación asociado a tu cuenta.</li>
          <li><ShieldCheck size={15} aria-hidden="true" /> Sin teléfono, nombre legal, domicilio o ubicación.</li>
          <li><ShieldCheck size={15} aria-hidden="true" /> Correo opcional y cifrado cuando decides agregarlo.</li>
          <li><ShieldCheck size={15} aria-hidden="true" /> Sesión mediante token aleatorio; PostgreSQL guarda sólo su hash.</li>
        </ul>
      </aside>
    </div>
  );
}
