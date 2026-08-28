import Link from "next/link";

import { Gamepad2 } from "lucide-react";

import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandColumn}>
          <Link href="/" className={styles.brand}>
            <div className={styles.logo}>
              <Gamepad2 size={25} />
            </div>

            <strong>
              DeUna <span>Games</span>
            </strong>
          </Link>

          <p>
            Descubre juegos, comprobá sus requisitos
            y mantenete al día con sus versiones.
          </p>
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

          <Link href="/juegos?equipo=requirements">
            Por requisitos
          </Link>
          <Link href="/juegos?orden=rating">
            Mejor puntuados
          </Link>
          <Link href="/actualizaciones">Actualizaciones</Link>
        </div>

        <div className={styles.column}>
          <h3>DeUna Games</h3>

          <Link href="/quienes-somos">Quiénes somos</Link>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© 2026 DeUna Games</span>

        <span>Hecho para encontrar tu próximo juego.</span>
      </div>
    </footer>
  );
}
