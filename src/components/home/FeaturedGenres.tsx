import Link from "next/link";
import {
  ChevronRight,
  Tags,
} from "lucide-react";
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

import styles from "./FeaturedGenres.module.css";

function genreCounts(games: readonly Game[]) {
  const counts = new Map<string, number>();

  for (const game of games) {
    for (const genre of new Set(game.genres ?? [])) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return counts;
}

function orderedGenres(
  games: readonly Game[],
  terms: readonly GameTaxonomyTerm[]
) {
  const counts = genreCounts(games);
  const labels = new Map(
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
    const label = labels.get(normalizeCatalogText(term.label));
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
          key: normalizeCatalogText(label).replace(/[^a-z0-9]+/g, "-") || "genero",
          label,
          active: true,
        },
        label,
        count,
      });
    });

  return ordered;
}

export default async function FeaturedGenres({
  games,
}: {
  games: Game[];
}) {
  const taxonomy = await getPublicTaxonomyPresentation();
  const genres = orderedGenres(games, taxonomy.genres);

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
        {genres.map(({ term, label, count }, index) => {
          const visual = resolveTaxonomyVisual(term, index);

          return (
            <Link
              key={term.key}
              href={`/juegos?q=${encodeURIComponent(label)}&buscarEn=category`}
              className={styles.genre}
              style={
                {
                  "--taxonomy-accent": visual.color,
                } as CSSProperties
              }
            >
              <span className={styles.genreIcon}>
                <TaxonomyIcon icon={visual.icon} size={17} />
              </span>
              <strong>{label}</strong>
              <span className={styles.genreCount}>
                {count} {count === 1 ? "juego" : "juegos"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
