import Link from "next/link";

import { ChevronRight } from "lucide-react";

import CardCarousel from "@/components/ui/CardCarousel";
import touchStyles from "@/components/ui/TouchTarget.module.css";
import UniversalGameCard from "@/components/ui/UniversalGameCard";
import type { HomeCopy } from "@/data/home-config";
import type { GameCardPresentationMode } from "@/lib/media/game-card-presentation";
import type { Game } from "@/types/game";

import styles from "./PopularGames.module.css";

export default function PopularGames({
  games,
  copy,
  presentation,
}: {
  games: Game[];
  copy: HomeCopy["popular"];
  presentation: GameCardPresentationMode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          {copy.title} <span>{copy.highlight}</span>
        </h2>

        <Link href="/juegos" className={touchStyles.hitArea}>
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
            presentation={presentation}
          />
        ))}
      </CardCarousel>
    </section>
  );
}
