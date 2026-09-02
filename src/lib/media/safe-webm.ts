import { createHash } from "node:crypto";

// Hard safety ceiling for one published master. HD/50-60 FPS resources need
// materially more room than the legacy 3 MB preview cap; encoders still target
// lower preferred sizes and fail closed above this absolute limit.
export const MAX_EDITORIAL_PREVIEW_BYTES = 32 * 1024 * 1024;
export const MIN_EDITORIAL_PREVIEW_BYTES = 128;

const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export type SafeEditorialWebmInspection = {
  digest: string;
  bytes: number;
};

export function inspectSafeEditorialWebm(
  input: Buffer
): SafeEditorialWebmInspection | null {
  if (
    input.length < MIN_EDITORIAL_PREVIEW_BYTES ||
    input.length > MAX_EDITORIAL_PREVIEW_BYTES ||
    input.length < EBML_MAGIC.length ||
    !input.subarray(0, EBML_MAGIC.length).equals(EBML_MAGIC)
  ) {
    return null;
  }

  const headerWindow = input
    .subarray(0, Math.min(input.length, 4096))
    .toString("latin1")
    .toLowerCase();

  if (!headerWindow.includes("webm")) {
    return null;
  }

  return {
    digest: createHash("sha256").update(input).digest("hex"),
    bytes: input.length,
  };
}
