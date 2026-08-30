import Link from "next/link";

import {
  ChevronRight,
  Cpu,
  Gamepad2,
  Monitor,
} from "lucide-react";

import type { HomeCopy } from "@/data/home-config";

import styles from "./GameFinderSection.module.css";

const featureIcons = [Cpu, Monitor, Gamepad2] as const;

export default function GameFinderSection({
  copy,
}: {
  copy: HomeCopy["finder"];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.glow} />

      <div className={styles.content}>
        <div className={styles.icon}>
          <Gamepad2 size={35} strokeWidth={1.8} />
        </div>

        <div className={styles.text}>
          <span className={styles.eyebrow}>
            {copy.eyebrow}
          </span>

          <h2>
            {copy.title} <span>{copy.highlight}</span>
          </h2>

          <p>{copy.text}</p>

          <div className={styles.features}>
            {copy.features.map((feature, index) => {
              const Icon = featureIcons[index];

              return (
                <span key={`${index}-${feature}`}>
                  <Icon size={16} />
                  {feature}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <Link
        href="/requisitos"
        className={styles.button}
      >
        {copy.cta}
        <ChevronRight size={21} />
      </Link>
    </section>
  );
}
