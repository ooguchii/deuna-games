import type { HardwarePart } from "./types";

export const cpuCatalog: HardwarePart[] = [
  { id: "ryzen-3-3200g", name: "AMD Ryzen 3 3200G", score: 26 },
  { id: "i5-7400", name: "Intel Core i5-7400", score: 30 },
  { id: "i5-8400", name: "Intel Core i5-8400", score: 38 },
  { id: "ryzen-5-2600", name: "AMD Ryzen 5 2600", score: 40 },
  { id: "i7-8700", name: "Intel Core i7-8700", score: 48 },
  { id: "ryzen-5-3600", name: "AMD Ryzen 5 3600", score: 52 },
  { id: "ryzen-5-5600g", name: "AMD Ryzen 5 5600G", score: 58 },
  { id: "i3-12100f", name: "Intel Core i3-12100F", score: 60 },
  { id: "ryzen-5-5600x", name: "AMD Ryzen 5 5600X", score: 65 },
  { id: "i5-12400f", name: "Intel Core i5-12400F", score: 67 },
  { id: "ryzen-7-5700x", name: "AMD Ryzen 7 5700X", score: 72 },
  { id: "i5-13400f", name: "Intel Core i5-13400F", score: 78 },
  { id: "ryzen-5-7600", name: "AMD Ryzen 5 7600", score: 85 },
  { id: "ryzen-7-7700", name: "AMD Ryzen 7 7700", score: 92 },
  { id: "i5-13600k", name: "Intel Core i5-13600K", score: 100 },
  { id: "i5-14600k", name: "Intel Core i5-14600K", score: 108 },
  { id: "ryzen-7-7800x3d", name: "AMD Ryzen 7 7800X3D", score: 125 },
];

export const gpuCatalog: HardwarePart[] = [
  { id: "intel-uhd-630", name: "Intel UHD Graphics 630", score: 8, integrated: true },
  { id: "radeon-vega-8", name: "AMD Radeon Vega 8", score: 17, integrated: true },
  { id: "radeon-vega-7", name: "AMD Radeon Vega 7", score: 20, integrated: true },
  { id: "intel-iris-xe", name: "Intel Iris Xe Graphics", score: 22, integrated: true },
  { id: "gtx-1050-ti", name: "NVIDIA GeForce GTX 1050 Ti", score: 28 },
  { id: "rx-570", name: "AMD Radeon RX 570", score: 34 },
  { id: "gtx-1650", name: "NVIDIA GeForce GTX 1650", score: 36 },
  { id: "rx-580", name: "AMD Radeon RX 580", score: 40 },
  { id: "gtx-1660-super", name: "NVIDIA GeForce GTX 1660 SUPER", score: 52 },
  { id: "rtx-2060", name: "NVIDIA GeForce RTX 2060", score: 58 },
  { id: "rx-6600", name: "AMD Radeon RX 6600", score: 72 },
  { id: "rtx-3060", name: "NVIDIA GeForce RTX 3060", score: 76 },
  { id: "rx-7600", name: "AMD Radeon RX 7600", score: 86 },
  { id: "rtx-4060", name: "NVIDIA GeForce RTX 4060", score: 90 },
  { id: "rtx-3070", name: "NVIDIA GeForce RTX 3070", score: 100 },
  { id: "rx-6700-xt", name: "AMD Radeon RX 6700 XT", score: 105 },
  { id: "rx-7700-xt", name: "AMD Radeon RX 7700 XT", score: 122 },
  { id: "rtx-4070", name: "NVIDIA GeForce RTX 4070", score: 128 },
  { id: "rx-7800-xt", name: "AMD Radeon RX 7800 XT", score: 140 },
  { id: "rtx-4080", name: "NVIDIA GeForce RTX 4080", score: 175 },
  { id: "rtx-4090", name: "NVIDIA GeForce RTX 4090", score: 210 },
];

const gpuAliases: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /uhd\s*(graphics\s*)?630/i, id: "intel-uhd-630" },
  { pattern: /vega\s*8/i, id: "radeon-vega-8" },
  { pattern: /vega\s*7/i, id: "radeon-vega-7" },
  { pattern: /iris\s*xe/i, id: "intel-iris-xe" },
  { pattern: /1050\s*ti/i, id: "gtx-1050-ti" },
  { pattern: /rx\s*570\b/i, id: "rx-570" },
  { pattern: /gtx\s*1650/i, id: "gtx-1650" },
  { pattern: /rx\s*580\b/i, id: "rx-580" },
  { pattern: /1660\s*(super|s)/i, id: "gtx-1660-super" },
  { pattern: /rtx\s*2060/i, id: "rtx-2060" },
  { pattern: /rx\s*6600\b/i, id: "rx-6600" },
  { pattern: /rtx\s*3060/i, id: "rtx-3060" },
  { pattern: /rx\s*7600\b/i, id: "rx-7600" },
  { pattern: /rtx\s*4060/i, id: "rtx-4060" },
  { pattern: /rtx\s*3070/i, id: "rtx-3070" },
  { pattern: /rx\s*6700\s*xt/i, id: "rx-6700-xt" },
  { pattern: /rx\s*7700\s*xt/i, id: "rx-7700-xt" },
  { pattern: /rtx\s*4070/i, id: "rtx-4070" },
  { pattern: /rx\s*7800\s*xt/i, id: "rx-7800-xt" },
  { pattern: /rtx\s*4080/i, id: "rtx-4080" },
  { pattern: /rtx\s*4090/i, id: "rtx-4090" },
];

export function findGpuByRenderer(renderer: string | null) {
  if (!renderer) return null;

  const alias = gpuAliases.find((item) => item.pattern.test(renderer));
  if (!alias) return null;

  return gpuCatalog.find((gpu) => gpu.id === alias.id) ?? null;
}

export function findCpuById(id: string) {
  return cpuCatalog.find((cpu) => cpu.id === id) ?? null;
}

export function findGpuById(id: string) {
  return gpuCatalog.find((gpu) => gpu.id === id) ?? null;
}

export function estimateCpuFromLogicalProcessors(logicalProcessors: number | null): HardwarePart | null {
  if (!logicalProcessors || logicalProcessors < 1) return null;

  let score = 24;

  if (logicalProcessors >= 4) score = 30;
  if (logicalProcessors >= 6) score = 38;
  if (logicalProcessors >= 8) score = 46;
  if (logicalProcessors >= 12) score = 58;
  if (logicalProcessors >= 16) score = 70;
  if (logicalProcessors >= 24) score = 86;
  if (logicalProcessors >= 32) score = 100;

  return {
    id: "browser-logical-cpu",
    name: `${logicalProcessors} hilos lógicos (modelo no visible)`,
    score,
  };
}
