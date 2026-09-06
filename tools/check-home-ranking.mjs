import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  parseGameDate,
} from "../src/lib/games/catalog.ts";
import {
  formatGameReleaseDate,
  parseGameCivilDate,
} from "../src/lib/games/game-date.ts";
import {
  homeRankingDay,
  homeRankingProfiles,
  minimumRamGb,
  rankHomeGames,
  resolveHomeCollectionGames,
  scoreHomeGame,
} from "../src/lib/home/ranking.ts";
import {
  games as sourceGames,
} from "../src/data/games.ts";

const [heroSectionSource, gameDateSource] = await Promise.all([
  readFile(
    new URL("../src/components/home/HeroSection.tsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../src/lib/games/game-date.ts", import.meta.url),
    "utf8"
  ),
]);

assert.match(
  heroSectionSource,
  /import \{ formatGameReleaseDate \} from "@\/lib\/games\/game-date";/,
  "El Hero público debe consumir el formatter compartido de fecha civil."
);
assert.match(
  heroSectionSource,
  /const release = formatGameReleaseDate\(game\.releaseDate\);/,
  "Los facts del Hero deben renderizar releaseDate con el contrato compartido."
);
assert.doesNotMatch(
  heroSectionSource,
  /function formatReleaseDate\(/,
  "El Hero no debe volver a mantener un formatter de fechas paralelo."
);
assert.match(
  gameDateSource,
  /const SPANISH_SHORT_MONTHS = \[/,
  "Las etiquetas del Hero deben usar un vocabulario de meses controlado por el producto."
);
assert.doesNotMatch(
  gameDateSource,
  /Intl\.DateTimeFormat/,
  "El formatter de fecha del Hero no debe depender de diferencias de ICU entre SSR y navegador."
);

const reference = Date.UTC(
  2026,
  7,
  30,
  12,
  0,
  0
);

function game(
  slug,
  overrides = {}
) {
  return {
    id: slug,
    slug,
    title: slug,
    description:
      "Descripción suficientemente completa para probar el motor automático de la portada sin depender de datos externos.",
    category: "Acción",
    imageAlt: slug,
    rating: 4,
    reviews: "1K",
    coverImage: `/images/games/${slug}/cover.webp`,
    ...overrides,
  };
}

function slugs(items) {
  return items.map((item) => item.slug);
}

for (const [target, profile] of Object.entries(
  homeRankingProfiles
)) {
  const totalWeight = Object.values(
    profile.weights
  ).reduce((total, weight) => total + weight, 0);

  assert.equal(
    totalWeight,
    100,
    `${target} debe conservar un perfil normalizado al 100%.`
  );
}

assert.equal(
  homeRankingDay(
    Date.UTC(2026, 7, 30, 0, 1)
  ),
  homeRankingDay(
    Date.UTC(2026, 7, 30, 23, 59)
  ),
  "El ranking debe usar una referencia diaria estable."
);

const civilDmy = parseGameCivilDate("05/09/2026");
const civilIso = parseGameCivilDate("2026-09-05");
assert.equal(
  civilDmy,
  Date.UTC(2026, 8, 5),
  "DD/MM/YYYY debe convertirse a la fecha civil UTC exacta."
);
assert.equal(
  civilIso,
  civilDmy,
  "YYYY-MM-DD y DD/MM/YYYY deben representar la misma fecha civil."
);
assert.equal(
  parseGameCivilDate("31/02/2026"),
  null,
  "Una fecha civil imposible en formato local debe rechazarse en vez de normalizarse."
);
assert.equal(
  parseGameCivilDate("2026-02-31"),
  null,
  "Una fecha civil imposible en formato ISO debe rechazarse en vez de normalizarse."
);
assert.equal(
  parseGameDate("31/02/2026"),
  0,
  "El ranking no debe otorgar actualidad a una fecha local imposible."
);
assert.equal(
  parseGameDate("2026-02-31"),
  0,
  "El ranking no debe otorgar actualidad a una fecha ISO imposible."
);
assert.equal(
  parseGameDate("2026-02-31T00:00:00Z"),
  0,
  "Un instante ISO con día calendario imposible tampoco debe esquivar la validación."
);
assert.equal(
  formatGameReleaseDate("05/09/2026"),
  "5 sept 2026",
  "La etiqueta civil debe ser exacta e independiente de timezone e ICU."
);
assert.equal(
  formatGameReleaseDate("2026-09-05"),
  "5 sept 2026",
  "YYYY-MM-DD debe producir la misma etiqueta civil controlada."
);
assert.equal(
  formatGameReleaseDate("2026-09-05T00:30:00Z"),
  "5 sept 2026",
  "Los instantes ISO explícitos deben formatearse por componentes UTC."
);
assert.equal(
  formatGameReleaseDate("31/02/2026"),
  "31/02/2026",
  "Una fecha civil inválida debe conservarse visible como dato editorial, no inventar otro día."
);
assert.equal(
  formatGameReleaseDate("2026-02-31T00:00:00Z"),
  "2026-02-31T00:00:00Z",
  "Un instante ISO con calendario imposible debe conservarse visible y no normalizarse."
);
assert.equal(
  formatGameReleaseDate("A confirmar"),
  "A confirmar",
  "El texto editorial que no es fecha debe conservarse sin interpretación heurística."
);

const fameLow = game("fame-low", {
  rating: 4.5,
  reviews: "20",
});
const fameHigh = game("fame-high", {
  rating: 4.5,
  reviews: "100K",
});
assert.ok(
  scoreHomeGame(fameHigh, "popular", reference).score >
    scoreHomeGame(fameLow, "popular", reference).score,
  "Más volumen de reseñas debe aumentar la señal de popularidad."
);

const ratingLow = game("rating-low", {
  rating: 3.5,
  reviews: "10K",
});
const ratingHigh = game("rating-high", {
  rating: 4.9,
  reviews: "10K",
});
assert.ok(
  scoreHomeGame(ratingHigh, "popular", reference).score >
    scoreHomeGame(ratingLow, "popular", reference).score,
  "A igualdad de popularidad, mejor rating debe mejorar el score."
);

const newRelease = game("new-release", {
  releaseDate: "2026-08-30",
});
const oldRelease = game("old-release", {
  releaseDate: "2021-08-30",
});
assert.ok(
  scoreHomeGame(newRelease, "popular", reference).score >
    scoreHomeGame(oldRelease, "popular", reference).score,
  "La actualidad de lanzamiento debe decaer con el tiempo."
);

const futureRelease = game("future-release", {
  releaseDate: "2027-08-30",
});
const noRelease = game("no-release");
assert.equal(
  scoreHomeGame(futureRelease, "popular", reference).score,
  scoreHomeGame(noRelease, "popular", reference).score,
  "Una fecha futura no debe recibir un bonus de actualidad."
);

const invalidRelease = game("invalid-release", {
  releaseDate: "31/02/2026",
});
assert.equal(
  scoreHomeGame(invalidRelease, "popular", reference).score,
  scoreHomeGame(noRelease, "popular", reference).score,
  "Una fecha de calendario imposible debe comportarse como desconocida en el ranking."
);

const sameDayMorning = scoreHomeGame(
  newRelease,
  "popular",
  Date.UTC(2026, 7, 30, 0, 1)
).score;
const sameDayNight = scoreHomeGame(
  newRelease,
  "popular",
  Date.UTC(2026, 7, 30, 23, 59)
).score;
assert.equal(
  sameDayMorning,
  sameDayNight,
  "El score no debe fluctuar durante el mismo día UTC."
);

const explained = scoreHomeGame(
  fameHigh,
  "popular",
  reference
);
assert.ok(
  explained.components.length > 0 &&
    explained.reasons.length > 0,
  "El ranking debe exponer un desglose explicable de sus contribuciones."
);
for (let index = 1; index < explained.components.length; index += 1) {
  assert.ok(
    explained.components[index - 1].points >=
      explained.components[index].points,
    "Las razones deben ordenarse por contribución real al score."
  );
}

const ramMb = game("ram-mb", {
  requirements: {
    minimum: {
      ram: "2048 MB",
    },
  },
});
assert.equal(
  minimumRamGb(ramMb),
  2,
  "El parser de RAM debe convertir MB a GB."
);

const ramHeavy = game("ram-heavy", {
  requirements: {
    minimum: {
      ram: "16 GB",
    },
  },
});
assert.deepEqual(
  rankHomeGames(
    [ramMb, ramHeavy],
    "lowSpec",
    reference
  ).map((entry) => entry.game.slug),
  ["ram-mb"],
  "Bajos recursos no debe incluir automáticamente juegos fuera del umbral."
);

const heroWithoutArtwork = game(
  "hero-no-art",
  {
    coverImage: undefined,
    heroImage: undefined,
    reviews: "1M",
    rating: 5,
  }
);
const heroWithArtwork = game(
  "hero-with-art",
  {
    reviews: "10",
    rating: 3,
  }
);
assert.deepEqual(
  rankHomeGames(
    [heroWithoutArtwork, heroWithArtwork],
    "hero",
    reference
  ).map((entry) => entry.game.slug),
  ["hero-with-art"],
  "Hero automático debe exigir al menos una imagen utilizable."
);

const a = game("a", {
  reviews: "1K",
  rating: 4,
});
const b = game("b", {
  reviews: "100K",
  rating: 4.8,
});
const c = game("c", {
  reviews: "5K",
  rating: 4.5,
});
const catalog = [a, b, c];

assert.deepEqual(
  slugs(
    resolveHomeCollectionGames(
      catalog,
      "popular",
      "manual",
      ["c", "a"],
      3,
      reference
    )
  ),
  ["c", "a"],
  "Manual debe respetar exactamente selección y orden sin rellenar."
);

assert.equal(
  resolveHomeCollectionGames(
    catalog,
    "popular",
    "automatic",
    ["c"],
    2,
    reference
  )[0]?.slug,
  "b",
  "Automático debe ignorar las prioridades manuales y usar el ranking."
);

const hybrid = resolveHomeCollectionGames(
  catalog,
  "popular",
  "hybrid",
  ["c"],
  3,
  reference
);
assert.deepEqual(
  slugs(hybrid),
  ["c", "b", "a"],
  "Híbrido debe conservar fijados y completar con ranking sin duplicar."
);
assert.equal(
  new Set(slugs(hybrid)).size,
  hybrid.length,
  "Híbrido no debe producir duplicados."
);

assert.deepEqual(
  slugs(
    resolveHomeCollectionGames(
      [a, b],
      "popular",
      "manual",
      ["inexistente", "a"],
      3,
      reference
    )
  ),
  ["a"],
  "Una referencia que no existe en el catálogo disponible debe ignorarse."
);

const tiedA = game("alpha", {
  title: "Alpha",
  reviews: "1K",
  rating: 4,
});
const tiedB = game("beta", {
  title: "Beta",
  reviews: "1K",
  rating: 4,
});
assert.deepEqual(
  rankHomeGames(
    [tiedB, tiedA],
    "popular",
    reference
  ).map((entry) => entry.game.slug),
  ["alpha", "beta"],
  "Los empates deben resolverse de forma determinista."
);

const sourcePopular = rankHomeGames(
  sourceGames,
  "popular",
  reference
);
assert.equal(
  sourcePopular.length,
  sourceGames.length,
  "Todos los juegos fuente deben ser candidatos de Populares."
);
assert.equal(
  new Set(
    sourcePopular.map((entry) => entry.game.slug)
  ).size,
  sourcePopular.length,
  "El ranking del catálogo real no debe duplicar juegos."
);
for (let index = 1; index < sourcePopular.length; index += 1) {
  assert.ok(
    sourcePopular[index - 1].score >=
      sourcePopular[index].score,
    "El catálogo real debe quedar ordenado por score descendente."
  );
}

const sourceLowSpec = rankHomeGames(
  sourceGames,
  "lowSpec",
  reference
);
assert.ok(
  sourceLowSpec.length > 0,
  "El catálogo real debe producir candidatos para Bajos recursos."
);
assert.ok(
  sourceLowSpec.every((entry) => {
    const ram = minimumRamGb(entry.game);
    return ram !== null && ram <= 12;
  }),
  "Todos los candidatos automáticos de Bajos recursos deben respetar el umbral."
);

const sourceHero = rankHomeGames(
  sourceGames,
  "hero",
  reference
);
assert.ok(
  sourceHero.every((entry) =>
    Boolean(entry.game.heroImage || entry.game.coverImage)
  ),
  "Todos los candidatos automáticos del Hero deben tener arte utilizable."
);

console.log(
  `Ranking de Portada: OK (${sourceGames.length} juegos reales + casos sintéticos; perfiles al 100%, fechas civiles UTC/ICU-independent, estabilidad diaria, fama, rating, actualidad, RAM, Hero, explicación, Manual, Automático e Híbrido verificados).`
);
