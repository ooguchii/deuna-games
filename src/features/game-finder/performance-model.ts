import type {
  GamePerformanceCalibration,
} from "@/types/game";

import {
  performanceModelReference,
  resolvePerformanceProfile,
} from "./performance-data";
import {
  findCpuById,
  findGpuById,
} from "./hardware-catalog";
import type {
  ConfidenceLevel,
  CpuKnowledge,
  EstimateSettings,
  GameEstimate,
  HardwarePart,
  HardwareProfile,
  PerformanceTier,
  QualityPreset,
  RamKnowledge,
  ResolutionPreset,
} from "./types";

function requireReferenceScore(
  part: HardwarePart | null,
  label: string
) {
  if (!part) {
    throw new Error(
      `${label} de referencia del modelo no existe en el catálogo.`
    );
  }

  return part.score;
}

const referenceCpuScore = requireReferenceScore(
  findCpuById(performanceModelReference.cpuId),
  "La CPU"
);
const referenceGpuScore = requireReferenceScore(
  findGpuById(performanceModelReference.gpuId),
  "La GPU"
);

const resolutionFactor: Record<ResolutionPreset, number> = {
  "720p": 1.45,
  "1080p": 1,
  "1440p": 0.72,
  "2160p": 0.42,
};

const qualityFactor: Record<QualityPreset, number> = {
  low: 1.28,
  medium: 1,
  high: 0.82,
  ultra: 0.68,
};

const estimateSpread: Record<ConfidenceLevel, number> = {
  high: 0.18,
  medium: 0.25,
  low: 0.34,
};

export function getPerformanceTier(fps: number): PerformanceTier {
  if (fps >= 60) return "excellent";
  if (fps >= 40) return "good";
  if (fps >= 28) return "acceptable";
  return "basic";
}

