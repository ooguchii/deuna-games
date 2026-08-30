import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { HomeCopy } from "@/data/home-config";
import type { Game } from "@/types/game";

import styles from "./RecentlyAdded.module.css";

export default function RecentlyAdded({
  games,
  copy,
}: {
  games: Game[];
  copy: HomeCopy["recent"];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          {copy.title} <span>{copy.highlight}</span>
        </h2>

        <Link href="/juegos/nuevos">
          {copy.linkLabel}
          <ChevronRight size={18} />
        </Link>
      </div>

      <CardCarousel
        ariaLabel={`${copy.title} ${copy.highlight}`}
        itemsDesktop={5}
      >
        {games.map((game) => (
          <UniversalGameCard
            key={game.slug}
            game={game}
            variant="recent"
          />
        ))}
      </CardCarousel>
    </section>
  );
}
