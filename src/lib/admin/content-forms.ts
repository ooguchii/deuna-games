import { z } from "zod";

import {
  editorialDownloadSourceSchema,
} from "./content-validation";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined);

const optionalPositiveNumber = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      /^\d{1,6}(?:\.\d{1,2})?$/.test(value)
  )
  .transform((value) =>
    value === "" ? undefined : Number(value)
  )
  .refine(
    (value) =>
      value === undefined ||
      (Number.isFinite(value) && value > 0 && value <= 100_000)
  );

const optionalPositiveInteger = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || /^\d{1,5}$/.test(value)
  )
  .transform((value) =>
    value === "" ? undefined : Number(value)
  )
  .refine(
    (value) =>
      value === undefined ||
      (Number.isInteger(value) && value > 0 && value <= 10_000)
  );

const downloadSourcesJsonSchema = z
  .string()
  .max(5_000)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: "La lista de fuentes no contiene JSON válido.",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(editorialDownloadSourceSchema)
      .max(6)
      .superRefine((sources, context) => {
        const ids = new Set<string>();
        const hrefs = new Set<string>();

        sources.forEach((source, index) => {
          if (ids.has(source.id)) {
            context.addIssue({
              code: "custom",
              path: [index, "id"],
              message: "Los identificadores de las fuentes deben ser únicos.",
            });
          }
          ids.add(source.id);

          if (hrefs.has(source.href)) {
            context.addIssue({
              code: "custom",
              path: [index, "href"],
              message: "Una misma dirección no puede repetirse.",
            });
          }
          hrefs.add(source.href);
        });
      })
  );

export const expectedRevisionSchema = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(Number)
  .pipe(z.number().int().positive());

export const editorialGameFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(2_500),
  category: z.string().trim().min(1).max(80),
  version: optionalText(240),
  badge: optionalText(240),
  rating: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^\d(?:\.\d{1,2})?$/.test(value)
    )
    .transform((value) =>
      value === "" ? undefined : Number(value)
    )
    .refine(
      (value) =>
        value === undefined ||
        (value >= 0 && value <= 5)
    ),
  reviews: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) =>
        value === "" ||
        /^\d+(?:\.\d+)?[KM]?$/i.test(value)
    )
    .transform((value) => value || undefined),
  imageAlt: z.string().trim().min(1).max(240),
});

export const editorialGameDownloadFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  sizeGb: optionalPositiveNumber,
  fileCount: optionalPositiveInteger,
  platform: optionalText(80),
  sourcesJson: downloadSourcesJsonSchema,
});

export const editorialUpdateFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  version: z.string().trim().min(1).max(80),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .refine((value) => {
      const parsed = new Date(`${value}:00Z`);

      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 16) === value
      );
    })
    .transform((value) =>
      new Date(`${value}:00Z`).toISOString()
    ),
  type: z.enum([
    "update",
    "content",
    "fix",
    "improvement",
  ]),
  summary: z.string().trim().min(1).max(1_500),
  featured: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export const editorialSiteConfigFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  name: z.string().trim().min(1).max(100),
  shortName: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  language: z.literal("es"),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i),
});

export const revisionIdSchema = z
  .string()
  .regex(/^\d{1,20}$/);
