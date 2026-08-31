import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  chooseFreshestConfirmedCpu,
} from "../src/features/game-finder/cpu-confirmation-storage.ts";
import {
  cpuModelKey,
  matchCpuName,
  normalizeCpuName,
  suggestCpuNames,
} from "../src/features/game-finder/cpu-matcher.ts";
import {
  cpuCatalog,
  estimateCpuFromLogicalProcessors,
  findCpuById,
  findGpuById,
} from "../src/features/game-finder/hardware-catalog.ts";
import {
  parseStoredHardwareProfile,
} from "../src/features/game-finder/hardware-storage.ts";
import {
  estimateGamePerformance,
} from "../src/features/game-finder/performance-model.ts";

const rawCases = [
  [
    "12th Gen Intel(R) Core(TM) i7-12700K",
    "Intel Core i7-12700K",
  ],
  [
    "Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz",
    "Intel Core i5-10400F",
  ],
  [
    "AMD Ryzen 7 5800X3D 8-Core Processor",
    "AMD Ryzen 7 5800X3D",
  ],
  [
    "AMD Ryzen 5 5600G with Radeon Graphics",
    "AMD Ryzen 5 5600G",
  ],
  [
    "Intel(R) Core(TM) Ultra 7 265K",
    "Intel Core Ultra 7 265K",
  ],
  [
    "AMD Ryzen 7 7840HS w/ Radeon 780M Graphics",
    "AMD Ryzen 7 7840HS",
  ],
  [
    "AMD Ryzen AI Max+ PRO 395 Processor",
    "AMD Ryzen AI Max+ PRO 395",
  ],
];

for (const [raw, expected] of rawCases) {
  const match = matchCpuName(raw);
  assert.ok(
    match,
    `Debe reconocer con alta confianza: ${raw}`
  );
  assert.equal(
    match.cpu.name,
    expected,
    `El texto '${raw}' debe resolver exactamente a '${expected}'.`
  );
  assert.ok(
    match.confidence >= 0.96,
    `La coincidencia exacta de ${expected} debe ser de alta confianza.`
  );
}

const strictVariants = [
  ["Intel Core i7-12700", "Intel Core i7-12700"],
  ["Intel Core i7-12700K", "Intel Core i7-12700K"],
  ["Intel Core i7-12700F", "Intel Core i7-12700F"],
  ["Intel Core i7-12700KF", "Intel Core i7-12700KF"],
  ["AMD Ryzen 7 5800H", "AMD Ryzen 7 5800H"],
  ["AMD Ryzen 7 5800X", "AMD Ryzen 7 5800X"],
  ["AMD Ryzen 7 5800X3D", "AMD Ryzen 7 5800X3D"],
];

for (const [raw, expected] of strictVariants) {
  const match = matchCpuName(raw);
  assert.ok(match, `Debe encontrar ${raw}.`);
  assert.equal(
    match.cpu.name,
    expected,
    `No debe confundir variantes: ${raw}.`
  );
}

assert.equal(
  matchCpuName("Intel Core i7"),
  null,
  "Una familia vaga no debe inventar un modelo exacto."
);
assert.equal(
  matchCpuName("AMD Ryzen 7"),
  null,
  "Una familia Ryzen vaga no debe inventar un modelo exacto."
);

const wrongVendor = matchCpuName(
  "AMD Core i7-12700K"
);
assert.equal(
  wrongVendor,
  null,
  "Una cadena con fabricante incompatible no debe auto-confirmarse."
);

const normalizedWindowsName = normalizeCpuName(
  "12th Gen Intel(R) Core(TM) i7-12700K CPU @ 3.60GHz"
);
assert.ok(
  normalizedWindowsName.includes("intel core i7 12700k") &&
    !normalizedWindowsName.includes("12th") &&
    !normalizedWindowsName.includes("ghz"),
  "La normalización debe retirar ruido de Windows sin perder el modelo."
);

assert.equal(
  cpuModelKey("AMD Ryzen AI Max+ PRO 395 Processor"),
  "ryzen-ai-max-395",
  "Ryzen AI Max+ debe producir una clave de modelo estable."
);

const normalizedNameGroups = new Map();
for (const cpu of cpuCatalog) {
  const normalized = normalizeCpuName(cpu.name);
  const group = normalizedNameGroups.get(normalized) ?? [];
  group.push(cpu);
  normalizedNameGroups.set(normalized, group);

  const suggestions = suggestCpuNames(cpu.name, 8);
  assert.ok(
    suggestions.some(
      (candidate) => candidate.cpu.id === cpu.id
    ),
    `Cada CPU del catálogo debe encontrarse por su propio nombre: ${cpu.name}.`
  );
}

const duplicateNormalizedNames = [...normalizedNameGroups.entries()]
  .filter(([, entries]) => entries.length > 1);
assert.deepEqual(
  duplicateNormalizedNames.map(([name, entries]) => [
    name,
    entries.map((entry) => entry.id),
  ]),
  [],
  "El catálogo no debe contener nombres de CPU duplicados tras normalización."
);

for (const threads of [1, 4, 8, 12, 16, 24, 32, 64]) {
  const estimate = estimateCpuFromLogicalProcessors(threads);
  assert.ok(estimate, `Debe estimar capacidad para ${threads} hilos.`);
  assert.equal(estimate.id, "browser-cpu-estimate");
  assert.ok(
    typeof estimate.scoreMin === "number" &&
      typeof estimate.scoreMax === "number" &&
      estimate.scoreMin < estimate.score &&
      estimate.score < estimate.scoreMax,
    `La CPU de ${threads} hilos debe usar un intervalo real, no un punto falso.`
  );
}
assert.equal(
  estimateCpuFromLogicalProcessors(null),
  null,
  "Sin hardwareConcurrency no debe inventarse CPU."
);
assert.equal(
  estimateCpuFromLogicalProcessors(0),
  null,
  "Un número inválido de hilos no debe producir CPU."
);

