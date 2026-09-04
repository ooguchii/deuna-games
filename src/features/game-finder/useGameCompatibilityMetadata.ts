"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  GameCompatibilityMetadata,
} from "@/types/game";

type CompatibilityState = {
  slug: string;
  loaded: boolean;
  metadata: GameCompatibilityMetadata | null;
};

const resolved = new Map<string, GameCompatibilityMetadata | null>();
const pending = new Map<string, Promise<GameCompatibilityMetadata | null>>();

function parsePublishedCompatibilityMetadata(
  value: unknown
): GameCompatibilityMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const status = candidate.status;
  const source = candidate.source;
  const verifiedAt = candidate.verifiedAt;
  const allowedStatus = new Set(["declared", "reviewed", "tested"]);
  const allowedSources = new Set([
    "developer",
    "publisher",
    "internal",
    "community",
    "external",
  ]);

  if (
    status !== undefined &&
    (typeof status !== "string" || !allowedStatus.has(status))
  ) {
    return null;
  }
  if (
    source !== undefined &&
    (typeof source !== "string" || !allowedSources.has(source))
  ) {
    return null;
  }
  if (
    verifiedAt !== undefined &&
    (
      typeof verifiedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)
    )
  ) {
    return null;
  }

  return {
    ...(typeof status === "string"
      ? { status: status as GameCompatibilityMetadata["status"] }
      : {}),
    ...(typeof source === "string"
      ? { source: source as GameCompatibilityMetadata["source"] }
      : {}),
    ...(typeof verifiedAt === "string" ? { verifiedAt } : {}),
  };
}

function loadCompatibilityMetadata(
  slug: string
): Promise<GameCompatibilityMetadata | null> {
  if (resolved.has(slug)) {
    return Promise.resolve(resolved.get(slug) ?? null);
  }

  const existing = pending.get(slug);
  if (existing) return existing;

  const request = fetch(
    `/api/games/${encodeURIComponent(slug)}/compatibility`,
    { cache: "no-store" }
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { metadata?: unknown };
      return parsePublishedCompatibilityMetadata(payload.metadata);
    })
    .catch(() => null)
    .then((metadata) => {
      resolved.set(slug, metadata);
      pending.delete(slug);
      return metadata;
    });

  pending.set(slug, request);
  return request;
}

export function useGameCompatibilityMetadata(slug: string) {
  const cached = resolved.get(slug);
  const [state, setState] = useState<CompatibilityState>(() => ({
    slug,
    loaded: resolved.has(slug),
    metadata: cached ?? null,
  }));

  useEffect(() => {
    let active = true;

    loadCompatibilityMetadata(slug).then((metadata) => {
      if (active) {
        setState({
          slug,
          loaded: true,
          metadata,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [slug]);

  if (state.slug === slug) {
    return {
      metadata: state.metadata,
      loading: !state.loaded,
    };
  }

  if (resolved.has(slug)) {
    return {
      metadata: resolved.get(slug) ?? null,
      loading: false,
    };
  }

  return {
    metadata: null,
    loading: true,
  };
}
