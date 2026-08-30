import type {
  TaxonomyIconKey,
  TaxonomyToneKey,
} from "@/lib/games/taxonomy-presentation";

export type GameTaxonomyTerm = {
  key: string;
  label: string;
  active: boolean;
  icon?: TaxonomyIconKey;
  tone?: TaxonomyToneKey;
};

export type GameTaxonomy = {
  categories: GameTaxonomyTerm[];
  genres: GameTaxonomyTerm[];
  tags: GameTaxonomyTerm[];
};

export type GameTaxonomyKind = keyof GameTaxonomy;
