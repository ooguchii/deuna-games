import {
  findCpuById,
} from "./hardware-catalog";
import {
  parseStoredHardwareProfile,
  PROFILE_STORAGE_KEY,
} from "./hardware-storage";
import type { HardwarePart } from "./types";

export const CPU_CONFIRMATION_STORAGE_KEY =
  "deuna-games:confirmed-cpu:v1";

type StoredCpuConfirmation = {
  cpuId: string;
  updatedAt: string;
};

function cpuFromIndependentConfirmation() {
  const raw = window.localStorage.getItem(
    CPU_CONFIRMATION_STORAGE_KEY
  );
  if (!raw) return null;

  const value = JSON.parse(raw) as Partial<StoredCpuConfirmation>;
  if (typeof value.cpuId !== "string") return null;

  return findCpuById(value.cpuId);
}

function cpuFromStoredProfile() {
  const raw = window.localStorage.getItem(
    PROFILE_STORAGE_KEY
  );
  return parseStoredHardwareProfile(raw)?.cpu ?? null;
}

export function readConfirmedCpu(): HardwarePart | null {
  if (typeof window === "undefined") return null;

  try {
    return (
      cpuFromIndependentConfirmation() ??
      cpuFromStoredProfile()
    );
  } catch {
    return null;
  }
}

function synchronizeStoredProfileCpu(cpuId: string) {
  const raw = window.localStorage.getItem(
    PROFILE_STORAGE_KEY
  );
  if (!raw) return;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }

    const profile = value as Record<string, unknown>;
    if (
      typeof profile.gpuId !== "string" ||
      typeof profile.ramGb !== "number"
    ) {
      return;
    }

    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        ...profile,
        cpuId,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Una confirmación independiente sigue siendo válida aunque el perfil
    // completo almacenado sea antiguo o esté corrupto.
  }
}

export function writeConfirmedCpu(cpuId: string) {
  if (typeof window === "undefined") return false;

  const cpu = findCpuById(cpuId);
  if (!cpu) return false;

  try {
    const value: StoredCpuConfirmation = {
      cpuId: cpu.id,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      CPU_CONFIRMATION_STORAGE_KEY,
      JSON.stringify(value)
    );
    synchronizeStoredProfileCpu(cpu.id);
    return true;
  } catch {
    return false;
  }
}

export function clearConfirmedCpu() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(
      CPU_CONFIRMATION_STORAGE_KEY
    );
  } catch {
    // El perfil puede seguir usándose durante la sesión aunque storage falle.
  }
}
