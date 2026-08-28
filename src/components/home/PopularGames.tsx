import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import { popularGames } from "@/data/home";

import GameCard from "./GameCard";
import styles from "./PopularGames.module.css";

export default function PopularGames() {
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
        {popularGames.map((game) => (
          <GameCard
            key={game.slug}
            game={game}
          />
        ))}
      </CardCarousel>
    </section>
  );
}
