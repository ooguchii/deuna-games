import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

import TaxonomyIcon from "@/components/taxonomy/TaxonomyIcon";
import {
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

function categoryCounts(games: readonly Game[]) {
  const counts = new Map<string, number>();

  for (const game of games) {
    counts.set(
      game.category,
      (counts.get(game.category) ?? 0) + 1
    );
  }

  return counts;
}

function orderedCategories(
  games: readonly Game[],
  terms: readonly GameTaxonomyTerm[]
) {
  const counts = categoryCounts(games);
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
          key: normalizeCatalogText(label).replace(/[^a-z0-9]+/g, "-") || "categoria",
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
}: {
  games: Game[];
}) {
  const taxonomy = await getPublicTaxonomyPresentation();
  const categories = orderedCategories(
    games,
    taxonomy.categories
  );

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
        {categories.map(({ term, label, count }, index) => {
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
        })}
      </div>
    </section>
  );
}
