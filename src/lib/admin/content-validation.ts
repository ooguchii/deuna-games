import { z } from "zod";

import {
  taxonomyIconKeys,
  taxonomyToneKeys,
} from "@/lib/games/taxonomy-presentation";
import type { Game } from "@/types/game";
import type { GameTaxonomy } from "@/types/game-taxonomy";
import type { GameUpdate } from "@/types/update";

export const editorialItemTypes = [
  "game",
  "game_update",
  "site_config",
  "home_config",
  "about_config",
  "game_taxonomy",
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
const bundledImagePattern =
  /^\/images\/[A-Za-z0-9/_.,@+() -]+\.(?:avif|gif|jpe?g|png|webp)$/i;
const editorialMediaPattern =
  /^\/media\/editorial\/[a-z0-9][a-z0-9._-]{0,159}\/[a-f0-9]{64}\.webp$/;

function isSafeLocalImagePath(value: string) {
  if (editorialMediaPattern.test(value)) {
    return true;
  }

  if (
    !bundledImagePattern.test(value) ||
    value.includes("\\") ||
    value.includes("//")
  ) {
    return false;
  }

  return !value
    .split("/")
    .some((segment) =>
      segment === "." || segment === ".."
    );
}

const localImageSchema = z
  .string()
  .max(400)
  .refine(isSafeLocalImagePath);

const downloadHrefSchema = z
  .string()
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/")) {
      return (
        !value.startsWith("//") &&
        !value.includes("\\")
      );
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

const performanceCalibrationSchema = z
  .object({
    referenceFps: z.number().positive().max(1_000),
    ramGb: z.number().positive().max(512),
    fpsCap: z.number().positive().max(1_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.fpsCap === undefined ||
      value.referenceFps <= value.fpsCap,
    {
      message:
        "Los FPS de referencia no pueden superar el límite configurado.",
      path: ["fpsCap"],
    }
  );

const downloadSourceStatusSchema = z.enum([
  "available",
  "down",
  "maintenance",
]);

const editorialDownloadSourceSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(100),
    href: downloadHrefSchema,
    label: optionalShortText,
    enabled: z.boolean().optional(),
    status: downloadSourceStatusSchema.optional(),
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

function uniqueIdentifiers(maximum: number) {
  return z
    .array(identifierSchema)
    .max(maximum)
    .superRefine((values, context) => {
      const seen = new Set<string>();

      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "Un juego no puede repetirse dentro de la misma colección.",
          });
        }
        seen.add(value);
      });
    });
}

function normalizeTaxonomyLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

const taxonomyTermSchema = z
  .object({
    key: identifierSchema,
    label: z.string().trim().min(1).max(80),
    active: z.boolean(),
    icon: z.enum(taxonomyIconKeys).optional(),
    tone: z.enum(taxonomyToneKeys).optional(),
  })
  .strict();

function taxonomyTerms(maximum: number) {
  return z
    .array(taxonomyTermSchema)
    .max(maximum)
    .superRefine((terms, context) => {
      const keys = new Set<string>();
      const labels = new Set<string>();

      terms.forEach((term, index) => {
        if (keys.has(term.key)) {
          context.addIssue({
            code: "custom",
            path: [index, "key"],
            message: "Los identificadores del catálogo no pueden repetirse.",
          });
        }
        keys.add(term.key);

        const label = normalizeTaxonomyLabel(term.label);
        if (labels.has(label)) {
          context.addIssue({
            code: "custom",
            path: [index, "label"],
            message: "El catálogo no admite nombres duplicados o equivalentes.",
          });
        }
        labels.add(label);
      });
    });
}

const aboutTitle = z.string().trim().min(1).max(180);
const aboutText = z.string().trim().min(1).max(700);
const aboutEyebrow = z.string().trim().min(1).max(60);
const aboutCardSchema = z
  .object({
    title: aboutTitle,
    text: aboutText,
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
    performance: performanceCalibrationSchema.optional(),
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

export const editorialHomeConfigSchema = z
  .object({
    heroSlugs: uniqueIdentifiers(8),
    popularSlugs: uniqueIdentifiers(24),
    lowSpecSlugs: uniqueIdentifiers(24),
    recommendedSlugs: uniqueIdentifiers(24),
  })
  .strict();

export const editorialAboutConfigSchema = z
  .object({
    hero: z
      .object({
        title: aboutTitle,
        highlight: aboutTitle,
        text: aboutText,
        signals: z.array(aboutCardSchema).length(3),
      })
      .strict(),
    intro: z
      .object({
        title: aboutTitle,
        highlight: aboutTitle,
        paragraphs: z.array(aboutText).length(2),
      })
      .strict(),
    principles: z
      .array(
        z
          .object({
            eyebrow: aboutEyebrow,
            title: aboutTitle,
            text: aboutText,
          })
          .strict()
      )
      .length(3),
    reason: z
      .object({
        title: aboutTitle,
        highlight: aboutTitle,
        paragraphs: z.array(aboutText).length(2),
      })
      .strict(),
    ecosystem: z.array(aboutCardSchema).length(3),
    manifesto: z
      .object({
        title: aboutTitle,
        highlight: aboutTitle,
        text: aboutText,
      })
      .strict(),
    ctaTitle: aboutTitle,
  })
  .strict();

export const editorialGameTaxonomySchema: z.ZodType<GameTaxonomy> = z
  .object({
    categories: taxonomyTerms(80),
    genres: taxonomyTerms(200),
    tags: taxonomyTerms(500),
  })
  .strict();

export type EditorialSiteConfig = z.infer<
  typeof editorialSiteConfigSchema
>;

export type EditorialHomeConfig = z.infer<
  typeof editorialHomeConfigSchema
>;

export type EditorialAboutConfig = z.infer<
  typeof editorialAboutConfigSchema
>;

export type EditorialPayloadByType = {
  game: Game;
  game_update: GameUpdate;
  site_config: EditorialSiteConfig;
  home_config: EditorialHomeConfig;
  about_config: EditorialAboutConfig;
  game_taxonomy: GameTaxonomy;
};

export function parseEditorialPayload<
  Type extends EditorialItemType,
>(type: Type, payload: unknown): EditorialPayloadByType[Type] {
  const schema =
    type === "game"
      ? editorialGameSchema
      : type === "game_update"
        ? editorialUpdateSchema
        : type === "site_config"
          ? editorialSiteConfigSchema
          : type === "home_config"
            ? editorialHomeConfigSchema
            : type === "about_config"
              ? editorialAboutConfigSchema
              : editorialGameTaxonomySchema;

  return schema.parse(payload) as EditorialPayloadByType[Type];
}
