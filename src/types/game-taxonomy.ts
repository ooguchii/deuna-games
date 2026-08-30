export type GameTaxonomyTerm = {
  key: string;
  label: string;
  active: boolean;
};

export type GameTaxonomy = {
  categories: GameTaxonomyTerm[];
  genres: GameTaxonomyTerm[];
  tags: GameTaxonomyTerm[];
};

export type GameTaxonomyKind = keyof GameTaxonomy;
