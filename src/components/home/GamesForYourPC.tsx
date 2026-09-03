import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  Cpu,
  Monitor,
  Sparkles,
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
  personalized = false,
  reasons = {},
}: {
  games: Game[];
  copy: HomeCopy["lowSpec"];
  personalized?: boolean;
  reasons?: Record<string, string[]>;
}) {
  const explanation = games
    .flatMap((game) => reasons[game.slug] ?? [])
    .filter((reason, index, values) =>
      values.indexOf(reason) === index
    )
    .slice(0, 2);

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

          {personalized && (
            <div className={styles.personalizedNote}>
              <Sparkles size={14} aria-hidden="true" />
              <span>
                Ordenado con la PC que guardaste en Mi DeUna
                {explanation[0] ? ` · ${explanation.join(" · ")}` : ""}
              </span>
            </div>
          )}
        </div>

        <Link href="/requisitos">
          {copy.cta}
          <ChevronRight size={18} aria-hidden="true" />
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
                <Icon size={25} aria-hidden="true" />
              </div>

              <div>
                <h3>{copy.optionTitles[index]}</h3>
                <p>{copy.optionSubtitles[index]}</p>
              </div>

              <ChevronRight
                size={19}
                className={styles.hardwareArrow}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>

      <div className={styles.divider} />

      <div className={styles.gamesHeader}>
        <h3>
          {personalized ? "Mejor resultado" : copy.listTitle}{" "}
          <span>{personalized ? "en tu PC" : copy.listHighlight}</span>
        </h3>

        <Link href={personalized ? "/cuenta#mi-pc" : "/juegos/bajos-recursos"}>
          {personalized ? "Ver Mi PC" : copy.listLinkLabel}
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <CardCarousel
        ariaLabel={personalized ? "Juegos mejor estimados para tu PC" : `${copy.listTitle} ${copy.listHighlight}`}
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
