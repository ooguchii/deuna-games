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

/*
 * Categoría y género son una sola clasificación editorial.
 * El modelo Game conserva category + genres internamente por compatibilidad
 * con el contenido existente, pero el panel y la web consumen una única
 * lista maestra: classifications.
 */
export type GameTaxonomy = {
  classifications: GameTaxonomyTerm[];
  tags: GameTaxonomyTerm[];
};

export type GameTaxonomyKind = keyof GameTaxonomy;
