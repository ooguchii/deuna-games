import type { Metadata } from "next";
import {
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  getAccountProfile,
} from "@/lib/accounts/service";
import {
  readAccountSession,
} from "@/lib/accounts/session";

import AccountAccessClient from "./AccountAccessClient";
import AccountProfileClient from "./AccountProfileClient";
import styles from "./account.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuenta",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountPage() {
  const session = await readAccountSession();

  if (session) {
    const profile = await getAccountProfile(session.userId);

    if (profile) {
      return (
        <main className={styles.page}>
          <div className={styles.shell}>
            <AccountProfileClient
              profile={{
                ...profile,
                createdAt: profile.createdAt.toISOString(),
              }}
            />
          </div>
        </main>
      );
    }
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.hero}`}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}>
            <ShieldCheck size={16} aria-hidden="true" />
            CUENTA PRIVADA
          </span>
          <h1>Una cuenta sin entregar tu identidad.</h1>
          <p>
            DeUna sólo necesita un nombre de usuario y una contraseña. Puedes completar un perfil si quieres, pero no necesitas correo, teléfono ni datos reales para usar tu cuenta.
          </p>

          <ul className={styles.privacyList}>
            <li>
              <UserRound size={18} aria-hidden="true" />
              Usuario y contraseña son los únicos datos obligatorios.
            </li>
            <li>
              <LockKeyhole size={18} aria-hidden="true" />
              El correo es opcional y, si lo agregas, se guarda cifrado.
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              No asociamos IP, ubicación, dispositivo ni historial de navegación a tu cuenta.
            </li>
          </ul>
        </section>

        <AccountAccessClient />
      </div>
    </main>
  );
}
