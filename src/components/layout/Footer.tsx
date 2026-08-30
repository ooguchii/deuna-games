import Link from "next/link";

import { Gamepad2 } from "lucide-react";

import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

import styles from "./Footer.module.css";

export default async function Footer() {
  const config = await getPublicSiteConfig();
  const year = new Date().getUTCFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandColumn}>
          <Link
            href="/"
            className={styles.brand}
            aria-label={`${config.name} - Inicio`}
          >
            <div className={styles.logo}>
              <Gamepad2 size={25} aria-hidden="true" />
            </div>

            <strong>{config.name}</strong>
          </Link>

          <p>{config.description}</p>
        </div>

        <div className={styles.column}>
          <h3>Juegos</h3>

          <Link href="/juegos">Todos los juegos</Link>
          <Link href="/juegos/populares">Populares</Link>
          <Link href="/juegos/nuevos">Añadidos recientemente</Link>
          <Link href="/juegos/bajos-recursos">Bajos recursos</Link>
        </div>

        <div className={styles.column}>
          <h3>Explorar</h3>

          <Link href="/requisitos">
            Por requisitos
          </Link>
          <Link href="/juegos?orden=rating">
            Mejor puntuados
          </Link>
          <Link href="/actualizaciones">Actualizaciones</Link>
        </div>

        <div className={styles.column}>
          <h3>{config.shortName}</h3>

          <Link href="/quienes-somos">Quiénes somos</Link>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© {year} {config.name}</span>

        <span>{config.footerTagline}</span>
      </div>
    </footer>
  );
}
