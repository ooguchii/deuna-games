import {
  cpuCatalog as baseCpuCatalog,
  findCpuById as findBaseCpuById,
  findGpuById as findBaseGpuById,
  findGpuByRenderer,
  gpuCatalog as baseGpuCatalog,
} from "./hardware-catalog-base";
import {
  cpuCatalogExpansion,
  gpuCatalogExpansion,
} from "./hardware-catalog-expansion";
import type { HardwarePart } from "./types";

function composeHardwareCatalog(
  base: readonly HardwarePart[],
  expansion: readonly HardwarePart[]
): HardwarePart[] {
  return [...base, ...expansion].sort((a, b) =>
    a.name.localeCompare(b.name, "en", {
      numeric: true,
    })
  );
}

export const cpuCatalog = composeHardwareCatalog(
  baseCpuCatalog,
  cpuCatalogExpansion
);

export const gpuCatalog = composeHardwareCatalog(
  baseGpuCatalog,
  gpuCatalogExpansion
);

export { findGpuByRenderer };

type BrowserCpuBand = {
  minimumThreads: number;
  score: number;
  scoreMin: number;
  scoreMax: number;
};

/*
 * hardwareConcurrency no expone modelo, generación, IPC, frecuencia ni el
 * reparto P/E-core. Estos intervalos son deliberadamente anchos: el valor
 * central permite una orientación, mientras scoreMin/scoreMax evita tratar
 * dos CPUs con igual cantidad de hilos como si fueran equivalentes.
 */
const browserCpuBands: readonly BrowserCpuBand[] = [
  { minimumThreads: 64, score: 120, scoreMin: 70, scoreMax: 162 },
  { minimumThreads: 48, score: 108, scoreMin: 55, scoreMax: 162 },
  { minimumThreads: 40, score: 98, scoreMin: 45, scoreMax: 160 },
  { minimumThreads: 32, score: 86, scoreMin: 35, scoreMax: 155 },
  { minimumThreads: 24, score: 74, scoreMin: 28, scoreMax: 145 },
  { minimumThreads: 20, score: 67, scoreMin: 25, scoreMax: 138 },
  { minimumThreads: 16, score: 60, scoreMin: 22, scoreMax: 128 },
  { minimumThreads: 12, score: 50, scoreMin: 18, scoreMax: 108 },
  { minimumThreads: 8, score: 40, scoreMin: 14, scoreMax: 90 },
  { minimumThreads: 6, score: 32, scoreMin: 12, scoreMax: 74 },
  { minimumThreads: 4, score: 26, scoreMin: 9, scoreMax: 62 },
  { minimumThreads: 1, score: 20, scoreMin: 6, scoreMax: 48 },
];

export function estimateCpuFromLogicalProcessors(
  logicalProcessors: number | null
): HardwarePart | null {
  if (
    !logicalProcessors ||
    !Number.isFinite(logicalProcessors) ||
    logicalProcessors < 1
  ) {
    return null;
  }

  const normalizedThreads = Math.max(
    1,
    Math.floor(logicalProcessors)
  );
  const band =
    browserCpuBands.find(
      (candidate) =>
        normalizedThreads >= candidate.minimumThreads
    ) ?? browserCpuBands[browserCpuBands.length - 1];

  return {
    id: "browser-cpu-estimate",
    name: `CPU no identificada · ${normalizedThreads} hilos lógicos`,
    score: band.score,
    scoreMin: band.scoreMin,
    scoreMax: band.scoreMax,
  };
}

export function findCpuById(id: string) {
  return (
    findBaseCpuById(id) ??
    cpuCatalog.find((cpu) => cpu.id === id) ??
    null
  );
}

export function findGpuById(id: string) {
  return (
    findBaseGpuById(id) ??
    gpuCatalog.find((gpu) => gpu.id === id) ??
    null
  );
}
