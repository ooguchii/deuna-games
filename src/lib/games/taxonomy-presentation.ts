import type {
  GameTaxonomyTerm,
} from "@/types/game-taxonomy";

export const taxonomyIconKeys = [
  "gamepad",
  "zap",
  "compass",
  "sword",
  "car",
  "puzzle",
  "box",
  "sparkles",
  "shield",
  "target",
  "crosshair",
  "ghost",
  "skull",
  "crown",
  "rocket",
  "plane",
  "ship",
  "bike",
  "trophy",
  "castle",
  "dices",
  "users",
  "hammer",
  "brain",
] as const;

export type TaxonomyIconKey =
  (typeof taxonomyIconKeys)[number];

export const taxonomyToneKeys = [
  "brand",
  "purple",
  "violet",
  "blue",
  "green",
  "orange",
  "cyan",
  "gold",
  "red",
] as const;

export type TaxonomyToneKey =
  (typeof taxonomyToneKeys)[number];

export const taxonomyIconOptions: ReadonlyArray<{
  key: TaxonomyIconKey;
  label: string;
}> = [
  { key: "gamepad", label: "Mando / juego" },
  { key: "zap", label: "Rayo / acción" },
  { key: "compass", label: "Brújula / aventura" },
  { key: "sword", label: "Espada / RPG" },
  { key: "car", label: "Auto / carreras" },
  { key: "puzzle", label: "Puzzle" },
  { key: "box", label: "Cubo / sandbox" },
  { key: "sparkles", label: "Destellos / simulación" },
  { key: "shield", label: "Escudo" },
  { key: "target", label: "Objetivo" },
  { key: "crosshair", label: "Mira" },
  { key: "ghost", label: "Fantasma / terror" },
  { key: "skull", label: "Calavera" },
  { key: "crown", label: "Corona" },
  { key: "rocket", label: "Cohete" },
  { key: "plane", label: "Avión" },
  { key: "ship", label: "Barco" },
  { key: "bike", label: "Bicicleta" },
  { key: "trophy", label: "Trofeo / deportes" },
  { key: "castle", label: "Castillo" },
  { key: "dices", label: "Dados" },
  { key: "users", label: "Multijugador" },
  { key: "hammer", label: "Construcción" },
  { key: "brain", label: "Estrategia" },
];

export const taxonomyToneOptions: ReadonlyArray<{
  key: TaxonomyToneKey;
  label: string;
  color: string;
}> = [
  { key: "brand", label: "Rosa DEUNA", color: "#ff1554" },
  { key: "purple", label: "Púrpura", color: "#b828ff" },
  { key: "violet", label: "Violeta", color: "#7448ff" },
  { key: "blue", label: "Azul", color: "#188cff" },
  { key: "green", label: "Verde", color: "#20d980" },
  { key: "orange", label: "Naranja", color: "#ff9818" },
  { key: "cyan", label: "Cian", color: "#21c7ff" },
  { key: "gold", label: "Dorado", color: "#f4c542" },
  { key: "red", label: "Rojo", color: "#ff4b55" },
];

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function defaultTaxonomyIcon(
  label: string
): TaxonomyIconKey {
  const value = normalized(label);

  if (value.includes("accion")) return "zap";
  if (value.includes("aventura")) return "compass";
  if (value.includes("carrera")) return "car";
  if (value.includes("puzzle")) return "puzzle";
  if (value.includes("rpg")) return "sword";
  if (value.includes("sandbox")) return "box";
  if (value.includes("simul")) return "sparkles";
  if (value.includes("deporte")) return "trophy";
  if (value.includes("terror") || value.includes("horror")) {
    return "ghost";
  }
  if (value.includes("estrateg")) return "brain";
  if (value.includes("shooter") || value.includes("disparo")) {
    return "crosshair";
  }
  if (value.includes("multijugador") || value.includes("cooper")) {
    return "users";
  }

  return "gamepad";
}

export function defaultTaxonomyTone(
  label: string,
  index = 0
): TaxonomyToneKey {
  const value = normalized(label);

  if (value.includes("accion")) return "brand";
  if (value.includes("aventura")) return "purple";
  if (value.includes("rpg")) return "violet";
  if (value.includes("carrera")) return "orange";
  if (value.includes("puzzle")) return "blue";
  if (value.includes("sandbox")) return "green";
  if (value.includes("simul")) return "cyan";
  if (value.includes("deporte")) return "gold";
  if (value.includes("terror") || value.includes("horror")) {
    return "red";
  }

  return taxonomyToneKeys[index % taxonomyToneKeys.length];
}

export function resolveTaxonomyVisual(
  term: Pick<GameTaxonomyTerm, "label" | "icon" | "tone">,
  index = 0
) {
  const icon = taxonomyIconKeys.includes(
    term.icon as TaxonomyIconKey
  )
    ? (term.icon as TaxonomyIconKey)
    : defaultTaxonomyIcon(term.label);
  const tone = taxonomyToneKeys.includes(
    term.tone as TaxonomyToneKey
  )
    ? (term.tone as TaxonomyToneKey)
    : defaultTaxonomyTone(term.label, index);
  const color =
    taxonomyToneOptions.find((option) => option.key === tone)?.color ??
    taxonomyToneOptions[0].color;

  return { icon, tone, color };
}

export function withTaxonomyVisualDefaults(
  term: GameTaxonomyTerm,
  index = 0
): GameTaxonomyTerm {
  const visual = resolveTaxonomyVisual(term, index);

  return {
    ...term,
    icon: visual.icon,
    tone: visual.tone,
  };
}
