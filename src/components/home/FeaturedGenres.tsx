import Link from "next/link";
import {
  ChevronRight,
  Tags,
} from "lucide-react";

import type { Game } from "@/types/game";

import styles from "./FeaturedGenres.module.css";

function genreStats(games: readonly Game[]) {
  const counts = new Map<string, number>();

  for (const game of games) {
    for (const genre of new Set(game.genres ?? [])) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort(
    ([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount ||
      leftName.localeCompare(rightName, "es", {
        sensitivity: "base",
      })
  );
}

export default function FeaturedGenres({
  games,
}: {
  games: Game[];
}) {
  const genres = genreStats(games);

  if (genres.length === 0) return null;

  return (
    <section
      className={styles.section}
      aria-labelledby="home-genres-title"
    >
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Tags size={15} aria-hidden="true" />
            CLASIFICACIÓN PUBLICADA
          </span>
          <h2 id="home-genres-title">
            Explora por <span>género</span>
          </h2>
        </div>

        <Link href="/juegos">
          Ver todos los juegos
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.genres}>
        {genres.map(([genre, count]) => (
          <Link
            key={genre}
            href={`/juegos?q=${encodeURIComponent(genre)}&buscarEn=category`}
            className={styles.genre}
          >
            <strong>{genre}</strong>
            <span>
              {count} {count === 1 ? "juego" : "juegos"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
