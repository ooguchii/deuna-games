import { z } from "zod";

import {
  expectedRevisionSchema,
} from "./content-forms";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined);

const gamePlatformSchema = z.enum([
  "PC",
  "PlayStation",
  "Xbox",
  "Nintendo Switch",
]);

const platformsJsonSchema = z
  .string()
  .max(180)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: "La lista de plataformas no contiene JSON válido.",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(gamePlatformSchema)
      .max(4)
      .superRefine((platforms, context) => {
        const seen = new Set<string>();
        platforms.forEach((platform, index) => {
          if (seen.has(platform)) {
            context.addIssue({
              code: "custom",
              path: [index],
              message: "Una plataforma no puede repetirse.",
            });
          }
          seen.add(platform);
        });
      })
  )
  .transform((platforms) =>
    platforms.length ? platforms : undefined
  );

function delimitedTextList(
  maximumItems: number,
  maximumItemLength: number,
  maximumInputLength: number
) {
  return z
    .string()
    .max(maximumInputLength)
    .transform((value) =>
      value
        .split(/[,\r\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(z.string().min(1).max(maximumItemLength))
        .max(maximumItems)
        .superRefine((items, context) => {
          const seen = new Set<string>();
          items.forEach((item, index) => {
            const normalized = item
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLocaleLowerCase("es");
            if (seen.has(normalized)) {
              context.addIssue({
                code: "custom",
                path: [index],
                message: "Los valores no pueden repetirse.",
              });
            }
            seen.add(normalized);
          });
        })
    )
    .transform((items) => items.length ? items : undefined);
}

function normalizedReleaseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00Z`);
    if (!Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === trimmed) {
      return trimmed;
    }
    return null;
  }

  const legacy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!legacy) return null;
  const [, day, month, year] = legacy;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === iso
      ? iso
      : null;
}

const releaseDateSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value, context) => {
    const normalized = normalizedReleaseDate(value);
    if (normalized === null) {
      context.addIssue({
        code: "custom",
        message: "Usa una fecha válida con formato AAAA-MM-DD.",
      });
      return z.NEVER;
    }
    return normalized;
  });

const optionalRating = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d(?:\.\d{1,2})?$/.test(value)
  )
  .transform((value) => value === "" ? undefined : Number(value))
  .refine(
    (value) => value === undefined ||
      (Number.isFinite(value) && value >= 0 && value <= 5)
  );

export const gameInformationSectionSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(2_500),
  shortTitle: optionalText(140),
  highlightedTitle: optionalText(140),
  developer: optionalText(160),
  publisher: optionalText(160),
  releaseDate: releaseDateSchema,
  version: optionalText(240),
  badge: optionalText(240),
  imageAlt: z.string().trim().min(1).max(240),
});

export const gameClassificationSectionSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  category: z.string().trim().min(1).max(80),
  genresText: delimitedTextList(20, 80, 1_800),
  tagsText: delimitedTextList(30, 80, 2_600),
});

export const gameCompatibilitySectionSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  platformsJson: platformsJsonSchema,
  minimumSystem: optionalText(240),
  minimumProcessor: optionalText(240),
  minimumRam: optionalText(240),
  minimumGraphics: optionalText(240),
  minimumStorage: optionalText(240),
  recommendedSystem: optionalText(240),
  recommendedProcessor: optionalText(240),
  recommendedRam: optionalText(240),
  recommendedGraphics: optionalText(240),
  recommendedStorage: optionalText(240),
});

export const gameValuationSectionSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  rating: optionalRating,
});
