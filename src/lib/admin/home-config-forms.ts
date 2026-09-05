import { z } from "zod";

import {
  HOME_HERO_MAX_SLIDES,
} from "@/lib/home/hero-contract";

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

const positionStyleSchema = z.object({
  scale: z.number().min(.4).max(1.6),
  rotateX: z.number().min(-60).max(60), rotateY: z.number().min(-60).max(60), rotateZ: z.number().min(-30).max(30),
  translateX: z.number().min(-300).max(300), translateY: z.number().min(-200).max(200), translateZ: z.number().min(-500).max(500),
  opacity: z.number().min(0).max(100), blur: z.number().min(0).max(20), brightness: z.number().min(20).max(180), contrast: z.number().min(50).max(180), saturation: z.number().min(0).max(200),
}).strict();

// The renderer uses uniform fitting, so large editorial frames are safe: they
// are scaled around the Hero center only when the selected viewport requires it.
// Spacing defaults keep old saved/session drafts visually compatible with the
// margins that previously collapsed between the Hero and its next section.
function responsiveStyleSchema(spaceBefore: number, spaceAfter: number) {
  return z.object({
    visibleCards: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    alignment: z.enum(["left", "center", "right"]).optional(),
    hiddenPositions: z.array(z.enum(["left1", "left2", "right1", "right2"])).max(4).refine((items) => new Set(items).size === items.length).optional(),
    cardWidth: z.number().int().min(260).max(1800), cardHeight: z.number().int().min(220).max(1200),
    gap: z.number().int().min(0).max(100), perspective: z.number().int().min(400).max(2400),
    spaceBefore: z.number().int().min(0).max(160).default(spaceBefore),
    spaceAfter: z.number().int().min(0).max(200).default(spaceAfter),
  }).strict();
}

const navigationStyles = ["segmented-pro", "integrated", "pills", "dots", "timeline", "minimal", "glass", "rail"] as const;
const navigationDefaults = {
  desktop: { x: 50, y: 91, scale: 100 },
  tablet: { x: 50, y: 91, scale: 100 },
  mobile: { x: 50, y: 92, scale: 92 },
} as const;

function navigationPlacementSchema(defaults: { x: number; y: number; scale: number }) {
  return z.object({
    x: z.number().int().min(0).max(100).default(defaults.x),
    y: z.number().int().min(0).max(100).default(defaults.y),
    scale: z.number().int().min(50).max(180).default(defaults.scale),
  }).strict().default(defaults);
}

const navigationSchema = z.object({
  style: z.enum(navigationStyles).default("segmented-pro"),
  showIndicators: z.boolean().default(true),
  showPause: z.boolean().default(true),
  showProgress: z.boolean().default(true),
  responsive: z.object({
    desktop: navigationPlacementSchema(navigationDefaults.desktop),
    tablet: navigationPlacementSchema(navigationDefaults.tablet),
    mobile: navigationPlacementSchema(navigationDefaults.mobile),
  }).strict().default(navigationDefaults),
}).strict().default({
  style: "segmented-pro",
  showIndicators: true,
  showPause: true,
  showProgress: true,
  responsive: navigationDefaults,
});

const heroPresentationSchema = z.object({
  composition: z.enum(["studio", "cinema", "focus"]),
  previewCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  motion: z.enum(["depth", "slide", "fade"]),
  autoplayMs: z.union([z.literal(0), z.literal(4000), z.literal(6500), z.literal(8000)]),
  preset: z.enum(["classic", "coverflow", "cinema", "stack", "arc", "perspective", "minimal", "spotlight", "cards", "custom"]),
  transition: z.enum(["slide", "coverflow", "fade", "3d", "stack", "perspective", "custom"]),
  durationMs: z.number().int().min(150).max(2000),
  easing: z.enum(["ease", "ease-in", "ease-out", "ease-in-out", "linear"]),
  radius: z.number().int().min(0).max(48), shadow: z.number().int().min(0).max(100), borderWidth: z.number().int().min(0).max(6), glow: z.number().int().min(0).max(100), overlay: z.number().int().min(0).max(90),
  autoplay: z.boolean(), loop: z.boolean(), pauseOnHover: z.boolean(), drag: z.boolean(), touch: z.boolean(), keyboard: z.boolean(), wheel: z.boolean(), direction: z.enum(["forward", "reverse"]),
  positions: z.object({ all: positionStyleSchema, main: positionStyleSchema, left1: positionStyleSchema, left2: positionStyleSchema, right1: positionStyleSchema, right2: positionStyleSchema }).strict(),
  responsive: z.object({ desktop: responsiveStyleSchema(28, 58), tablet: responsiveStyleSchema(20, 58), mobile: responsiveStyleSchema(14, 38) }).strict(),
  navigation: navigationSchema,
}).strict();

const heroCopySchema = z.object({
  accessibleTitle: z.string().trim().min(1).max(180),
  primaryCta: z.string().trim().min(1).max(100),
  secondaryCta: z.string().trim().min(1).max(100),
}).strict();

const heroJsonSchema = z.string().max(20_000).transform((value, context) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    context.addIssue({ code: "custom", message: "La configuración del Hero no contiene JSON válido." });
    return z.NEVER;
  }
}).pipe(z.object({
  mode: modeSchema,
  slugs: slugArraySchema(HOME_HERO_MAX_SLIDES),
  presentation: heroPresentationSchema,
  copy: heroCopySchema,
}).strict());

export const homeHeroEditorFormSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  heroJson: heroJsonSchema,
}).strict();
