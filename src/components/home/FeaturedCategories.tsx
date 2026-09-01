import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

import TaxonomyIcon from "@/components/taxonomy/TaxonomyIcon";
import type { HomeCopy } from "@/data/home-config";
import {
  getOrderedClassificationStats,
} from "@/lib/games/catalog";
import {
  getPublicTaxonomyPresentation,
} from "@/lib/games/public-taxonomy";
import {
  resolveTaxonomyVisual,
} from "@/lib/games/taxonomy-presentation";
import type { Game } from "@/types/game";

import styles from "./FeaturedCategories.module.css";

export default async function FeaturedCategories({
  games,
  copy,
}: {
  games: Game[];
  copy: HomeCopy["classifications"];
}) {
  const taxonomy = await getPublicTaxonomyPresentation();
  const classifications = getOrderedClassificationStats(
    games,
    taxonomy.classifications
  );

  if (classifications.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>
          {copy.title} <span>{copy.highlight}</span>
        </h2>

        <Link href="/juegos">
          {copy.linkLabel}
          <ChevronRight size={19} />
        </Link>
      </div>

      <div className={styles.categories}>
        {classifications.map(
          ({ term, label, count }, index) => {
            const visual = resolveTaxonomyVisual(term, index);

            return (
              <Link
                key={term.key}
                href={`/juegos?categoria=${encodeURIComponent(label)}`}
                className={styles.category}
                style={
                  {
                    "--taxonomy-accent": visual.color,
                  } as CSSProperties
                }
              >
                <div className={styles.iconBox}>
                  <TaxonomyIcon
                    icon={visual.icon}
                    asset={visual.iconAsset}
                    size={40}
                    strokeWidth={1.8}
                  />
                </div>

                <h3>{label}</h3>

                <p>
                  {count} {count === 1 ? "juego" : "juegos"}
                </p>
              </Link>
            );
          }
        )}
      </div>
    </section>
  );
}
