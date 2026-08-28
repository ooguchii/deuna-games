import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import { recentGames } from "@/data/home";

import RecentGameCard from "./RecentGameCard";
import styles from "./RecentlyAdded.module.css";

export default function RecentlyAdded() {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          AÑADIDOS <span>RECIENTEMENTE</span>
        </h2>

        <Link href="/juegos/nuevos">
          Ver todos los añadidos
          <ChevronRight size={18} />
        </Link>
      </div>

      <CardCarousel
        ariaLabel="Juegos añadidos recientemente"
        itemsDesktop={5}
      >
        {recentGames.map((game) => (
          <RecentGameCard
            key={game.slug}
            game={game}
          />
        ))}
      </CardCarousel>
    </section>
  );
}
