import type {
  GamePerformanceCalibration,
} from "@/types/game";

import type { GamePerformanceProfile } from "./types";

export const performanceModelReference = {
  version: "2026.08.1",
  resolution: "1080p",
  quality: "medium",
  cpuId: "ryzen-5-5600x",
  gpuId: "rtx-3060",
  ramGb: 16,
} as const;

/*
 * Los FPS de referencia modelan el escenario declarado en
 * performanceModelReference: 1080p / calidad media / rasterización,
 * sin ray tracing, frame generation ni escalado.
 *
 * Esto no pretende sustituir un benchmark ejecutado en la PC del usuario.
 * El motor usa estos anclajes para producir una estimación consistente y
 * explícitamente orientativa que luego podremos recalibrar con una base de
 * benchmarks versionada.
 */
const profiles: GamePerformanceProfile[] = [
  { slug: "dragon-ball-sparking-zero", referenceFps: 86, ramGb: 8, storageGb: 29, cpuWeight: 0.3, gpuWeight: 0.7, optimization: 0.96 },
  { slug: "god-of-war-ragnarok", referenceFps: 68, ramGb: 16, storageGb: 190, cpuWeight: 0.28, gpuWeight: 0.72, optimization: 0.95 },
  { slug: "elden-ring", referenceFps: 60, ramGb: 12, storageGb: 60, fpsCap: 60, cpuWeight: 0.34, gpuWeight: 0.66, optimization: 1 },
  { slug: "forza-horizon-5", referenceFps: 92, ramGb: 8, storageGb: 110, cpuWeight: 0.26, gpuWeight: 0.74, optimization: 1.04 },
  { slug: "resident-evil-4", referenceFps: 84, ramGb: 8, storageGb: 67, cpuWeight: 0.25, gpuWeight: 0.75, optimization: 1.02 },
  { slug: "hogwarts-legacy", referenceFps: 62, ramGb: 16, storageGb: 85, cpuWeight: 0.3, gpuWeight: 0.7, optimization: 0.94 },
  { slug: "cyberpunk-2077", referenceFps: 60, ramGb: 12, storageGb: 70, cpuWeight: 0.27, gpuWeight: 0.73, optimization: 0.96 },
  { slug: "baldurs-gate-3", referenceFps: 88, ramGb: 8, storageGb: 150, cpuWeight: 0.4, gpuWeight: 0.6, optimization: 1 },
  { slug: "red-dead-redemption-2", referenceFps: 72, ramGb: 12, storageGb: 150, cpuWeight: 0.27, gpuWeight: 0.73, optimization: 0.97 },
  { slug: "lies-of-p", referenceFps: 102, ramGb: 8, storageGb: 50, cpuWeight: 0.25, gpuWeight: 0.75, optimization: 1.04 },
  { slug: "armored-core-vi", referenceFps: 92, ramGb: 12, storageGb: 60, fpsCap: 120, cpuWeight: 0.32, gpuWeight: 0.68, optimization: 1 },
  { slug: "stellar-blade", referenceFps: 76, ramGb: 16, storageGb: 75, cpuWeight: 0.27, gpuWeight: 0.73, optimization: 0.98 },
  { slug: "palworld", referenceFps: 72, ramGb: 16, storageGb: 40, cpuWeight: 0.38, gpuWeight: 0.62, optimization: 0.92 },
  { slug: "enshrouded", referenceFps: 60, ramGb: 16, storageGb: 60, cpuWeight: 0.34, gpuWeight: 0.66, optimization: 0.91 },
  { slug: "helldivers-2", referenceFps: 68, ramGb: 16, storageGb: 100, cpuWeight: 0.36, gpuWeight: 0.64, optimization: 0.94 },
  { slug: "the-talos-principle-2", referenceFps: 74, ramGb: 8, storageGb: 75, cpuWeight: 0.26, gpuWeight: 0.74, optimization: 0.96 },
  { slug: "minecraft-java-edition", referenceFps: 220, ramGb: 4, storageGb: 2, cpuWeight: 0.68, gpuWeight: 0.32, optimization: 1.05 },
  { slug: "left-4-dead-2", referenceFps: 260, ramGb: 2, storageGb: 13, fpsCap: 300, cpuWeight: 0.56, gpuWeight: 0.44, optimization: 1.05 },
  { slug: "gta-san-andreas", referenceFps: 300, ramGb: 2, storageGb: 5, fpsCap: 300, cpuWeight: 0.62, gpuWeight: 0.38, optimization: 1 },
  { slug: "terraria", referenceFps: 240, ramGb: 2, storageGb: 1, fpsCap: 300, cpuWeight: 0.72, gpuWeight: 0.28, optimization: 1 },
  { slug: "half-life-2", referenceFps: 300, ramGb: 2, storageGb: 7, fpsCap: 300, cpuWeight: 0.58, gpuWeight: 0.42, optimization: 1 },
  { slug: "portal-2", referenceFps: 240, ramGb: 2, storageGb: 8, fpsCap: 300, cpuWeight: 0.54, gpuWeight: 0.46, optimization: 1 },
  { slug: "stardew-valley", referenceFps: 60, ramGb: 2, storageGb: 1, fpsCap: 60, cpuWeight: 0.72, gpuWeight: 0.28, optimization: 1 },
];

