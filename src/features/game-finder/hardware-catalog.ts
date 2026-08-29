import {
  cpuCatalog as baseCpuCatalog,
  estimateCpuFromLogicalProcessors,
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

export { estimateCpuFromLogicalProcessors, findGpuByRenderer };

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
