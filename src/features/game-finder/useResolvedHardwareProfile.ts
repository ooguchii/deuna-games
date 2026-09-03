"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  detectBrowserHardware,
  profileFromBrowserSnapshot,
} from "./browser-detection";
import {
  findCpuById,
  findGpuById,
} from "./hardware-catalog";
import {
  getStoredHardwareSnapshot,
  parseStoredHardwareProfile,
  PROFILE_STORAGE_KEY,
} from "./hardware-storage";
import type { HardwareProfile } from "./types";

export type ResolvedHardwareStatus =
  | "loading"
  | "ready"
  | "incomplete"
  | "error";

type AccountHardwareResponse = {
  ok?: boolean;
  hardware?: {
    cpuId?: unknown;
    gpuId?: unknown;
    ramGb?: unknown;
    memoryMode?: unknown;
    updatedAt?: unknown;
  } | null;
};

let browserProfilePromise:
  Promise<HardwareProfile> | null = null;

export function invalidateDetectedBrowserProfileCache() {
  browserProfilePromise = null;
}

export function primeDetectedBrowserProfileCache(
  profile: HardwareProfile
) {
  if (profile.source !== "browser") {
    return;
  }

  browserProfilePromise = Promise.resolve(profile);
}

function subscribeToStoredProfile(
  onStoreChange: () => void
) {
  function handleStorage(event: StorageEvent) {
    if (
      event.key === null ||
      event.key === PROFILE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () =>
    window.removeEventListener(
      "storage",
      handleStorage
    );
}

function getServerSnapshot() {
  return null;
}

function profileIsComplete(
  profile: HardwareProfile
) {
  return Boolean(
    profile.cpu &&
      profile.gpu &&
      profile.ramGb
  );
}

function accountHardwareProfile(
  response: AccountHardwareResponse
): HardwareProfile | null {
  const selection = response.hardware;

  if (!response.ok || !selection) {
    return null;
  }

  if (
    typeof selection.cpuId !== "string" ||
    typeof selection.gpuId !== "string" ||
    typeof selection.ramGb !== "number" ||
    !Number.isFinite(selection.ramGb) ||
    selection.ramGb < 1 ||
    selection.ramGb > 256 ||
    ![
      "unknown",
      "single",
      "dual",
    ].includes(String(selection.memoryMode))
  ) {
    return null;
  }

  const cpu = findCpuById(selection.cpuId);
  const gpu = findGpuById(selection.gpuId);

  if (!cpu || !gpu) {
    return null;
  }

  return {
    cpu,
    cpuKnowledge: "confirmed",
    gpu,
    ramGb: selection.ramGb,
    ramKnowledge: "confirmed",
    os: "Sistema sin guardar",
    osConfirmed: false,
    memoryMode: selection.memoryMode as
      | "unknown"
      | "single"
      | "dual",
    source: "saved",
    confidence: "high",
    updatedAt:
      typeof selection.updatedAt === "string"
        ? selection.updatedAt
        : new Date().toISOString(),
  };
}

async function readAccountHardwareProfile() {
  const response = await fetch("/api/account/hardware", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("account-hardware-unavailable");
  }

  return accountHardwareProfile(
    (await response.json()) as AccountHardwareResponse
  );
}

function detectBrowserProfile() {
  if (!browserProfilePromise) {
    browserProfilePromise =
      detectBrowserHardware()
        .then(profileFromBrowserSnapshot)
        .catch((error: unknown) => {
          browserProfilePromise = null;
          throw error;
        });
  }

  return browserProfilePromise;
}

export function useResolvedHardwareProfile() {
  const rawStoredProfile = useSyncExternalStore(
    subscribeToStoredProfile,
    getStoredHardwareSnapshot,
    getServerSnapshot
  );

  const storedProfile = useMemo(
    () =>
      parseStoredHardwareProfile(
        rawStoredProfile
      ),
    [rawStoredProfile]
  );
  const [accountProfile, setAccountProfile] =
    useState<HardwareProfile | null>(null);
  const [accountResolved, setAccountResolved] =
    useState(false);
  const [
    detectedProfile,
    setDetectedProfile,
  ] = useState<HardwareProfile | null>(null);
  const [
    detectionStatus,
    setDetectionStatus,
  ] = useState<ResolvedHardwareStatus>(
    "loading"
  );

  useEffect(() => {
    let active = true;

    void readAccountHardwareProfile()
      .then((profile) => {
        if (!active) return;
        setAccountProfile(profile);
      })
      .catch(() => {
        if (!active) return;
        setAccountProfile(null);
      })
      .finally(() => {
        if (!active) return;
        setAccountResolved(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !accountResolved ||
      accountProfile ||
      storedProfile
    ) {
      return;
    }

    let active = true;

    void detectBrowserProfile()
      .then((profile) => {
        if (!active) return;

        setDetectedProfile(profile);
        setDetectionStatus(
          profileIsComplete(profile)
            ? "ready"
            : "incomplete"
        );
      })
      .catch(() => {
        if (!active) return;

        setDetectedProfile(null);
        setDetectionStatus("error");
      });

    return () => {
      active = false;
    };
  }, [accountProfile, accountResolved, storedProfile]);

  const profile =
    accountProfile ?? storedProfile ?? detectedProfile;

  const status: ResolvedHardwareStatus =
    accountProfile || storedProfile
      ? "ready"
      : !accountResolved
        ? "loading"
        : detectionStatus;

  return {
    profile,
    status,
  };
}
