import assert from "node:assert/strict";

import {
  getPerformanceProfile,
  resolvePerformanceProfile,
} from "../src/features/game-finder/performance-data.ts";

const slug = "dragon-ball-sparking-zero";
const serverProfile = getPerformanceProfile(slug);

assert.equal(
  serverProfile.storageGb,
  29,
  "El metadato estable de espacio debe existir en el perfil base."
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

  const hydratedProfile = getPerformanceProfile(slug);
  assert.equal(
    hydratedProfile.storageGb,
    serverProfile.storageGb,
    "El espacio estimado debe ser idéntico entre SSR y la primera hidratación."
  );
  assert.equal(
    hydratedProfile.referenceFps,
    serverProfile.referenceFps,
    "Los metadatos auxiliares no deben cambiar de fuente durante la hidratación."
  );
} finally {
  if (previousDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = previousDocument;
  }
}

console.log(
  "Hidratación de rendimiento: OK (metadatos estables en SSR/cliente; calibración publicada reservada al motor de FPS)."
);
