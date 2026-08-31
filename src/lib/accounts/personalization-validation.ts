import { z } from "zod";

export const accountGamePreferenceSchema = z.object({
  gameSlug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9._-]{0,159}$/),
  favorite: z.enum(["true", "false"]).transform((value) => value === "true"),
  libraryState: z
    .enum(["none", "want_to_play", "playing", "completed"])
    .transform((value) => value === "none" ? null : value),
  followUpdates: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const accountHardwareSchema = z.object({
  intent: z.enum(["save", "clear"]),
  cpuId: z.string().trim().max(120),
  gpuId: z.string().trim().max(120),
  ramGb: z.string().trim().max(8),
  memoryMode: z.enum(["unknown", "single", "dual"]),
});
