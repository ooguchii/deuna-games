import type { HardwarePart } from "./types";

/*
 * Los scores son una escala interna de equivalencia usada por el modelo de
 * FPS. No son puntos de PassMark/3DMark ni deben mostrarse al usuario como
 * un benchmark real. Se mantienen centralizados para poder recalibrarlos sin
 * cambiar la interfaz ni el formato de los perfiles guardados.
 */
export const cpuCatalog: HardwarePart[] = [
  { id: "athlon-3000g", name: "AMD Athlon 3000G", score: 18 },
  { id: "ryzen-3-2200g", name: "AMD Ryzen 3 2200G", score: 22 },
  { id: "i5-6500", name: "Intel Core i5-6500", score: 24 },
  { id: "ryzen-3-3200g", name: "AMD Ryzen 3 3200G", score: 26 },
  { id: "i5-7400", name: "Intel Core i5-7400", score: 30 },
  { id: "ryzen-5-1600", name: "AMD Ryzen 5 1600", score: 32 },
  { id: "i5-8400", name: "Intel Core i5-8400", score: 38 },
  { id: "ryzen-5-2600", name: "AMD Ryzen 5 2600", score: 40 },
  { id: "i3-10100f", name: "Intel Core i3-10100F", score: 44 },
  { id: "i5-10400f", name: "Intel Core i5-10400F", score: 46 },
  { id: "ryzen-5-4500", name: "AMD Ryzen 5 4500", score: 47 },
  { id: "i7-8700", name: "Intel Core i7-8700", score: 48 },
  { id: "ryzen-5-3600", name: "AMD Ryzen 5 3600", score: 52 },
  { id: "ryzen-5-5500", name: "AMD Ryzen 5 5500", score: 53 },
  { id: "i5-11400f", name: "Intel Core i5-11400F", score: 55 },
  { id: "ryzen-5-5600g", name: "AMD Ryzen 5 5600G", score: 58 },
  { id: "i3-12100f", name: "Intel Core i3-12100F", score: 60 },
  { id: "ryzen-5-5600", name: "AMD Ryzen 5 5600", score: 63 },
  { id: "ryzen-7-5700g", name: "AMD Ryzen 7 5700G", score: 64 },
  { id: "ryzen-5-5600x", name: "AMD Ryzen 5 5600X", score: 65 },
  { id: "i5-12400f", name: "Intel Core i5-12400F", score: 67 },
  { id: "ryzen-7-5700x", name: "AMD Ryzen 7 5700X", score: 72 },
  { id: "i5-12600k", name: "Intel Core i5-12600K", score: 76 },
  { id: "i5-13400f", name: "Intel Core i5-13400F", score: 78 },
  { id: "ryzen-7-5800x", name: "AMD Ryzen 7 5800X", score: 80 },
  { id: "i5-14400f", name: "Intel Core i5-14400F", score: 82 },
  { id: "ryzen-5-7500f", name: "AMD Ryzen 5 7500F", score: 82 },
  { id: "ryzen-5-7600", name: "AMD Ryzen 5 7600", score: 85 },
  { id: "ryzen-5-7600x", name: "AMD Ryzen 5 7600X", score: 88 },
  { id: "i7-12700k", name: "Intel Core i7-12700K", score: 88 },
  { id: "ryzen-7-7700", name: "AMD Ryzen 7 7700", score: 92 },
  { id: "ryzen-7-5800x3d", name: "AMD Ryzen 7 5800X3D", score: 96 },
  { id: "i5-13600k", name: "Intel Core i5-13600K", score: 100 },
  { id: "ryzen-7-7700x", name: "AMD Ryzen 7 7700X", score: 102 },
  { id: "i5-14600k", name: "Intel Core i5-14600K", score: 108 },
  { id: "ryzen-7-9700x", name: "AMD Ryzen 7 9700X", score: 110 },
  { id: "i7-13700k", name: "Intel Core i7-13700K", score: 112 },
  { id: "i7-14700k", name: "Intel Core i7-14700K", score: 120 },
  { id: "ryzen-7-7800x3d", name: "AMD Ryzen 7 7800X3D", score: 125 },
  { id: "ryzen-9-7900x", name: "AMD Ryzen 9 7900X", score: 128 },
  { id: "ryzen-9-7950x3d", name: "AMD Ryzen 9 7950X3D", score: 138 },
  { id: "ryzen-7-9800x3d", name: "AMD Ryzen 7 9800X3D", score: 145 },
];

