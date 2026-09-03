import type { Metadata } from "next";
import Link from "next/link";
import {
  Coins,
  Database,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacidad en Mi DeUna",
  description:
    "Cómo están diseñadas las cuentas, la personalización y DeUna Rewards para usar la menor cantidad de datos posible.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PrivacyPage() {
  const config = await getPublicSiteConfig();

  return (
    <>
      <Header />

      <main id="main-content" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Migas de pan">
          <Link href="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Privacidad</span>
        </nav>

        <section className={styles.hero} aria-labelledby="privacy-title">
          <span className={styles.eyebrow}>
            <ShieldCheck size={17} aria-hidden="true" />
            PRIVACIDAD POR DISEÑO
          </span>
          <h1 id="privacy-title">Mi DeUna intenta saber sólo lo necesario.</h1>
          <p>
            Este aviso describe el funcionamiento técnico actual de las cuentas,
            la personalización y DeUna Rewards en {config.name}. Se publica para
            que las decisiones de privacidad sean visibles y comprobables, no
            para esconderlas en texto difícil de leer.
          </p>
          <div className={styles.prelaunchNotice}>
            <strong>Aviso técnico previo al lanzamiento público</strong>
            <span>
              Antes de habilitar cuentas al público deben completarse la
              identificación jurídica del responsable, un canal de contacto
              para privacidad, la jurisdicción aplicable y el plazo concreto de
              retención de copias de seguridad. Esos datos no se inventan desde
              el código y todavía no forman parte de este documento.
            </span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="stored-title">
          <div className={styles.sectionHeading}>
            <Database size={23} aria-hidden="true" />
            <div>
              <span>QUÉ SE GUARDA</span>
              <h2 id="stored-title">Datos mínimos y elecciones explícitas</h2>
            </div>
          </div>

          <div className={styles.cardGrid}>
            <article>
              <UserRound size={22} aria-hidden="true" />
              <h3>Cuenta</h3>
              <p>
                Para crearla sólo se exige un nombre de usuario y una
                contraseña. PostgreSQL guarda el hash de la contraseña, no la
                contraseña en texto plano.
              </p>
            </article>

            <article>
              <KeyRound size={22} aria-hidden="true" />
              <h3>Datos opcionales</h3>
              <p>
                Nombre visible y biografía son opcionales. El correo también es
                opcional y, si decides agregarlo, se cifra con AES-256-GCM antes
                de persistirse.
              </p>
            </article>

            <article>
              <Database size={22} aria-hidden="true" />
              <h3>Mis juegos y Mi PC</h3>
              <p>
                Sólo se guardan las preferencias de juegos que eliges y los
                componentes de PC que seleccionas expresamente: CPU, GPU, RAM y
                modo de memoria.
              </p>
            </article>

            <article>
              <Coins size={22} aria-hidden="true" />
              <h3>DeUna Rewards</h3>
              <p>
                Guarda XP, saldo de créditos, racha, fecha del último reclamo y
                un ledger mínimo de premios con tipo, clave, cantidades y fecha.
                No es un historial de navegación.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="not-stored-title">
          <div className={styles.sectionHeading}>
            <EyeOff size={23} aria-hidden="true" />
            <div>
              <span>QUÉ NO USA MI DEUNA</span>
              <h2 id="not-stored-title">La recompensa no depende de vigilarte</h2>
            </div>
          </div>

          <div className={styles.exclusionPanel}>
            <p>
              El sistema de cuentas, personalización y Rewards no persiste IP,
              ubicación, user-agent, huella de dispositivo, historial de
              navegación, páginas vistas, clics, impresiones ni tiempo de
              pantalla para personalizar o acreditar recompensas.
            </p>
            <p>
              Los hitos de Rewards se derivan únicamente de información que ya
              decidiste guardar —por ejemplo, un juego favorito o Mi PC— y del
              reclamo explícito de una recompensa.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="security-title">
          <div className={styles.sectionHeading}>
            <ShieldCheck size={23} aria-hidden="true" />
            <div>
              <span>SEGURIDAD</span>
              <h2 id="security-title">Tokens y recuperación sin texto plano</h2>
            </div>
          </div>

          <div className={styles.copyPanel}>
            <p>
              Las sesiones públicas usan tokens aleatorios, pero PostgreSQL sólo
              guarda su hash. La cookie de sesión es HttpOnly y SameSite=Lax.
              Los códigos de recuperación se muestran al usuario cuando se
              generan y la base conserva únicamente sus hashes.
            </p>
            <p>
              Las cuentas públicas y administrativas viven en límites separados
              y una cuenta pública no se transforma en una cuenta de
              administración.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="delete-title">
          <div className={styles.sectionHeading}>
            <Trash2 size={23} aria-hidden="true" />
            <div>
              <span>CONTROL DEL USUARIO</span>
              <h2 id="delete-title">Eliminar la cuenta borra los datos activos</h2>
            </div>
          </div>

          <div className={styles.copyPanel}>
            <p>
              Desde Mi DeUna puedes eliminar físicamente tu cuenta confirmando
              con la contraseña actual. La eliminación en PostgreSQL arrastra
              sesiones, códigos de recuperación, preferencias, Mi PC, perfil de
              Rewards y ledger de recompensas mediante borrado en cascada.
            </p>
            <p>
              Las copias de seguridad cifradas son un sistema distinto de la
              base activa y pueden conservar una copia hasta su rotación. El
              plazo exacto de retención debe definirse y publicarse antes del
              lanzamiento público.
            </p>
          </div>
        </section>

        <section className={styles.rewardsRules} aria-labelledby="credits-title">
          <div>
            <Coins size={24} aria-hidden="true" />
            <div>
              <span>REWARDS</span>
              <h2 id="credits-title">XP y créditos no son dinero</h2>
            </div>
          </div>
          <p>
            El XP representa progreso y no se gasta. Los Créditos DeUna son un
            saldo interno sin valor monetario ni conversión a efectivo. En la
            implementación actual no vencen por inactividad mientras la cuenta
            exista y todavía no hay un sistema de canje habilitado. Las
            recompensas son deterministas: no existen cajas, sorteos ni premios
            aleatorios en Rewards.
          </p>
        </section>

        <section className={styles.actions}>
          <div>
            <strong>¿Quieres revisar o borrar lo que guardaste?</strong>
            <span>El control está dentro de tu propia cuenta.</span>
          </div>
          <Link href="/cuenta">Ir a Mi DeUna</Link>
        </section>
      </main>

      <Footer />
    </>
  );
}
