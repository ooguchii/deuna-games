import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { Game } from "@/types/game";

import styles from "./RecommendedGames.module.css";

export default function RecommendedGames({
  games,
}: {
  games: Game[];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            PARA DESCUBRIR
          </span>

          <h2>
            JUEGOS <strong>RECOMENDADOS</strong>
          </h2>

          <p>
            Una selección de juegos que creemos que vale la pena conocer.
          </p>
        </div>

        <Link href="/juegos">
          Ver catálogo
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <CardCarousel
        ariaLabel="Juegos recomendados"
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
