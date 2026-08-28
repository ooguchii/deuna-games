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
            ¿Buscás algo que <span>funcione en tu PC?</span>
          </h2>

          <p>
            Explora los títulos que ya tienen requisitos cargados
            y compara memoria, gráficos y sistema antes de elegir.
          </p>

          <div className={styles.features}>
            <span>
              <Cpu size={16} />
              Requisitos visibles
            </span>

            <span>
              <Monitor size={16} />
              Compatibilidad
            </span>

            <span>
              <Gamepad2 size={16} />
              Catálogo filtrable
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/juegos?equipo=requirements"
        className={styles.button}
      >
        Ver juegos con requisitos

        <ChevronRight size={21} />
      </Link>
    </section>
  );
}
