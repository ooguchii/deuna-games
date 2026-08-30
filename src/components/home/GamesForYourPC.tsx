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
import type { HomeCopy } from "@/data/home-config";
import type { Game } from "@/types/game";

import styles from "./GamesForYourPC.module.css";

const catalogOptions = [
  {
    href: "/juegos?equipo=lowSpec",
    icon: Cpu,
  },
  {
    href: "/requisitos",
    icon: Monitor,
  },
  {
    href: "/juegos?orden=rating",
    icon: Star,
  },
  {
    href: "/juegos?estado=recent&orden=recientes",
    icon: CalendarDays,
  },
] as const;

export default function GamesForYourPC({
  games,
  copy,
}: {
  games: Game[];
  copy: HomeCopy["lowSpec"];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.mainHeader}>
        <div>
          <span className={styles.eyebrow}>
            {copy.eyebrow}
          </span>

          <h2>
            {copy.title}{" "}
            <strong>{copy.highlight}</strong>
          </h2>

          <p>{copy.text}</p>
        </div>

        <Link href="/requisitos">
          {copy.cta}
          <ChevronRight size={18} />
        </Link>
      </div>

      <div className={styles.hardwareGrid}>
        {catalogOptions.map((option, index) => {
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
                <h3>{copy.optionTitles[index]}</h3>
                <p>{copy.optionSubtitles[index]}</p>
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
          {copy.listTitle}{" "}
          <span>{copy.listHighlight}</span>
        </h3>

        <Link href="/juegos/bajos-recursos">
          {copy.listLinkLabel}
          <ChevronRight size={18} />
        </Link>
      </div>

      <CardCarousel
        ariaLabel={`${copy.listTitle} ${copy.listHighlight}`}
        itemsDesktop={5}
      >
        {games.map((game) => (
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
