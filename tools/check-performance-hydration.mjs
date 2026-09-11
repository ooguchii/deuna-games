import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getPerformanceProfile,
  resolvePerformanceProfile,
} from "../src/features/game-finder/performance-data.ts";

const slug = "dragon-ball-sparking-zero";
const performanceSource = await readFile(
  new URL(
    "../src/features/game-finder/performance-data.ts",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  performanceSource,
  /const profiles: GamePerformanceProfile\[\] = \[\];/,
  "No debe reaparecer un catálogo bundled de FPS sin procedencia y metodología editorial."
);
assert.equal(
  getPerformanceProfile(slug),
  null,
  "El fixture bundled no debe fabricar un perfil FPS ni almacenamiento auxiliar."
);
assert.equal(
  resolvePerformanceProfile(slug),
  null,
  "Sin calibración publicada el motor debe representar la ausencia de benchmark con null."
);

const previousDocument = globalThis.document;

globalThis.document = {
  getElementById(id) {
    if (id !== "deuna-performance-calibrations") return null;

    return {
      textContent: JSON.stringify({
        [slug]: {
          referenceFps: 123,
          ramGb: 32,
        },
      }),
    };
  },
};

try {
  const publishedCalibration = resolvePerformanceProfile(slug);
  assert.equal(
    publishedCalibration?.referenceFps,
    123,
    "El motor de FPS debe seguir leyendo la calibración publicada del navegador."
  );
  assert.equal(
    publishedCalibration?.ramGb,
    32,
    "La calibración publicada debe seguir alimentando el motor de rendimiento."
  );

  assert.equal(
    getPerformanceProfile(slug),
    null,
    "La hidratación no debe convertir una calibración pública en un fallback bundled persistente."
  );
} finally {
  if (previousDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = previousDocument;
  }
}

console.log(
  "Hidratación de rendimiento: OK (sin FPS bundled; calibración publicada validada y aislada del fallback estático)."
);
