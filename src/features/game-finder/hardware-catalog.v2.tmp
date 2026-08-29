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

function mergeHardwareCatalog(
  base: readonly HardwarePart[],
  expansion: readonly HardwarePart[]
): HardwarePart[] {
  const merged = [...base];
  const ids = new Set(merged.map((part) => part.id));
  const names = new Set(
    merged.map((part) => part.name.toLowerCase())
  );

  for (const part of expansion) {
    const normalizedName = part.name.toLowerCase();

    if (ids.has(part.id) || names.has(normalizedName)) {
      continue;
    }

    merged.push(part);
    ids.add(part.id);
    names.add(normalizedName);
  }

  return merged.sort((a, b) =>
    a.name.localeCompare(b.name, "en", {
      numeric: true,
    })
  );
}

export const cpuCatalog = mergeHardwareCatalog(
  baseCpuCatalog,
  cpuCatalogExpansion
);

export const gpuCatalog = mergeHardwareCatalog(
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
