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
 * Las calibraciones de FPS no forman parte del fixture factual bundled.
 * Un valor de referenceFps sólo es válido cuando fue cargado/publicado con una
 * metodología y una procedencia editorial explícitas. Mantener números de
 * demostración aquí hacía que Finder los presentara con precisión aparente.
 *
 * Se conserva el array literal para que check-data pueda validar cualquier
 * calibración estática que se agregue deliberadamente en el futuro, pero la
 * fuente normal de verdad es el snapshot editorial publicado.
 */
const profiles: GamePerformanceProfile[] = [];

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
  explicitCalibration?: GamePerformanceCalibration
): GamePerformanceProfile | null {
  const calibration =
    explicitCalibration ?? browserPublishedCalibration(slug);

  if (calibration) {
    return {
      slug,
      referenceFps: calibration.referenceFps,
      ramGb: calibration.ramGb,
      fpsCap: calibration.fpsCap,
    };
  }

  return profileMap.get(slug) ?? null;
}

export function getPerformanceProfile(
  slug: string
): GamePerformanceProfile | null {
  /*
   * Compatibilidad para consumidores auxiliares. A diferencia del contrato
   * anterior, la ausencia de una calibración estática es información real y
   * se representa con null; nunca se fabrica un perfil de reserva.
   */
  return profileMap.get(slug) ?? null;
}