const profileMap = new Map(profiles.map((profile) => [profile.slug, profile]));
const browserRegistryId = "deuna-performance-calibrations";
let browserRegistrySource: string | null = null;
let browserRegistry = new Map<string, GamePerformanceCalibration>();

function validCalibration(
  value: unknown
): value is GamePerformanceCalibration {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const referenceFps = candidate.referenceFps;
  const ramGb = candidate.ramGb;
  const fpsCap = candidate.fpsCap;

  return Boolean(
    typeof referenceFps === "number" &&
      Number.isFinite(referenceFps) &&
      referenceFps > 0 &&
      referenceFps <= 1_000 &&
      typeof ramGb === "number" &&
      Number.isFinite(ramGb) &&
      ramGb > 0 &&
      ramGb <= 512 &&
      (
        fpsCap === undefined ||
        (
          typeof fpsCap === "number" &&
          Number.isFinite(fpsCap) &&
          fpsCap > 0 &&
          fpsCap <= 1_000 &&
          fpsCap >= referenceFps
        )
      )
  );
}

function browserPublishedCalibration(
  slug: string
): GamePerformanceCalibration | undefined {
  if (typeof document === "undefined") return undefined;

  const source =
    document.getElementById(browserRegistryId)?.textContent ?? "";

  if (source !== browserRegistrySource) {
    browserRegistrySource = source;
    const next = new Map<string, GamePerformanceCalibration>();

    try {
      const parsed = JSON.parse(source) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (
            /^[a-z0-9][a-z0-9._-]{0,159}$/.test(key) &&
            validCalibration(value)
          ) {
            next.set(key, value);
          }
        }
      }
    } catch {
      // Un registro ausente o manipulado sólo desactiva el fallback editorial.
    }

    browserRegistry = next;
  }

  return browserRegistry.get(slug);
}

export function resolvePerformanceProfile(
  slug: string,
  calibration?: GamePerformanceCalibration
): GamePerformanceProfile | null {
  const editorialCalibration =
    calibration ?? browserPublishedCalibration(slug);

  if (editorialCalibration) {
    return {
      slug,
      referenceFps: editorialCalibration.referenceFps,
      ramGb: editorialCalibration.ramGb,
      fpsCap: editorialCalibration.fpsCap,
    };
  }

  return profileMap.get(slug) ?? null;
}

export function getPerformanceProfile(slug: string): GamePerformanceProfile {
  /*
   * Acceso de compatibilidad para vistas antiguas que sólo consultan datos
   * auxiliares como storageGb. Un slug editorial nuevo no debe derribar la
   * ficha pública. El motor de FPS usa resolvePerformanceProfile y distingue
   * explícitamente la ausencia de calibración.
   */
  return resolvePerformanceProfile(slug) ?? {
    slug,
    referenceFps: 0,
    ramGb: 1,
  };
}
