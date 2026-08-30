export type GameTaxonomyIcon =
  | "gamepad"
  | "zap"
  | "compass"
  | "sword"
  | "car"
  | "puzzle"
  | "box"
  | "sparkles"
  | "shield"
  | "target"
  | "crosshair"
  | "ghost"
  | "skull"
  | "crown"
  | "rocket"
  | "plane"
  | "ship"
  | "bike"
  | "trophy"
  | "castle"
  | "dices"
  | "users"
  | "hammer"
  | "brain";

export type GameTaxonomyTone =
  | "brand"
  | "purple"
  | "violet"
  | "blue"
  | "green"
  | "orange"
  | "cyan"
  | "gold"
  | "red";

export type GameTaxonomyTerm = {
  key: string;
  label: string;
  active: boolean;
  icon?: GameTaxonomyIcon;
  tone?: GameTaxonomyTone;
};

export type GameTaxonomy = {
  categories: GameTaxonomyTerm[];
  genres: GameTaxonomyTerm[];
  tags: GameTaxonomyTerm[];
};

export type GameTaxonomyKind = keyof GameTaxonomy;
