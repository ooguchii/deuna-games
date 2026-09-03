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
}: {
  games: Game[];
  focusedSlug?: string;
  accountHardware: AccountHardware;
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

  return (
    <GameFinderClient
      games={games}
      focusedSlug={focusedSlug}
    />
  );
}