export const gpuCatalog: HardwarePart[] = [
  { id: "intel-uhd-630", name: "Intel UHD Graphics 630", score: 8, integrated: true },
  { id: "gt-1030", name: "NVIDIA GeForce GT 1030", score: 10 },
  { id: "radeon-vega-6", name: "AMD Radeon Vega 6", score: 14, integrated: true },
  { id: "radeon-vega-8", name: "AMD Radeon Vega 8", score: 17, integrated: true },
  { id: "radeon-vega-7", name: "AMD Radeon Vega 7", score: 20, integrated: true },
  { id: "intel-iris-xe", name: "Intel Iris Xe Graphics", score: 22, integrated: true },
  { id: "radeon-680m", name: "AMD Radeon 680M", score: 28, integrated: true },
  { id: "gtx-1050-ti", name: "NVIDIA GeForce GTX 1050 Ti", score: 28 },
  { id: "rx-570", name: "AMD Radeon RX 570", score: 34 },
  { id: "gtx-1060-6gb", name: "NVIDIA GeForce GTX 1060 6GB", score: 35 },
  { id: "gtx-1650", name: "NVIDIA GeForce GTX 1650", score: 36 },
  { id: "radeon-780m", name: "AMD Radeon 780M", score: 36, integrated: true },
  { id: "rx-6500-xt", name: "AMD Radeon RX 6500 XT", score: 38 },
  { id: "rx-580", name: "AMD Radeon RX 580", score: 40 },
  { id: "rx-5500-xt", name: "AMD Radeon RX 5500 XT", score: 42 },
  { id: "gtx-1070", name: "NVIDIA GeForce GTX 1070", score: 45 },
  { id: "rtx-3050", name: "NVIDIA GeForce RTX 3050", score: 48 },
  { id: "gtx-1660-super", name: "NVIDIA GeForce GTX 1660 SUPER", score: 52 },
  { id: "gtx-1080", name: "NVIDIA GeForce GTX 1080", score: 52 },
  { id: "rx-5600-xt", name: "AMD Radeon RX 5600 XT", score: 54 },
  { id: "rtx-2060", name: "NVIDIA GeForce RTX 2060", score: 58 },
  { id: "gtx-1080-ti", name: "NVIDIA GeForce GTX 1080 Ti", score: 62 },
  { id: "rx-5700-xt", name: "AMD Radeon RX 5700 XT", score: 65 },
  { id: "rtx-2070-super", name: "NVIDIA GeForce RTX 2070 SUPER", score: 68 },
  { id: "rx-6600", name: "AMD Radeon RX 6600", score: 72 },
  { id: "arc-a750", name: "Intel Arc A750", score: 72 },
  { id: "rtx-3060", name: "NVIDIA GeForce RTX 3060", score: 76 },
  { id: "rx-6650-xt", name: "AMD Radeon RX 6650 XT", score: 78 },
  { id: "arc-a770", name: "Intel Arc A770", score: 82 },
  { id: "rx-7600", name: "AMD Radeon RX 7600", score: 86 },
  { id: "arc-b580", name: "Intel Arc B580", score: 88 },
  { id: "rtx-3060-ti", name: "NVIDIA GeForce RTX 3060 Ti", score: 88 },
  { id: "rtx-4060", name: "NVIDIA GeForce RTX 4060", score: 90 },
  { id: "rtx-2080-ti", name: "NVIDIA GeForce RTX 2080 Ti", score: 90 },
  { id: "rtx-3070", name: "NVIDIA GeForce RTX 3070", score: 100 },
  { id: "rtx-4060-ti", name: "NVIDIA GeForce RTX 4060 Ti", score: 105 },
  { id: "rx-6700-xt", name: "AMD Radeon RX 6700 XT", score: 105 },
  { id: "rx-6750-xt", name: "AMD Radeon RX 6750 XT", score: 112 },
  { id: "rtx-3080", name: "NVIDIA GeForce RTX 3080", score: 115 },
  { id: "rx-6800", name: "AMD Radeon RX 6800", score: 118 },
  { id: "rx-7700-xt", name: "AMD Radeon RX 7700 XT", score: 122 },
  { id: "rtx-3090", name: "NVIDIA GeForce RTX 3090", score: 125 },
  { id: "rtx-4070", name: "NVIDIA GeForce RTX 4070", score: 128 },
  { id: "rx-6800-xt", name: "AMD Radeon RX 6800 XT", score: 135 },
  { id: "rx-7800-xt", name: "AMD Radeon RX 7800 XT", score: 140 },
  { id: "rtx-4070-super", name: "NVIDIA GeForce RTX 4070 SUPER", score: 145 },
  { id: "rx-6900-xt", name: "AMD Radeon RX 6900 XT", score: 145 },
  { id: "rx-7900-gre", name: "AMD Radeon RX 7900 GRE", score: 145 },
  { id: "rtx-4070-ti-super", name: "NVIDIA GeForce RTX 4070 Ti SUPER", score: 165 },
  { id: "rx-7900-xt", name: "AMD Radeon RX 7900 XT", score: 165 },
  { id: "rtx-5070", name: "NVIDIA GeForce RTX 5070", score: 165 },
  { id: "rx-9070", name: "AMD Radeon RX 9070", score: 170 },
  { id: "rtx-4080", name: "NVIDIA GeForce RTX 4080", score: 175 },
  { id: "rtx-4080-super", name: "NVIDIA GeForce RTX 4080 SUPER", score: 185 },
  { id: "rx-7900-xtx", name: "AMD Radeon RX 7900 XTX", score: 185 },
  { id: "rtx-5070-ti", name: "NVIDIA GeForce RTX 5070 Ti", score: 195 },
  { id: "rx-9070-xt", name: "AMD Radeon RX 9070 XT", score: 195 },
  { id: "rtx-4090", name: "NVIDIA GeForce RTX 4090", score: 210 },
  { id: "rtx-5080", name: "NVIDIA GeForce RTX 5080", score: 235 },
  { id: "rtx-5090", name: "NVIDIA GeForce RTX 5090", score: 320 },
];

