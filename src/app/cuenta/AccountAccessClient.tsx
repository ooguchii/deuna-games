"use client";

import {
  CheckCircle2,
  Copy,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useState,
} from "react";

import styles from "./account.module.css";

type Mode = "login" | "register" | "recover";

type ApiResult = {
  ok?: boolean;
  error?: string;
  recoveryCodes?: string[];
};

const allAccountModes: readonly Mode[] = [
  "login",
  "register",
  "recover",
];

const closedRegistrationModes: readonly Mode[] = [
  "login",
  "recover",
];

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
    case "registro_cerrado":
      return "La creación de nuevas cuentas todavía no está habilitada.";
    case "servicio":
      return "El servicio de cuentas no está disponible en este momento.";
    default:
      return "No se pudo completar la solicitud.";
  }
}

export default function AccountAccessClient({
  registrationEnabled,
}: {
  registrationEnabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const accountModes = registrationEnabled
    ? allAccountModes
    : closedRegistrationModes;

  function selectMode(nextMode: Mode) {
    if (nextMode === "register" && !registrationEnabled) return;
    setMode(nextMode);
    setMessage(null);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextIndex: number | null = null;
    const currentIndex = accountModes.indexOf(mode);

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % accountModes.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + accountModes.length) % accountModes.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = accountModes.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextMode = accountModes[nextIndex]!;
    selectMode(nextMode);
    document.getElementById(`account-tab-${nextMode}`)?.focus();
  }

  function openProfile() {
    router.replace("/cuenta");
    router.refresh();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const data = await postForm("/api/account/login", {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });

      if (!data.ok) {
        setMessage(errorMessage(data.error));
        return;
      }

      openProfile();
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
      const data = await postForm("/api/account/register", {
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
      const data = await postForm("/api/account/recover", {
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
              onClick={openProfile}
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
          id="account-tab-login"
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          aria-controls="account-panel-login"
          tabIndex={mode === "login" ? 0 : -1}
          data-active={mode === "login"}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectMode("login")}
        >
          Entrar
        </button>
        {registrationEnabled && (
          <button
            id="account-tab-register"
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            aria-controls="account-panel-register"
            tabIndex={mode === "register" ? 0 : -1}
            data-active={mode === "register"}
            onKeyDown={handleTabKeyDown}
            onClick={() => selectMode("register")}
          >
            Crear cuenta
          </button>
        )}
        <button
          id="account-tab-recover"
          type="button"
          role="tab"
          aria-selected={mode === "recover"}
          aria-controls="account-panel-recover"
          tabIndex={mode === "recover" ? 0 : -1}
          data-active={mode === "recover"}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectMode("recover")}
        >
          Recuperar
        </button>
      </div>

      {!registrationEnabled && (
        <p className={styles.message} role="status">
          La creación de nuevas cuentas está cerrada durante la preparación del lanzamiento público. Las cuentas existentes pueden entrar y recuperarse normalmente.
        </p>
      )}

      {mode === "login" && (
        <form
          id="account-panel-login"
          className={styles.form}
          role="tabpanel"
          aria-labelledby="account-tab-login"
          onSubmit={handleLogin}
        >
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

      {mode === "register" && registrationEnabled && (
        <form
          id="account-panel-register"
          className={styles.form}
          role="tabpanel"
          aria-labelledby="account-tab-register"
          onSubmit={handleRegister}
        >
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

          <p className={styles.hint}>
            Antes de crearla puedes revisar qué datos guarda Mi DeUna y cuáles no en <Link href="/privacidad">Privacidad</Link>.
          </p>

          {message && <p className={styles.message} role="status">{message}</p>}

          <button className={styles.primaryButton} type="submit" disabled={pending}>
            <UserRound size={17} aria-hidden="true" />
            {pending ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
      )}

      {mode === "recover" && (
        <form
          id="account-panel-recover"
          className={styles.form}
          role="tabpanel"
          aria-labelledby="account-tab-recover"
          onSubmit={handleRecover}
        >
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
