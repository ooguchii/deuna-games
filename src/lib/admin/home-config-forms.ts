import { z } from "zod";

import {
  HOME_HERO_MAX_JSON_CHARS,
  HOME_HERO_MAX_SLIDES,
} from "@/lib/home/hero-contract";
import {
  homeHeroPresentationEditorSchema,
} from "@/lib/home/hero-schema";

import {
  expectedRevisionSchema,
} from "./content-forms";

const slugPattern =
  /^[a-z0-9][a-z0-9._-]*$/;

function slugArraySchema(maximum: number) {
  return z
    .array(
      z
        .string()
        .min(1)
        .max(160)
        .regex(slugPattern)
    )
    .max(maximum)
    .superRefine((items, context) => {
      const seen = new Set<string>();

      items.forEach((item, index) => {
        if (seen.has(item)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message:
              "Un juego no puede repetirse dentro de la misma colección.",
          });
        }
        seen.add(item);
      });
    });
}

const modeSchema = z.enum([
  "manual",
  "automatic",
  "hybrid",
]);

function collectionSchema(maximum: number) {
  return z
    .object({
      mode: modeSchema,
      slugs: slugArraySchema(maximum),
    })
    .strict();
}

export const homeCurationPayloadSchema = z
  .object({
    hero: collectionSchema(8),
    popular: collectionSchema(24),
    lowSpec: collectionSchema(24),
    recommended: collectionSchema(24),
  })
  .strict();

const curationJsonSchema = z
  .string()
  .max(20_000)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message:
          "La configuración de curaduría no contiene JSON válido.",
      });
      return z.NEVER;
    }
  })
  .pipe(homeCurationPayloadSchema);

export const editorialHomeConfigFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    curationJson: curationJsonSchema,
  })
  .strict();

const legacyHeroCopySchema = z
  .object({
    accessibleTitle: z.string().trim().min(1).max(180),
    primaryCta: z.string().trim().min(1).max(100),
    secondaryCta: z.string().trim().min(1).max(100),
  })
  .strict();

const heroJsonSchema = z
  .string()
  .max(HOME_HERO_MAX_JSON_CHARS)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message:
          "La configuración del Hero no contiene JSON válido.",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .object({
        mode: modeSchema,
        slugs: slugArraySchema(HOME_HERO_MAX_SLIDES),
        presentation: homeHeroPresentationEditorSchema,
        // Compatibilidad transitoria con borradores de sesión creados antes de
        // separar definitivamente el copy del Hero. La ruta no persiste esto.
        copy: legacyHeroCopySchema.optional(),
      })
      .strict()
  );

export const homeHeroEditorFormSchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    heroJson: heroJsonSchema,
  })
  .strict();