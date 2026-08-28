import Link from "next/link";

import {
  Box,
  Car,
  ChevronRight,
  Compass,
  Puzzle,
  Shield,
  Zap,
} from "lucide-react";

import { games } from "@/data/games";

import styles from "./FeaturedCategories.module.css";

const categories = [
  {
    name: "Acción",
    icon: Zap,
    tone: "red",
  },
  {
    name: "Aventura",
    icon: Compass,
    tone: "purple",
  },
  {
    name: "RPG",
    icon: Shield,
    tone: "violet",
  },
  {
    name: "Carreras",
    icon: Car,
    tone: "blue",
  },
  {
    name: "Puzzle",
    icon: Puzzle,
    tone: "green",
  },
  {
    name: "Sandbox",
    icon: Box,
    tone: "orange",
  },
] as const;

export default function FeaturedCategories() {
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
        {categories.map((category) => {
          const Icon = category.icon;
          const count = games.filter(
            (game) => game.category === category.name
          ).length;

          return (
            <Link
              key={category.name}
              href={`/juegos?categoria=${encodeURIComponent(
                category.name
              )}`}
              className={styles.category}
            >
              <div
                className={`${styles.iconBox} ${styles[category.tone]}`}
              >
                <Icon size={40} strokeWidth={1.8} />
              </div>

              <h3>{category.name}</h3>

              <p className={styles[category.tone]}>
                {count} {count === 1 ? "juego" : "juegos"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
