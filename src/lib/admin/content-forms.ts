import { z } from "zod";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined);

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
