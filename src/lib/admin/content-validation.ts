import { z } from "zod";

import type { Game } from "@/types/game";
import type { GameUpdate } from "@/types/update";

export const editorialItemTypes = [
  "game",
  "game_update",
  "site_config",
] as const;

export type EditorialItemType =
  (typeof editorialItemTypes)[number];

const identifierSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

const shortText = z.string().trim().max(240);
const optionalShortText = shortText.optional();
const localImageSchema = z
  .string()
  .max(400)
  .regex(/^\/images\/[A-Za-z0-9/_.,@+() -]+\.(?:avif|gif|jpe?g|png|webp)$/i);

const downloadHrefSchema = z
  .string()
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/")) {
      return !value.startsWith("//");
    }

    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });

const hardwareRequirementsSchema = z
  .object({
    ram: optionalShortText,
    graphics: optionalShortText,
    processor: optionalShortText,
    storage: optionalShortText,
    system: optionalShortText,
  })
  .strict();

const requirementsSchema = hardwareRequirementsSchema
  .extend({
    minimum: hardwareRequirementsSchema.optional(),
    recommended:
      hardwareRequirementsSchema.optional(),
  })
  .strict();

export const editorialDownloadSourceSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(100),
    href: downloadHrefSchema,
    label: optionalShortText,
  })
  .strict();

const downloadSchema = z
  .object({
    href: downloadHrefSchema.optional(),
    label: optionalShortText,
    sources: z
      .array(editorialDownloadSourceSchema)
      .max(12)
      .optional(),
    sizeGb: z.number().positive().max(100_000).optional(),
    fileCount: z.number().int().positive().max(10_000).optional(),
    platform: optionalShortText,
  })
  .strict();

export const editorialGameSchema: z.ZodType<Game> = z
  .object({
    id: identifierSchema,
    slug: identifierSchema,
    title: z.string().trim().min(1).max(140),
    shortTitle: optionalShortText,
    highlightedTitle: optionalShortText,
    description: z.string().trim().min(1).max(2_500),
    category: z.string().trim().min(1).max(80),
    genres: z.array(shortText).max(20).optional(),
    tags: z.array(shortText).max(30).optional(),
    platforms: z
      .array(
        z.enum([
          "PC",
          "PlayStation",
          "Xbox",
          "Nintendo Switch",
        ])
      )
      .max(4)
      .optional(),
    badge: optionalShortText,
    rating: z.number().min(0).max(5).optional(),
    reviews: z
      .string()
      .trim()
      .max(30)
      .regex(/^\d+(?:\.\d+)?[KM]?$/i)
      .optional(),
    version: optionalShortText,
    addedAt: optionalShortText,
    releaseDate: optionalShortText,
    developer: optionalShortText,
    publisher: optionalShortText,
    coverImage: localImageSchema.optional(),
    heroImage: localImageSchema.optional(),
    screenshots: z
      .array(localImageSchema)
      .max(20)
      .optional(),
    imageAlt: z.string().trim().min(1).max(240),
    requirements: requirementsSchema.optional(),
    download: downloadSchema.optional(),
  })
  .strict()
  .refine((game) => game.id === game.slug, {
    message: "El ID y el slug del juego deben coincidir.",
  });

export const editorialUpdateSchema: z.ZodType<GameUpdate> = z
  .object({
    id: identifierSchema,
    gameSlug: identifierSchema,
    version: z.string().trim().min(1).max(80),
    publishedAt: z
      .string()
      .datetime({ offset: true }),
    type: z.enum([
      "update",
      "content",
      "fix",
      "improvement",
    ]),
    summary: z.string().trim().min(1).max(1_500),
    featured: z.boolean().optional(),
  })
  .strict();

export const editorialSiteConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    shortName: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
    language: z.literal("es"),
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  })
  .strict();

export type EditorialSiteConfig = z.infer<
  typeof editorialSiteConfigSchema
>;

export type EditorialPayloadByType = {
  game: Game;
  game_update: GameUpdate;
  site_config: EditorialSiteConfig;
};

export function parseEditorialPayload<
  Type extends EditorialItemType,
>(type: Type, payload: unknown): EditorialPayloadByType[Type] {
  const schema =
    type === "game"
      ? editorialGameSchema
      : type === "game_update"
        ? editorialUpdateSchema
        : editorialSiteConfigSchema;

  return schema.parse(payload) as EditorialPayloadByType[Type];
}
