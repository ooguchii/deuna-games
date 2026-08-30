import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

import TaxonomyIcon from "@/components/taxonomy/TaxonomyIcon";
import type { HomeCopy } from "@/data/home-config";
import {
  getCategoryStats,
  normalizeCatalogText,
} from "@/lib/games/catalog";
import {
  getPublicTaxonomyPresentation,
} from "@/lib/games/public-taxonomy";
import {
  resolveTaxonomyVisual,
} from "@/lib/games/taxonomy-presentation";
import type { Game } from "@/types/game";
import type {
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

import styles from "./FeaturedCategories.module.css";

function orderedClassifications(
  games: readonly Game[],
  terms: readonly GameTaxonomyTerm[]
) {
  const counts = new Map(getCategoryStats(games));
  const byNormalizedLabel = new Map(
    [...counts.keys()].map((label) => [
      normalizeCatalogText(label),
      label,
    ])
  );
  const used = new Set<string>();
  const ordered: Array<{
    term: GameTaxonomyTerm;
    label: string;
    count: number;
  }> = [];

  terms.forEach((term) => {
    const label = byNormalizedLabel.get(
      normalizeCatalogText(term.label)
    );
    if (!label) return;

    used.add(label);
    ordered.push({
      term,
      label,
      count: counts.get(label) ?? 0,
    });
  });

  [...counts.entries()]
    .filter(([label]) => !used.has(label))
    .sort(([left], [right]) =>
      left.localeCompare(right, "es", {
        sensitivity: "base",
      })
    )
    .forEach(([label, count]) => {
      ordered.push({
        term: {
          key:
            normalizeCatalogText(label)
              .replace(/[^a-z0-9]+/g, "-") ||
            "clasificacion",
          label,
          active: true,
        },
        label,
        count,
      });
    });

  return ordered;
}

export default async function FeaturedCategories({
  games,
  copy,
}: {
  games: Game[];
  copy: HomeCopy["classifications"];
}) {
  const taxonomy = await getPublicTaxonomyPresentation();
  const classifications = orderedClassifications(
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
