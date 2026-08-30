import assert from "node:assert/strict";

import {
  homeRankingDay,
  minimumRamGb,
  rankHomeGames,
  resolveHomeCollectionGames,
  scoreHomeGame,
} from "../src/lib/home/ranking.ts";
import {
  games as sourceGames,
} from "../src/data/games.ts";

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

assert.equal(
  homeRankingDay(reference + 1_000),
  homeRankingDay(reference + 12 * 60 * 60 * 1_000),
  "El ranking debe usar una referencia diaria estable."
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
  `Ranking de Portada: OK (${sourceGames.length} juegos reales + casos sintéticos; estabilidad diaria, fama, rating, actualidad, RAM, Hero, Manual, Automático e Híbrido verificados).`
);
