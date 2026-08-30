import "server-only";

import { cache } from "react";
import { connection } from "next/server";

import {
  adminQuery,
} from "@/lib/admin/database";
import {
  parseEditorialPayload,
} from "@/lib/admin/content-validation";
import {
  defaultTaxonomyIcon,
  defaultTaxonomyTone,
} from "@/lib/games/taxonomy-presentation";
import type {
  GameTaxonomy,
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

const emptyTaxonomy: GameTaxonomy = {
  categories: [],
  genres: [],
  tags: [],
};

type TaxonomyRow = {
  draft_payload: unknown;
};

function ensureVisuals(
  terms: GameTaxonomyTerm[]
) {
  return terms.map((term, index) => ({
    ...term,
    icon: term.icon ?? defaultTaxonomyIcon(term.label),
    tone: term.tone ?? defaultTaxonomyTone(term.label, index),
  }));
}

export const getPublicTaxonomyPresentation = cache(
  async (): Promise<GameTaxonomy> => {
    await connection();

    try {
      const result = await adminQuery<TaxonomyRow>(
        `SELECT draft_payload
           FROM deuna_admin.editorial_items
          WHERE item_type = 'game_taxonomy'
            AND item_key = 'games'
          LIMIT 1`
      );
      const row = result.rows[0];

      if (!row) return emptyTaxonomy;

      const taxonomy = parseEditorialPayload(
        "game_taxonomy",
        row.draft_payload
      );

      return {
        categories: ensureVisuals(taxonomy.categories),
        genres: ensureVisuals(taxonomy.genres),
        tags: taxonomy.tags,
      };
    } catch {
      return emptyTaxonomy;
    }
  }
);
