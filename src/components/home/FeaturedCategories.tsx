import Link from "next/link";

import {
  Box,
  Car,
  ChevronRight,
  Compass,
  Puzzle,
  Shield,
  Sword,
  Zap,
} from "lucide-react";

import {
  normalizeCatalogText,
} from "@/lib/games/catalog";
import type { Game } from "@/types/game";

import styles from "./FeaturedCategories.module.css";

const tones = [
  "red",
  "purple",
  "violet",
  "blue",
  "green",
  "orange",
] as const;

function CategoryIcon({
  category,
}: {
  category: string;
}) {
  const value = normalizeCatalogText(category);

  if (value.includes("accion")) return Zap;
  if (value.includes("aventura")) return Compass;
  if (value.includes("carrera")) return Car;
  if (value.includes("puzzle")) return Puzzle;
  if (value.includes("rpg")) return Sword;
  if (value.includes("sandbox")) return Box;

  return Shield;
}

function categoryStats(games: readonly Game[]) {
  const counts = new Map<string, number>();

  for (const game of games) {
    counts.set(
      game.category,
      (counts.get(game.category) ?? 0) + 1
    );
  }

  return [...counts.entries()].sort(
    ([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount ||
      leftName.localeCompare(rightName, "es", {
        sensitivity: "base",
      })
  );
}

export default function FeaturedCategories({
  games,
}: {
  games: Game[];
}) {
  const categories = categoryStats(games);

  if (categories.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          CATEGORÍAS <span>DESTACADAS</span>
        </h2>

        <Link href="/juegos">
          Ver todo el catálogo
          <ChevronRight size={19} />
        </Link>
      </div>

      <div className={styles.categories}>
        {categories.map(([name, count], index) => {
          const Icon = CategoryIcon({ category: name });
          const tone = tones[index % tones.length];

          return (
            <Link
              key={name}
              href={`/juegos?categoria=${encodeURIComponent(name)}`}
              className={styles.category}
            >
              <div
                className={`${styles.iconBox} ${styles[tone]}`}
              >
                <Icon size={40} strokeWidth={1.8} />
              </div>

              <h3>{name}</h3>

              <p className={styles[tone]}>
                {count} {count === 1 ? "juego" : "juegos"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
