import { getPerformanceProfile } from "./performance-data";
import type {
  ConfidenceLevel,
  EstimateSettings,
  GameEstimate,
  HardwareProfile,
  PerformanceTier,
  QualityPreset,
  ResolutionPreset,
} from "./types";

const REFERENCE_CPU_SCORE = 65;
const REFERENCE_GPU_SCORE = 76;

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

export function getPerformanceTier(fps: number): PerformanceTier {
  if (fps >= 60) return "excellent";
  if (fps >= 40) return "good";
  if (fps >= 28) return "acceptable";
  return "basic";
}

function confidenceSpread(confidence: ConfidenceLevel) {
  if (confidence === "high") return 0.12;
  if (confidence === "medium") return 0.2;
  return 0.3;
}

function roundFps(value: number) {
  if (value >= 120) return Math.round(value / 5) * 5;
  return Math.round(value);
}

export function estimateGamePerformance(
  slug: string,
  hardware: HardwareProfile,
  settings: EstimateSettings
): GameEstimate {
  const profile = getPerformanceProfile(slug);

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

  const cpuRatio = hardware.cpu.score / REFERENCE_CPU_SCORE;
  let gpuRatio = hardware.gpu.score / REFERENCE_GPU_SCORE;
  const ramRatio = hardware.ramGb / profile.ramGb;

  if (hardware.gpu.integrated) {
    if (hardware.memoryMode === "single") gpuRatio *= 0.75;
    if (hardware.memoryMode === "unknown") gpuRatio *= 0.87;
    if (hardware.memoryMode === "dual") gpuRatio *= 1;
  }

  const cpuWeight = profile.cpuWeight ?? 0.3;
  const gpuWeight = profile.gpuWeight ?? 0.7;

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
  const ramPenalty =
    ramRatio >= 1 ? 1 : Math.max(0.52, 0.58 + ramRatio * 0.42);

  let fps =
    profile.referenceFps *
    weightedCore *
    bottleneckCorrection *
    ramPenalty *
    resolutionFactor[settings.resolution] *
    qualityFactor[settings.quality] *
    (profile.optimization ?? 1);

  if (profile.fpsCap) fps = Math.min(fps, profile.fpsCap);

  fps = Math.max(8, fps);

  const spread = confidenceSpread(hardware.confidence);
  const minFps = Math.max(5, fps * (1 - spread));
  const maxFps = profile.fpsCap
    ? Math.min(profile.fpsCap, fps * (1 + spread))
    : fps * (1 + spread);

  const bottleneck =
    ramRatio < 0.8
      ? "ram"
      : cpuRatio + 0.1 < gpuRatio
        ? "cpu"
        : gpuRatio + 0.1 < cpuRatio
          ? "gpu"
          : "balanced";

  return {
    slug,
    fps: roundFps(fps),
    minFps: roundFps(minFps),
    maxFps: roundFps(maxFps),
    tier: getPerformanceTier(fps),
    confidence: hardware.confidence,
    bottleneck,
    canEstimate: true,
  };
}
