"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  GamePerformanceCalibration,
} from "@/types/game";

type CalibrationState = {
  slug: string;
  loaded: boolean;
  value: GamePerformanceCalibration | null;
};

const resolved = new Map<
  string,
  GamePerformanceCalibration | null
>();
const pending = new Map<
  string,
  Promise<GamePerformanceCalibration | null>
>();

function parsePublishedCalibration(
  value: unknown
): GamePerformanceCalibration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const referenceFps = candidate.referenceFps;
  const ramGb = candidate.ramGb;
  const fpsCap = candidate.fpsCap;

  if (
    typeof referenceFps !== "number" ||
    !Number.isFinite(referenceFps) ||
    referenceFps <= 0 ||
    referenceFps > 1_000 ||
    typeof ramGb !== "number" ||
    !Number.isFinite(ramGb) ||
    ramGb <= 0 ||
    ramGb > 512
  ) {
    return null;
  }

  if (
    fpsCap !== undefined &&
    (
      typeof fpsCap !== "number" ||
      !Number.isFinite(fpsCap) ||
      fpsCap <= 0 ||
      fpsCap > 1_000 ||
      fpsCap < referenceFps
    )
  ) {
    return null;
  }

  return {
    referenceFps,
    ramGb,
    ...(typeof fpsCap === "number" ? { fpsCap } : {}),
  };
}

function loadCalibration(
  slug: string
): Promise<GamePerformanceCalibration | null> {
  if (resolved.has(slug)) {
    return Promise.resolve(resolved.get(slug) ?? null);
  }

  const existing = pending.get(slug);
  if (existing) return existing;

  const request = fetch(
    `/api/games/${encodeURIComponent(slug)}/performance`,
    { cache: "no-store" }
  )
    .then(async (response) => {
      if (!response.ok) return null;

      const payload = await response.json() as {
        calibration?: unknown;
      };

      return parsePublishedCalibration(payload.calibration);
    })
    .catch(() => null)
    .then((calibration) => {
      resolved.set(slug, calibration);
      pending.delete(slug);
      return calibration;
    });

  pending.set(slug, request);
  return request;
}

export function useGamePerformanceCalibration(
  slug: string
) {
  const hasCached = resolved.has(slug);
  const [state, setState] = useState<CalibrationState>(() => ({
    slug,
    loaded: hasCached,
    value: hasCached ? resolved.get(slug) ?? null : null,
  }));

  useEffect(() => {
    let active = true;

    loadCalibration(slug).then((value) => {
      if (active) {
        setState({
          slug,
          loaded: true,
          value,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [slug]);

  if (state.slug === slug) {
    return {
      calibration: state.value,
      loading: !state.loaded,
    };
  }

  if (resolved.has(slug)) {
    return {
      calibration: resolved.get(slug) ?? null,
      loading: false,
    };
  }

  return {
    calibration: null,
    loading: true,
  };
}
