import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined);

const utcDateTimeFormSchema = z
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
  );

export const editorialGameCreateFormSchema = z
  .object({
    slug: identifierSchema,
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().min(1).max(2_500),
    category: z.string().trim().min(1).max(80),
    version: optionalText(240),
    badge: optionalText(240),
    imageAlt: z.string().trim().min(1).max(240),
  })
  .strict();

export const editorialUpdateCreateFormSchema = z
  .object({
    id: identifierSchema,
    gameSlug: identifierSchema,
    version: z.string().trim().min(1).max(80),
    publishedAt: utcDateTimeFormSchema,
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
  })
  .strict();
