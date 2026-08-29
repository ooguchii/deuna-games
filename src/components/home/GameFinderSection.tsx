import Link from "next/link";

import {
  ChevronRight,
  Cpu,
  Gamepad2,
  Monitor,
} from "lucide-react";

import styles from "./GameFinderSection.module.css";

export default function GameFinderSection() {
  return (
    <section className={styles.section}>
      <div className={styles.glow} />

      <div className={styles.content}>
        <div className={styles.icon}>
          <Gamepad2 size={35} strokeWidth={1.8} />
        </div>

        <div className={styles.text}>
          <span className={styles.eyebrow}>
            COMPATIBILIDAD DE JUEGOS
          </span>

          <h2>
            ¿Buscas algo que <span>funcione en tu PC?</span>
          </h2>

          <p>
            Detectamos lo que tu navegador permita identificar y,
            si falta algún dato, completas CPU, GPU y RAM para obtener
            FPS orientativos según resolución y calidad.
          </p>

          <div className={styles.features}>
            <span>
              <Cpu size={16} />
              Detección local
            </span>

            <span>
              <Monitor size={16} />
              FPS orientativos
            </span>

            <span>
              <Gamepad2 size={16} />
              Configuración manual
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/requisitos"
        className={styles.button}
      >
        Descubrir qué puedo jugar

        <ChevronRight size={21} />
      </Link>
    </section>
  );
}
