"use client";

import {
  LoaderCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type { Game } from "@/types/game";

import GameFinderClient from "./GameFinderClient";
import {
  storeExplicitHardwareProfile,
} from "./hardware-storage";
import type {
  HardwareProfile,
  MemoryMode,
} from "./types";

type AccountHardware = {
  cpuId: string;
  gpuId: string;
  ramGb: number;
  memoryMode: MemoryMode;
  updatedAt: string;
} | null;

export default function AccountAwareGameFinder({
  games,
  focusedSlug,
  accountHardware,
  authenticated,
}: {
  games: Game[];
  focusedSlug?: string;
  accountHardware: AccountHardware;
  authenticated: boolean;
}) {
  const [ready, setReady] = useState(
    accountHardware === null
  );

  useEffect(() => {
    if (!accountHardware) {
      return;
    }

    storeExplicitHardwareProfile(accountHardware);
    const frame = window.requestAnimationFrame(() => {
      setReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [accountHardware]);

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "240px",
          display: "grid",
          placeItems: "center",
          color: "var(--text-soft)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <LoaderCircle size={18} aria-hidden="true" />
          Preparando Mi PC guardada…
        </span>
      </div>
    );
  }

  async function saveAccountProfile(profile: HardwareProfile) {
    const response = await fetch("/api/account/hardware", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        intent: "save",
        cpuId: profile.cpu?.id ?? "",
        gpuId: profile.gpu?.id ?? "",
        ramGb: String(profile.ramGb ?? ""),
        memoryMode: profile.memoryMode,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("No se pudo guardar Mi PC.");
  }

  return (
    <GameFinderClient
      games={games}
      focusedSlug={focusedSlug}
      onSaveProfile={authenticated ? saveAccountProfile : undefined}
    />
  );
}