function roundFps(value: number) {
  if (value >= 120) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function ramPenaltyFromRatio(ratio: number) {
  return ratio >= 1
    ? 1
    : Math.max(0.52, 0.58 + ratio * 0.42);
}

function ramUncertainty(
  ramRatio: number,
  knowledge: RamKnowledge
) {
  const observedPenalty = ramPenaltyFromRatio(ramRatio);

  if (knowledge !== "lower-bound") {
    return {
      centerPenalty: observedPenalty,
      lowRangeFactor: 1,
      highRangeFactor: 1,
    };
  }

  // deviceMemory=8 puede significar 8 GB o más. En ese caso no elegimos
  // arbitrariamente uno de los extremos: centramos la estimación entre el
  // escenario observado y uno sin penalización por RAM, y ensanchamos el
  // rango para cubrir ambos.
  const bestCasePenalty = 1;
  const centerPenalty = (observedPenalty + bestCasePenalty) / 2;

  return {
    centerPenalty,
    lowRangeFactor: observedPenalty / centerPenalty,
    highRangeFactor: bestCasePenalty / centerPenalty,
  };
}

function cpuKnowledgeOf(
  hardware: HardwareProfile
): CpuKnowledge {
  if (hardware.cpuKnowledge) {
    return hardware.cpuKnowledge;
  }

  if (!hardware.cpu) return "unknown";

  if (
    hardware.source === "manual" ||
    hardware.source === "saved" ||
    hardware.source === "example"
  ) {
    return "confirmed";
  }

  return hardware.cpu.id === "browser-cpu-estimate"
    ? "estimated"
    : "unknown";
}

function adjustedGpuRatio(
  hardware: HardwareProfile
) {
  if (!hardware.gpu) return 0;

  let ratio = hardware.gpu.score / referenceGpuScore;
  if (hardware.gpu.integrated) {
    if (hardware.memoryMode === "single") ratio *= 0.75;
    if (hardware.memoryMode === "unknown") ratio *= 0.87;
  }
  return ratio;
}

function corePerformanceFactor(
  cpuRatio: number,
  gpuRatio: number,
  cpuWeight: number,
  gpuWeight: number
) {
  const weightedCore =
    Math.pow(Math.max(cpuRatio, 0.15), cpuWeight) *
    Math.pow(Math.max(gpuRatio, 0.1), gpuWeight);

  const limitingRatio = Math.min(
    cpuRatio * 1.08,
    gpuRatio * 1.16,
    1.45
  );
  const bottleneckCorrection =
    0.74 + 0.26 * Math.min(1, Math.max(0.3, limitingRatio));

  return weightedCore * bottleneckCorrection;
}

export function estimateGamePerformance(
  slug: string,
  hardware: HardwareProfile,
  settings: EstimateSettings,
  calibration?: GamePerformanceCalibration
): GameEstimate {
  const profile = resolvePerformanceProfile(
    slug,
    calibration
  );

  if (!profile) {
    return {
      slug,
      fps: 0,
      minFps: 0,
      maxFps: 0,
      tier: "basic",
      confidence: "low",
      bottleneck: "balanced",
      canEstimate: false,
      reason:
        "Este juego todavía no tiene una calibración de rendimiento publicada.",
    };
  }

  if (!hardware.cpu || !hardware.gpu || !hardware.ramGb) {
    return {
      slug,
      fps: 0,
      minFps: 0,
      maxFps: 0,
      tier: "basic",
      confidence: "low",
      bottleneck: "balanced",
      canEstimate: false,
      reason: "Faltan CPU, GPU o RAM para calcular una estimación útil.",
    };
  }

  const cpuKnowledge = cpuKnowledgeOf(hardware);
  const cpuRatio = hardware.cpu.score / referenceCpuScore;
  const cpuMinRatio =
    (hardware.cpu.scoreMin ?? hardware.cpu.score) /
    referenceCpuScore;
  const cpuMaxRatio =
    (hardware.cpu.scoreMax ?? hardware.cpu.score) /
    referenceCpuScore;
  const gpuRatio = adjustedGpuRatio(hardware);
  const ramRatio = hardware.ramGb / profile.ramGb;
  const cpuWeight = profile.cpuWeight ?? 0.3;
  const gpuWeight = profile.gpuWeight ?? 0.7;
  const ramModel = ramUncertainty(
    ramRatio,
    hardware.ramKnowledge
  );
  const commonFactor =
    profile.referenceFps *
    ramModel.centerPenalty *
    resolutionFactor[settings.resolution] *
    qualityFactor[settings.quality] *
    (profile.optimization ?? 1);

  function fpsForCpuRatio(candidateCpuRatio: number) {
    return Math.max(
      0,
      commonFactor *
        corePerformanceFactor(
          candidateCpuRatio,
          gpuRatio,
          cpuWeight,
          gpuWeight
        )
    );
  }

  let fps = fpsForCpuRatio(cpuRatio);
  let cpuLowScenario = fpsForCpuRatio(cpuMinRatio);
  let cpuHighScenario = fpsForCpuRatio(cpuMaxRatio);

  if (profile.fpsCap) {
    fps = Math.min(fps, profile.fpsCap);
    cpuLowScenario = Math.min(
      cpuLowScenario,
      profile.fpsCap
    );
    cpuHighScenario = Math.min(
      cpuHighScenario,
      profile.fpsCap
    );
  }

  const estimateConfidence: ConfidenceLevel =
    cpuKnowledge === "estimated"
      ? "low"
      : hardware.confidence;
  const spread = estimateSpread[estimateConfidence];
  const cpuRangeActive =
    cpuKnowledge === "estimated" &&
    hardware.cpu.scoreMin !== undefined &&
    hardware.cpu.scoreMax !== undefined;

  const lowCenter = cpuRangeActive
    ? Math.min(fps, cpuLowScenario)
    : fps;
  const highCenter = cpuRangeActive
    ? Math.max(fps, cpuHighScenario)
    : fps;

  const minFps = Math.max(
    0,
    lowCenter *
      (1 - spread) *
      ramModel.lowRangeFactor
  );
  const uncappedMaxFps =
    highCenter *
    (1 + spread) *
    ramModel.highRangeFactor;
  const maxFps = profile.fpsCap
    ? Math.min(profile.fpsCap, uncappedMaxFps)
    : uncappedMaxFps;

  const roundedFps = roundFps(fps);
  const roundedMinFps = roundFps(minFps);
  const roundedMaxFps = roundFps(maxFps);

  const bottleneck =
    hardware.ramKnowledge === "confirmed" &&
    ramRatio < 0.8
      ? "ram"
      : cpuKnowledge === "estimated"
        ? cpuMaxRatio + 0.1 < gpuRatio
          ? "cpu"
          : gpuRatio + 0.1 < cpuMinRatio
            ? "gpu"
            : "balanced"
        : cpuRatio + 0.1 < gpuRatio
          ? "cpu"
          : gpuRatio + 0.1 < cpuRatio
            ? "gpu"
            : "balanced";

  return {
    slug,
    fps: roundedFps,
    minFps: roundedMinFps,
    maxFps: roundedMaxFps,
    tier: getPerformanceTier(roundedMinFps),
    confidence: estimateConfidence,
    bottleneck,
    canEstimate: true,
  };
}
