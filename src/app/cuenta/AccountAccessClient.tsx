"use client";

import {
  CheckCircle2,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  useState,
} from "react";

import styles from "./account.module.css";

type Mode = "login" | "register" | "recover";

type ApiResult = {
  ok?: boolean;
  error?: string;
  recoveryCodes?: string[];
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
  const data = (await response.json()) as ApiResult;

  return { response, data };
}

function errorMessage(error: string | undefined) {
  switch (error) {
    case "usuario_ocupado":
      return "Ese nombre de usuario ya está en uso.";
    case "credenciales":
      return "El usuario o la contraseña no coinciden.";
    case "recuperacion":
      return "El usuario o el código de recuperación no coinciden.";
    case "datos":
      return "Revisa los datos ingresados. La contraseña debe tener al menos 12 caracteres.";
    case "servicio":
      return "El servicio de cuentas no está disponible en este momento.";
    default:
      return "No se pudo completar la solicitud.";
  }
}

export default function AccountAccessClient() {
  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const { data } = await postForm("/api/account/login", {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });

      if (!data.ok) {
        setMessage(errorMessage(data.error));
        return;
      }

      window.location.assign("/cuenta");
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const { data } = await postForm("/api/account/register", {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        bio: String(form.get("bio") ?? ""),
      });

      if (!data.ok || !data.recoveryCodes?.length) {
        setMessage(errorMessage(data.error));
        return;
      }

      setRecoveryCodes(data.recoveryCodes);
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const { data } = await postForm("/api/account/recover", {
        username: String(form.get("username") ?? ""),
        recoveryCode: String(form.get("recoveryCode") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
      });

      if (!data.ok || !data.recoveryCodes?.length) {
        setMessage(errorMessage(data.error));
        return;
      }

      setRecoveryCodes(data.recoveryCodes);
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes) return;

    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (recoveryCodes) {
    return (
      <section className={styles.card} aria-labelledby="recovery-codes-title">
        <div className={styles.recoveryPanel}>
          <ShieldCheck size={30} aria-hidden="true" />
          <h2 id="recovery-codes-title">Guarda tus códigos de recuperación</h2>
          <p>
            Se muestran una sola vez. Permiten recuperar tu cuenta sin correo, teléfono ni preguntas personales. DeUna sólo guarda el hash de cada código.
          </p>

          <div className={styles.codeGrid} aria-label="Códigos de recuperación">
            {recoveryCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>

          <div className={styles.recoveryActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={copyRecoveryCodes}
            >
              {copied ? <CheckCircle2 size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
              {copied ? "Copiados" : "Copiar códigos"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => window.location.assign("/cuenta")}
            >
              Ya los guardé
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-label="Acceso a cuenta">
      <div className={styles.tabs} role="tablist" aria-label="Opciones de cuenta">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          data-active={mode === "login"}
          onClick={() => {
            setMode("login");
            setMessage(null);
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          data-active={mode === "register"}
          onClick={() => {
            setMode("register");
            setMessage(null);
          }}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "recover"}
          data-active={mode === "recover"}
          onClick={() => {
            setMode("recover");
            setMessage(null);
          }}
        >
          Recuperar
        </button>
      </div>

      {mode === "login" && (
        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.formHeader}>
            <h2>Tu cuenta DeUna</h2>
            <p>Entra sólo con usuario y contraseña. No necesitas correo.</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="account-login-username">Usuario</label>
            <input
              id="account-login-username"
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={40}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="account-login-password">Contraseña</label>
            <input
              id="account-login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </div>

          {message && <p className={styles.message} role="status">{message}</p>}

          <button className={styles.primaryButton} type="submit" disabled={pending}>
            <LockKeyhole size={17} aria-hidden="true" />
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      )}

      {mode === "register" && (
        <form className={styles.form} onSubmit={handleRegister}>
          <div className={styles.formHeader}>
            <h2>Crea una cuenta mínima</h2>
            <p>Sólo usuario y contraseña son obligatorios. El resto lo decides tú.</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="account-register-username">Usuario</label>
            <input
              id="account-register-username"
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9._-]+"
              required
            />
            <p className={styles.hint}>3 a 40 caracteres: letras, números, punto, guion o guion bajo.</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="account-register-password">Contraseña</label>
            <input
              id="account-register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <p className={styles.hint}>Mínimo 12 caracteres. Una frase larga también sirve.</p>
          </div>

          <div className={styles.optionalGroup}>
            <div className={styles.optionalHeading}>
              <strong>Datos de perfil</strong>
              <span>Todo opcional</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="account-display-name">
                Nombre visible <span className={styles.optional}>Opcional</span>
              </label>
              <input
                id="account-display-name"
                name="displayName"
                maxLength={80}
                autoComplete="nickname"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="account-email">
                Correo <span className={styles.optional}>Opcional</span>
              </label>
              <input
                id="account-email"
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
              />
              <p className={styles.hint}>Si lo agregas, se guarda cifrado. No es necesario para entrar ni recuperar la cuenta.</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="account-bio">
                Bio <span className={styles.optional}>Opcional</span>
              </label>
              <textarea id="account-bio" name="bio" maxLength={500} />
            </div>
          </div>

          {message && <p className={styles.message} role="status">{message}</p>}

          <button className={styles.primaryButton} type="submit" disabled={pending}>
            <UserRound size={17} aria-hidden="true" />
            {pending ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
      )}

      {mode === "recover" && (
        <form className={styles.form} onSubmit={handleRecover}>
          <div className={styles.formHeader}>
            <h2>Recupera sin correo</h2>
            <p>Usa uno de los códigos que recibiste al crear la cuenta.</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="account-recovery-username">Usuario</label>
            <input
              id="account-recovery-username"
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={40}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="account-recovery-code">Código de recuperación</label>
            <input
              id="account-recovery-code"
              name="recoveryCode"
              autoComplete="off"
              minLength={12}
              maxLength={32}
              placeholder="XXXX-XXXX-XXXX"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="account-new-password">Nueva contraseña</label>
            <input
              id="account-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </div>

          {message && <p className={styles.message} role="status">{message}</p>}

          <button className={styles.primaryButton} type="submit" disabled={pending}>
            <KeyRound size={17} aria-hidden="true" />
            {pending ? "Recuperando..." : "Recuperar cuenta"}
          </button>
        </form>
      )}
    </section>
  );
}
