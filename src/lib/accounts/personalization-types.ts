import type { HardwareProfile } from "@/features/game-finder/types";

export type AccountLibraryState =
  | "want_to_play"
  | "playing"
  | "completed";

export type AccountGamePreference = {
  gameSlug: string;
  favorite: boolean;
  libraryState: AccountLibraryState | null;
  followUpdates: boolean;
  followedAt: Date | null;
  updatesSeenThrough: Date | null;
  updatedAt: Date;
};

export type AccountHardwareSelection = {
  cpuId: string;
  gpuId: string;
  ramGb: number;
  memoryMode: "unknown" | "single" | "dual";
  updatedAt: Date;
};

export type AccountPersonalization = {
  preferences: AccountGamePreference[];
  hardwareSelection: AccountHardwareSelection | null;
  hardware: HardwareProfile | null;
};
