import {
  findCpuById,
  findGpuById,
} from "./hardware-catalog";
import type {
  HardwareProfile,
  MemoryMode,
} from "./types";

export const PROFILE_STORAGE_KEY =
  "deuna-games:hardware-profile:v2";

function nowIso() {
  return new Date().toISOString();
}

export function readStoredHardwareProfile(): HardwareProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      PROFILE_STORAGE_KEY
    );

    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as {
      cpuId?: unknown;
      gpuId?: unknown;
      ramGb?: unknown;
      os?: unknown;
      memoryMode?: unknown;
      updatedAt?: unknown;
    };

    if (
      !value ||
      typeof value !== "object" ||
      typeof value.cpuId !== "string" ||
      typeof value.gpuId !== "string"
    ) {
      return null;
    }

    const cpu = findCpuById(value.cpuId);
    const gpu = findGpuById(value.gpuId);
    const ramGb =
      typeof value.ramGb === "number"
        ? value.ramGb
        : Number.NaN;

    const memoryMode: MemoryMode =
      value.memoryMode === "single" ||
      value.memoryMode === "dual"
        ? value.memoryMode
        : "unknown";

    if (
      !cpu ||
      !gpu ||
      !Number.isFinite(ramGb) ||
      ramGb < 4 ||
      ramGb > 256
    ) {
      return null;
    }

    return {
      cpu,
      gpu,
      ramGb,
      ramKnowledge: "confirmed",
      os:
        typeof value.os === "string" &&
        value.os.trim()
          ? value.os
          : "Sistema sin confirmar",
      memoryMode,
      source: "saved",
      confidence: "high",
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : nowIso(),
    };
  } catch {
    return null;
  }
}
