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

export function getStoredHardwareSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(
      PROFILE_STORAGE_KEY
    );
  } catch {
    return null;
  }
}

export function parseStoredHardwareProfile(
  raw: string | null
): HardwareProfile | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as {
      cpuId?: unknown;
      gpuId?: unknown;
      ramGb?: unknown;
      os?: unknown;
      osConfirmed?: unknown;
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
      ramGb < 1 ||
      ramGb > 256
    ) {
      return null;
    }

    return {
      cpu,
      cpuKnowledge: "confirmed",
      gpu,
      ramGb,
      ramKnowledge: "confirmed",
      os:
        value.osConfirmed === true &&
        typeof value.os === "string" &&
        value.os.trim()
          ? value.os
          : "Sistema sin confirmar",
      osConfirmed: value.osConfirmed === true,
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

export function readStoredHardwareProfile() {
  return parseStoredHardwareProfile(
    getStoredHardwareSnapshot()
  );
}

export function storeExplicitHardwareProfile(input: {
  cpuId: string;
  gpuId: string;
  ramGb: number;
  memoryMode: MemoryMode;
  updatedAt?: string;
}) {
  if (typeof window === "undefined") {
    return false;
  }

  if (
    !findCpuById(input.cpuId) ||
    !findGpuById(input.gpuId) ||
    !Number.isFinite(input.ramGb) ||
    input.ramGb < 1 ||
    input.ramGb > 256
  ) {
    return false;
  }

  try {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        cpuId: input.cpuId,
        gpuId: input.gpuId,
        ramGb: input.ramGb,
        os: "Sistema sin confirmar",
        osConfirmed: false,
        memoryMode: input.memoryMode,
        updatedAt: input.updatedAt ?? nowIso(),
      })
    );
    return true;
  } catch {
    return false;
  }
}
