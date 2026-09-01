import {
  findGpuByRenderer,
  gpuCatalog,
} from "./hardware-catalog";
import type { HardwarePart } from "./types";

export type GpuRendererMatch = {
  gpu: HardwarePart;
  confidence: number;
  matchedTokens: number;
  totalTokens: number;
};

const genericIdTokens = new Set([
  "extra",
  "amd",
  "nvidia",
  "intel",
  "radeon",
  "geforce",
  "graphics",
  "gpu",
]);

const familyTokens = new Set([
  "rtx",
  "gtx",
  "gt",
  "rx",
  "arc",
  "vega",
  "uhd",
  "iris",
  "r9",
  "r7",
  "r5",
  "quadro",
]);

const variantTokens = new Set([
  "ti",
  "super",
  "xt",
  "xtx",
  "gre",
]);

function normalizeRenderer(value: string) {
  return value
    .toLowerCase()
    .replace(/[™®©]/g, " ")
    .replace(/\(tm\)|\(r\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTokens(gpu: HardwarePart) {
  return gpu.id
    .toLowerCase()
    .split("-")
    .filter(Boolean)
    .filter((token) => !genericIdTokens.has(token));
}

function tokenMatch(
  rendererTokens: Set<string>,
  gpu: HardwarePart
): GpuRendererMatch | null {
  const tokens = searchTokens(gpu);
  if (!tokens.length) return null;

  const modelTokens = tokens.filter((token) => /\d/.test(token));
  if (
    modelTokens.length > 0 &&
    !modelTokens.some((token) => rendererTokens.has(token))
  ) {
    return null;
  }

  const gpuFamilyTokens = tokens.filter((token) => familyTokens.has(token));
  if (
    gpuFamilyTokens.length > 0 &&
    !gpuFamilyTokens.some((token) => rendererTokens.has(token))
  ) {
    return null;
  }

  // No convertimos una variante distinta en la más parecida del catálogo.
  // Ej.: una 1660 Ti no debe transformarse en 1660 SUPER, ni una RX base en XT.
  const requiredVariantTokens = tokens.filter(
    (token) =>
      variantTokens.has(token) ||
      /^\d+gb$/.test(token)
  );

  if (
    requiredVariantTokens.some(
      (token) => !rendererTokens.has(token)
    )
  ) {
    return null;
  }

  const matchedTokens = tokens.filter((token) => rendererTokens.has(token)).length;
  const ratio = matchedTokens / tokens.length;

  if (ratio < 0.64) return null;

  return {
    gpu,
    confidence: Math.min(0.99, 0.72 + ratio * 0.27),
    matchedTokens,
    totalTokens: tokens.length,
  };
}

function preferMatch(
  a: GpuRendererMatch,
  b: GpuRendererMatch
) {
  const aDiscrete = !a.gpu.integrated;
  const bDiscrete = !b.gpu.integrated;

  if (aDiscrete !== bDiscrete) {
    const discrete = aDiscrete ? a : b;
    const integrated = aDiscrete ? b : a;

    // Una dedicada con una coincidencia fuerte tiene prioridad aunque la
    // cadena también mencione una integrada. Evita elegir la iGPU sólo porque
    // su alias aparezca primero en un renderer compuesto de ANGLE/WebGL.
    if (
      discrete.confidence >= 0.86 &&
      discrete.confidence >= integrated.confidence - 0.14
    ) {
      return aDiscrete ? -1 : 1;
    }
  }

  if (a.confidence !== b.confidence) {
    return b.confidence - a.confidence;
  }

  if (a.matchedTokens !== b.matchedTokens) {
    return b.matchedTokens - a.matchedTokens;
  }

  if (a.totalTokens !== b.totalTokens) {
    return b.totalTokens - a.totalTokens;
  }

  if (a.gpu.integrated !== b.gpu.integrated) {
    return a.gpu.integrated ? 1 : -1;
  }

  return b.gpu.score - a.gpu.score;
}

export function matchGpuRenderer(
  renderer: string | null
): GpuRendererMatch | null {
  if (!renderer?.trim()) return null;

  const normalized = normalizeRenderer(renderer);
  if (!normalized) return null;

  const rendererTokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const candidates = new Map<string, GpuRendererMatch>();

  const legacyMatch = findGpuByRenderer(renderer);
  if (legacyMatch) {
    candidates.set(legacyMatch.id, {
      gpu: legacyMatch,
      confidence: 0.96,
      matchedTokens: searchTokens(legacyMatch).length,
      totalTokens: searchTokens(legacyMatch).length,
    });
  }

  for (const gpu of gpuCatalog) {
    const match = tokenMatch(rendererTokens, gpu);
    if (!match) continue;

    const previous = candidates.get(gpu.id);
    if (!previous || match.confidence > previous.confidence) {
      candidates.set(gpu.id, match);
    }
  }

  return [...candidates.values()].sort(preferMatch)[0] ?? null;
}
