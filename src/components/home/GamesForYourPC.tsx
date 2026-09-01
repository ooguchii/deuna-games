import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Cpu,
  Monitor,
  Star,
} from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import { lowSpecGames } from "@/data/home";

import styles from "./GamesForYourPC.module.css";

const catalogOptions = [
  {
    title: "Bajos recursos",
    subtitle: "Juegos pensados para equipos modestos",
    href: "/juegos?equipo=lowSpec",
    icon: Cpu,
  },
  {
    title: "Con requisitos cargados",
    subtitle: "Compara memoria, gráficos y sistema",
    href: "/requisitos",
    icon: Monitor,
  },
  {
    title: "Mejor puntuados",
    subtitle: "Ordenados por valoración",
    href: "/juegos?orden=rating",
    icon: Star,
  },
  {
    title: "Añadidos recientemente",
    subtitle: "Los últimos títulos incorporados",
    href: "/juegos?estado=recent&orden=recientes",
    icon: CalendarDays,
  },
] as const;

export default function GamesForYourPC() {
  return (
    <section className={styles.section}>
      <div className={styles.mainHeader}>
        <div>
          <span className={styles.eyebrow}>
            SEGÚN TU EQUIPO
          </span>

          <h2>
            Encuentra juegos para{" "}
            <strong>tu PC</strong>
          </h2>

          <p>
            Explora el catálogo usando los requisitos disponibles,
            el rendimiento esperado y filtros que ya funcionan hoy.
          </p>
        </div>

        <Link href="/requisitos">
          Probar recomendador
          <ChevronRight size={18} />
        </Link>
      </div>

      <div className={styles.hardwareGrid}>
        {catalogOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Link
              href={option.href}
              className={styles.hardwareCard}
              key={option.href}
            >
              <div className={styles.hardwareIcon}>
                <Icon size={25} />
              </div>

              <div>
                <h3>{option.title}</h3>
                <p>{option.subtitle}</p>
              </div>

              <ChevronRight
                size={19}
                className={styles.hardwareArrow}
              />
            </Link>
          );
        })}
      </div>

      <div className={styles.divider} />

      <div className={styles.gamesHeader}>
        <h3>
          RECOMENDADOS PARA EQUIPOS{" "}
          <span>DE BAJOS RECURSOS</span>
        </h3>

        <Link href="/juegos/bajos-recursos">
          Ver todos
          <ChevronRight size={18} />
        </Link>
      </div>

      <CardCarousel
        ariaLabel="Juegos para equipos de bajos recursos"
        itemsDesktop={5}
      >
        {lowSpecGames.map((game) => (
          <UniversalGameCard
            key={game.slug}
            game={game}
            variant="lowSpec"
          />
        ))}
      </CardCarousel>
    </section>
  );
}
