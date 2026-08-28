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

let browserProfilePromise:
  Promise<HardwareProfile> | null = null;

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
    if (storedProfile) {
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
  }, [storedProfile]);

  const profile =
    storedProfile ?? detectedProfile;

  const status: ResolvedHardwareStatus =
    storedProfile
      ? "ready"
      : detectionStatus;

  return {
    profile,
    status,
  };
}
