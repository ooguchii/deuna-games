import { games } from "../src/data/games.ts";
import {
  findCpuById,
  findGpuById,
} from "../src/features/game-finder/hardware-catalog.ts";
import {
  hasRecommendationSignals,
  rankGamesForSavedHardware,
  rankPersonalizedRecommendations,
} from "../src/lib/home/account-personalization.ts";

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const longDescription =
  "Descripción sintética suficientemente extensa para que todas las fichas comparadas tengan exactamente las mismas señales editoriales de completitud.";
const syntheticGames = [
  {
    id: "source",
    slug: "source-action",
    title: "Origen Acción",
    description: longDescription,
    category: "Acción",
    genres: ["RPG"],
    tags: ["Soulslike"],
    rating: 4.5,
    reviews: "10K",
    coverImage: "/synthetic-source.webp",
    imageAlt: "Origen",
  },
  {
    id: "match",
    slug: "match-action",
    title: "Coincidencia Acción",
    description: longDescription,
    category: "Acción",
    genres: ["RPG"],
    tags: ["Soulslike"],
    rating: 4.5,
    reviews: "10K",
    coverImage: "/synthetic-match.webp",
    imageAlt: "Coincidencia",
  },
  {
    id: "other",
    slug: "other-puzzle",
    title: "Otro Puzzle",
    description: longDescription,
    category: "Puzzle",
    genres: ["Lógica"],
    tags: ["Relajado"],
    rating: 4.5,
    reviews: "10K",
    coverImage: "/synthetic-other.webp",
    imageAlt: "Otro",
  },
];
const preference = {
  gameSlug: "source-action",
  favorite: true,
  libraryState: "completed",
  followUpdates: false,
  followedAt: null,
  updatesSeenThrough: null,
  updatedAt: new Date("2026-08-31T00:00:00Z"),
};
const ranking = rankPersonalizedRecommendations(
  syntheticGames,
  [preference],
  null,
  Date.UTC(2026, 7, 31)
);

assert(
  !ranking.some((entry) => entry.game.slug === "source-action"),
  "Un juego ya guardado no debe recomendarse como descubrimiento nuevo."
);
assert(
  ranking[0]?.game.slug === "match-action",
  "Una afinidad explícita de género/categoría/etiqueta debe cambiar el orden de recomendación."
);
assert(
  ranking[0]?.reasons.some((reason) => reason.startsWith("Coincide con tus gustos:")),
  "El ranking personalizado debe explicar la señal explícita que influyó."
);
assert(
  ranking.every((entry) => entry.reasons.every((reason) => !/\(\+\d/.test(reason))),
  "Las razones públicas no deben exponer puntos internos del algoritmo."
);

const followingOnly = {
  ...preference,
  favorite: false,
  libraryState: null,
  followUpdates: true,
  followedAt: new Date("2026-08-31T00:00:00Z"),
};
const followedOther = {
  ...followingOnly,
  gameSlug: "other-puzzle",
};
const mixedRanking = rankPersonalizedRecommendations(
  syntheticGames,
  [preference, followedOther],
  null,
  Date.UTC(2026, 7, 31)
);

assert(
  !hasRecommendationSignals([followingOnly], null),
  "Seguir actualizaciones no debe interpretarse por sí solo como señal de gustos."
);
assert(
  hasRecommendationSignals([preference], null),
  "Favoritos/estado de biblioteca deben activar recomendaciones explícitas."
);
assert(
  !mixedRanking.some((entry) => entry.game.slug === "other-puzzle"),
  "Un juego seguido debe quedar fuera de descubrimientos aunque el seguimiento no sume afinidad."
);
assert(
  mixedRanking[0]?.game.slug === "match-action",
  "Excluir un seguimiento no debe alterar la afinidad construida con elecciones de gusto reales."
);

const cpu = findCpuById("ryzen-5-5600x");
const gpu = findGpuById("rtx-3060");

assert(Boolean(cpu), "La CPU de referencia debe existir en el catálogo.");
assert(Boolean(gpu), "La GPU de referencia debe existir en el catálogo.");

if (cpu && gpu) {
  const hardware = {
    cpu,
    cpuKnowledge: "confirmed",
    gpu,
    ramGb: 16,
    ramKnowledge: "confirmed",
    os: "Sistema sin guardar",
    osConfirmed: false,
    memoryMode: "dual",
    source: "saved",
    confidence: "high",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
  const hardwareRanking = rankGamesForSavedHardware(
    games,
    hardware,
    Date.UTC(2026, 7, 31)
  );

  assert(
    hardwareRanking.length > 0,
    "Una PC guardada debe producir una colección de juegos estimables."
  );
  assert(
    hardwareRanking.every((entry) => entry.estimate?.canEstimate),
    "La colección para Mi PC sólo debe incluir juegos realmente estimados por el motor de FPS."
  );
  assert(
    hardwareRanking[0]?.reasons.some((reason) => reason.startsWith("Tu PC:")),
    "El ranking por hardware debe explicar el rango FPS que utilizó."
  );
  assert(
    hardwareRanking.every((entry) => entry.reasons.every((reason) => !/\(\+\d/.test(reason))),
    "El ranking de Mi PC tampoco debe exponer puntos internos del algoritmo."
  );
  assert(
    hasRecommendationSignals([], hardware),
    "Una PC guardada debe poder personalizar recomendaciones aun sin biblioteca."
  );
}

if (failures.length > 0) {
  console.error("\nPersonalización de cuentas: ERROR\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Personalización de cuentas: OK (afinidad explícita, seguimiento no inferido como gusto, exclusión de Mi DeUna, razones públicas y ranking por el motor real de FPS verificados)."
);
