import Link from "next/link";

import {
  ChevronRight,
  Cpu,
  Gauge,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";

import type { HomeCopy } from "@/data/home-config";

import styles from "./GameFinderSection.module.css";

const featureIcons = [Cpu, Gauge, SlidersHorizontal] as const;

export default function GameFinderSection({
  copy,
}: {
  copy: HomeCopy["finder"];
}) {
  return (
    <section
      className={styles.section}
      aria-labelledby="home-game-finder-title"
    >
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.icon} aria-hidden="true">
          <Monitor size={34} strokeWidth={1.8} />
          <Cpu className={styles.iconBadge} size={16} strokeWidth={2} />
        </div>

        <div className={styles.text}>
          <span className={styles.eyebrow}>
            {copy.eyebrow}
          </span>

          <h2 id="home-game-finder-title">
            {copy.title} <span>{copy.highlight}</span>
          </h2>

          <p>{copy.text}</p>

          <ul className={styles.features} aria-label="Cómo funciona el recomendador">
            {copy.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Cpu;

              return (
                <li key={`${index}-${feature}`}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Link
        href="/requisitos"
        className={styles.button}
        data-brand-action="true"
      >
        <span>{copy.cta}</span>
        <ChevronRight size={21} aria-hidden="true" />
      </Link>
    </section>
  );
}
