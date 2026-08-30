import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { HomeCopy } from "@/data/home-config";
import type { Game } from "@/types/game";

import styles from "./RecommendedGames.module.css";

export default function RecommendedGames({
  games,
  copy,
}: {
  games: Game[];
  copy: HomeCopy["recommended"];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            {copy.eyebrow}
          </span>

          <h2>
            {copy.title} <strong>{copy.highlight}</strong>
          </h2>

          <p>{copy.text}</p>
        </div>

        <Link href="/juegos">
          {copy.linkLabel}
          <ChevronRight size={18} aria-hidden="true" />
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
            variant="standard"
          />
        ))}
      </CardCarousel>
    </section>
  );
}