const gpuAliases: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /uhd\s*(graphics\s*)?630/i, id: "intel-uhd-630" },
  { pattern: /iris\s*xe/i, id: "intel-iris-xe" },
  { pattern: /radeon\s*780m/i, id: "radeon-780m" },
  { pattern: /radeon\s*680m/i, id: "radeon-680m" },
  { pattern: /vega\s*8/i, id: "radeon-vega-8" },
  { pattern: /vega\s*7/i, id: "radeon-vega-7" },
  { pattern: /vega\s*6/i, id: "radeon-vega-6" },
  { pattern: /gt\s*1030/i, id: "gt-1030" },
  { pattern: /1050\s*ti/i, id: "gtx-1050-ti" },
  { pattern: /1060[^\d]*(6\s*gb|6144)/i, id: "gtx-1060-6gb" },
  { pattern: /gtx\s*1070/i, id: "gtx-1070" },
  { pattern: /1080\s*ti/i, id: "gtx-1080-ti" },
  { pattern: /gtx\s*1080/i, id: "gtx-1080" },
  { pattern: /gtx\s*1650/i, id: "gtx-1650" },
  { pattern: /1660\s*(super|s)/i, id: "gtx-1660-super" },
  { pattern: /rtx\s*2060/i, id: "rtx-2060" },
  { pattern: /2070\s*super/i, id: "rtx-2070-super" },
  { pattern: /2080\s*ti/i, id: "rtx-2080-ti" },
  { pattern: /rtx\s*3050/i, id: "rtx-3050" },
  { pattern: /3060\s*ti/i, id: "rtx-3060-ti" },
  { pattern: /rtx\s*3060/i, id: "rtx-3060" },
  { pattern: /rtx\s*3070/i, id: "rtx-3070" },
  { pattern: /rtx\s*3080/i, id: "rtx-3080" },
  { pattern: /rtx\s*3090/i, id: "rtx-3090" },
  { pattern: /4060\s*ti/i, id: "rtx-4060-ti" },
  { pattern: /rtx\s*4060/i, id: "rtx-4060" },
  { pattern: /4070\s*ti\s*super/i, id: "rtx-4070-ti-super" },
  { pattern: /4070\s*super/i, id: "rtx-4070-super" },
  { pattern: /rtx\s*4070/i, id: "rtx-4070" },
  { pattern: /4080\s*super/i, id: "rtx-4080-super" },
  { pattern: /rtx\s*4080/i, id: "rtx-4080" },
  { pattern: /rtx\s*4090/i, id: "rtx-4090" },
  { pattern: /5070\s*ti/i, id: "rtx-5070-ti" },
  { pattern: /rtx\s*5070/i, id: "rtx-5070" },
  { pattern: /rtx\s*5080/i, id: "rtx-5080" },
  { pattern: /rtx\s*5090/i, id: "rtx-5090" },
  { pattern: /rx\s*5500\s*xt/i, id: "rx-5500-xt" },
  { pattern: /rx\s*5600\s*xt/i, id: "rx-5600-xt" },
  { pattern: /rx\s*5700\s*xt/i, id: "rx-5700-xt" },
  { pattern: /rx\s*570\b/i, id: "rx-570" },
  { pattern: /rx\s*580\b/i, id: "rx-580" },
  { pattern: /rx\s*6500\s*xt/i, id: "rx-6500-xt" },
  { pattern: /rx\s*6650\s*xt/i, id: "rx-6650-xt" },
  { pattern: /rx\s*6600\b/i, id: "rx-6600" },
  { pattern: /rx\s*6750\s*xt/i, id: "rx-6750-xt" },
  { pattern: /rx\s*6700\s*xt/i, id: "rx-6700-xt" },
  { pattern: /rx\s*6800\s*xt/i, id: "rx-6800-xt" },
  { pattern: /rx\s*6800\b/i, id: "rx-6800" },
  { pattern: /rx\s*6900\s*xt/i, id: "rx-6900-xt" },
  { pattern: /rx\s*7600\b/i, id: "rx-7600" },
  { pattern: /rx\s*7700\s*xt/i, id: "rx-7700-xt" },
  { pattern: /rx\s*7800\s*xt/i, id: "rx-7800-xt" },
  { pattern: /rx\s*7900\s*gre/i, id: "rx-7900-gre" },
  { pattern: /rx\s*7900\s*xtx/i, id: "rx-7900-xtx" },
  { pattern: /rx\s*7900\s*xt/i, id: "rx-7900-xt" },
  { pattern: /rx\s*9070\s*xt/i, id: "rx-9070-xt" },
  { pattern: /rx\s*9070\b/i, id: "rx-9070" },
  { pattern: /arc\s*a750/i, id: "arc-a750" },
  { pattern: /arc\s*a770/i, id: "arc-a770" },
  { pattern: /arc\s*b580/i, id: "arc-b580" },
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

  // Este score es deliberadamente conservador: la cantidad de hilos no
  // identifica la generación ni el IPC de una CPU y algunos navegadores la
  // reducen por privacidad. Sirve solo como proxy automático de baja confianza.
  let score = 20;

  if (logicalProcessors >= 4) score = 26;
  if (logicalProcessors >= 6) score = 32;
  if (logicalProcessors >= 8) score = 40;
  if (logicalProcessors >= 12) score = 50;
  if (logicalProcessors >= 16) score = 60;
  if (logicalProcessors >= 24) score = 72;
  if (logicalProcessors >= 32) score = 82;

  return {
    id: "browser-logical-cpu",
    name: `${logicalProcessors} hilos lógicos (modelo no visible)`,
    score,
  };
}
