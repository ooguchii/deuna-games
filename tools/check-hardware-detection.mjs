import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  searchCpuCatalog,
} from "../src/features/game-finder/cpu-catalog-search.ts";
import {
  chooseFreshestConfirmedCpu,
} from "../src/features/game-finder/cpu-confirmation-storage.ts";
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

const i5Search = searchCpuCatalog("i5 12400", 10);
assert.ok(i5Search.total >= 1, "Buscar 'i5 12400' debe encontrar CPUs del catálogo.");
assert.ok(
  i5Search.items.some((cpu) => cpu.name.includes("i5-12400")),
  "La búsqueda por términos debe encontrar la familia i5-12400."
);

const ryzenSearch = searchCpuCatalog("5800 x3d", 10);
assert.equal(
  ryzenSearch.items[0]?.name,
  "AMD Ryzen 7 5800X3D",
  "Una búsqueda específica debe priorizar el modelo exacto del catálogo."
);

const ultraSearch = searchCpuCatalog("ultra 7 265", 10);
assert.ok(
  ultraSearch.items.some((cpu) => cpu.name.includes("Core Ultra 7 265")),
  "La búsqueda debe aceptar términos parciales separados."
);

assert.deepEqual(
  searchCpuCatalog("modelo inexistente 999999", 10),
  { total: 0, items: [] },
  "Una búsqueda sin coincidencias no debe inventar procesadores."
);

for (const cpu of cpuCatalog) {
  const ownSearch = searchCpuCatalog(cpu.name, 10);
  assert.ok(
    ownSearch.items.some((candidate) => candidate.id === cpu.id),
    `Cada CPU debe poder encontrarse por su propio nombre: ${cpu.name}.`
  );
}

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
assert.ok(stored, "Los perfiles existentes deben seguir cargando.");
assert.equal(stored.cpuKnowledge, "confirmed");

const requirementsPageSource = readFileSync(
  new URL("../src/app/requisitos/page.tsx", import.meta.url),
  "utf8"
);
const unifiedHeroSource = readFileSync(
  new URL("../src/features/game-finder/GameFinderUnifiedHero.tsx", import.meta.url),
  "utf8"
);
const cpuAssistantSource = readFileSync(
  new URL("../src/features/game-finder/CpuIdentificationAssistant.tsx", import.meta.url),
  "utf8"
);
const cpuAssistantCss = readFileSync(
  new URL("../src/features/game-finder/CpuIdentificationAssistant.module.css", import.meta.url),
  "utf8"
);

assert.equal(
  requirementsPageSource.includes("CpuIdentificationAssistant"),
  false,
  "La página /requisitos no debe montar una ventana independiente de CPU."
);
assert.ok(
  unifiedHeroSource.includes("cpuConfirmationRequested") &&
    unifiedHeroSource.includes("handleDetect") &&
    unifiedHeroSource.includes("<CpuIdentificationAssistant"),
  "La selección exacta de CPU debe permanecer integrada al botón Detectar."
);
assert.ok(
  unifiedHeroSource.includes('hardware.cpuKnowledge !== "confirmed"'),
  "Una CPU ya confirmada no debe volver a pedir selección."
);
assert.ok(
  cpuAssistantSource.includes("searchCpuCatalog") &&
    cpuAssistantSource.includes("Confirmar CPU"),
  "La confirmación debe elegir explícitamente una CPU filtrada desde el catálogo."
);
assert.equal(
  /Get-CimInstance|PowerShell|WINDOWS_CPU_COMMAND|Pega el nombre exacto/i.test(
    cpuAssistantSource
  ),
  false,
  "El flujo de CPU no debe depender de comandos de Windows ni pegar nombres técnicos."
);
assert.ok(
  cpuAssistantSource.includes("createPortal") &&
    cpuAssistantSource.includes("document.body") &&
    cpuAssistantCss.includes("position: fixed") &&
    !cpuAssistantSource.includes("selectedCpu && ("),
  "La lista de CPUs debe ser un dropdown flotante que no cambie la altura del perfil."
);

console.log(
  `Detección de hardware: OK (${cpuCatalog.length} CPUs; búsqueda filtrable flotante, selección explícita, fuentes recientes, estimación por intervalos y propagación a FPS verificadas).`
);