const referenceCpu = findCpuById("ryzen-5-5600x");
const alternateCpu = findCpuById("i7-12700k");
const referenceGpu = findGpuById("rtx-3060");
assert.ok(referenceCpu, "La CPU de referencia debe existir.");
assert.ok(alternateCpu, "La CPU alternativa debe existir.");
assert.ok(referenceGpu, "La GPU de referencia debe existir.");

assert.equal(
  chooseFreshestConfirmedCpu(
    {
      cpu: referenceCpu,
      updatedAt: "2026-08-30T12:00:00.000Z",
    },
    {
      cpu: alternateCpu,
      updatedAt: "2026-08-30T13:00:00.000Z",
    }
  )?.id,
  alternateCpu.id,
  "Si el perfil manual cambió después, debe ganar su CPU más reciente."
);
assert.equal(
  chooseFreshestConfirmedCpu(
    {
      cpu: referenceCpu,
      updatedAt: "2026-08-30T14:00:00.000Z",
    },
    {
      cpu: alternateCpu,
      updatedAt: "2026-08-30T13:00:00.000Z",
    }
  )?.id,
  referenceCpu.id,
  "Si la confirmación asistida es más reciente, debe reemplazar al perfil anterior."
);
assert.equal(
  chooseFreshestConfirmedCpu(
    {
      cpu: referenceCpu,
      updatedAt: null,
    },
    {
      cpu: alternateCpu,
      updatedAt: null,
    }
  )?.id,
  alternateCpu.id,
  "Con fechas ausentes o inválidas, el perfil completo debe ser la fuente autoritativa."
);

const estimatedCpu = estimateCpuFromLogicalProcessors(16);
assert.ok(estimatedCpu);

const sharedProfile = {
  gpu: referenceGpu,
  ramGb: 16,
  ramKnowledge: "confirmed",
  os: "Windows 11 64-bit",
  osConfirmed: true,
  memoryMode: "dual",
  updatedAt: "2026-08-30T12:00:00.000Z",
};

const exactProfile = {
  ...sharedProfile,
  cpu: referenceCpu,
  cpuKnowledge: "confirmed",
  source: "manual",
  confidence: "high",
};
const estimatedProfile = {
  ...sharedProfile,
  cpu: estimatedCpu,
  cpuKnowledge: "estimated",
  source: "browser",
  confidence: "low",
};

const exactEstimate = estimateGamePerformance(
  "minecraft-java-edition",
  exactProfile,
  { resolution: "1080p", quality: "medium" }
);
const uncertainEstimate = estimateGamePerformance(
  "minecraft-java-edition",
  estimatedProfile,
  { resolution: "1080p", quality: "medium" }
);

assert.equal(exactEstimate.canEstimate, true);
assert.equal(uncertainEstimate.canEstimate, true);
assert.equal(
  uncertainEstimate.confidence,
  "low",
  "Una CPU inferida sólo por hilos debe mantener confianza baja."
);
assert.ok(
  uncertainEstimate.maxFps - uncertainEstimate.minFps >
    exactEstimate.maxFps - exactEstimate.minFps,
  "La incertidumbre real de CPU debe ensanchar el rango de FPS."
);
assert.ok(
  uncertainEstimate.minFps <= uncertainEstimate.fps &&
    uncertainEstimate.maxFps >= uncertainEstimate.fps,
  "El centro orientativo debe quedar dentro del intervalo de CPU estimada."
);

const stored = parseStoredHardwareProfile(
  JSON.stringify({
    cpuId: referenceCpu.id,
    gpuId: referenceGpu.id,
    ramGb: 16,
    os: "Windows 11 64-bit",
    osConfirmed: true,
    memoryMode: "dual",
    updatedAt: "2026-08-30T12:00:00.000Z",
  })
);
assert.ok(stored, "Los perfiles v2 existentes deben seguir cargando.");
assert.equal(
  stored.cpuKnowledge,
  "confirmed",
  "Un CPU guardado por ID exacto debe recuperarse como confirmado."
);

const requirementsPageSource = readFileSync(
  new URL("../src/app/requisitos/page.tsx", import.meta.url),
  "utf8"
);
const unifiedHeroSource = readFileSync(
  new URL("../src/features/game-finder/GameFinderUnifiedHero.tsx", import.meta.url),
  "utf8"
);

assert.equal(
  requirementsPageSource.includes("CpuIdentificationAssistant"),
  false,
  "La página /requisitos no debe volver a montar una ventana independiente de identificación de CPU."
);
assert.ok(
  unifiedHeroSource.includes("cpuConfirmationRequested") &&
    unifiedHeroSource.includes("handleDetect") &&
    unifiedHeroSource.includes("<CpuIdentificationAssistant"),
  "La confirmación exacta de CPU debe permanecer integrada al flujo del botón Detectar."
);
assert.ok(
  unifiedHeroSource.includes('hardware.cpuKnowledge !== "confirmed"'),
  "Una CPU ya confirmada no debe volver a pedir identificación después de detectar."
);

console.log(
  `Detección de hardware: OK (${cpuCatalog.length} CPUs; nombres Windows/Intel/AMD, variantes estrictas, fuentes recientes, confirmación integrada, estimación por intervalos y propagación a FPS verificadas).`
);