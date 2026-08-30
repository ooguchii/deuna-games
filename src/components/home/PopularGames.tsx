import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { Game } from "@/types/game";

import styles from "./PopularGames.module.css";

export default function PopularGames({
  games,
}: {
  games: Game[];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          JUEGOS <span>POPULARES</span>
        </h2>

        <Link href="/juegos">
          Ver todos
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <CardCarousel
        ariaLabel="Juegos populares"
        itemsDesktop={5}
      >
        {games.map((game) => (
          <UniversalGameCard
            key={game.slug}
            game={game}
            variant="standard"
          />
        ))}
      </CardCarousel>
    </section>
  );
}
