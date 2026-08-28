export type HardwareSource = "browser" | "manual" | "saved";

export type ConfidenceLevel = "low" | "medium" | "high";

export type MemoryMode = "unknown" | "single" | "dual";

export type ResolutionPreset = "720p" | "1080p" | "1440p" | "2160p";

export type QualityPreset = "low" | "medium" | "high" | "ultra";

export type HardwarePart = {
  id: string;
  name: string;
  score: number;
  integrated?: boolean;
};

export type HardwareProfile = {
  cpu: HardwarePart | null;
  gpu: HardwarePart | null;
  ramGb: number | null;
  os: string;
  memoryMode: MemoryMode;
  source: HardwareSource;
  confidence: ConfidenceLevel;
  updatedAt: string;
};

export type BrowserHardwareSnapshot = {
  logicalProcessors: number | null;
  approximateMemoryGb: number | null;
  gpuRenderer: string | null;
  gpuVendor: string | null;
  gpuSource: "webgpu" | "webgl" | "none";
  platform: string | null;
  architecture: string | null;
  warnings: string[];
};

export type PerformanceTier = "excellent" | "good" | "acceptable" | "basic";

export type GamePerformanceProfile = {
  slug: string;
  referenceFps: number;
  ramGb: number;
  storageGb?: number;
  fpsCap?: number;
  cpuWeight?: number;
  gpuWeight?: number;
  optimization?: number;
};

export type EstimateSettings = {
  resolution: ResolutionPreset;
  quality: QualityPreset;
};

export type GameEstimate = {
  slug: string;
  fps: number;
  minFps: number;
  maxFps: number;
  tier: PerformanceTier;
  confidence: ConfidenceLevel;
  bottleneck: "cpu" | "gpu" | "ram" | "balanced";
  canEstimate: boolean;
  reason?: string;
};
