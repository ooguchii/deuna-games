import {
  findCpuById,
} from "./hardware-catalog";
import type { HardwarePart } from "./types";

export const CPU_CONFIRMATION_STORAGE_KEY =
  "deuna-games:confirmed-cpu:v1";

type StoredCpuConfirmation = {
  cpuId: string;
  updatedAt: string;
};

export function readConfirmedCpu(): HardwarePart | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      CPU_CONFIRMATION_STORAGE_KEY
    );
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<StoredCpuConfirmation>;
    if (typeof value.cpuId !== "string") return null;

    return findCpuById(value.cpuId);
  } catch {
    return null;
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
