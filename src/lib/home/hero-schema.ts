import { z } from "zod";

import {
  homeHeroCompositionIds,
  homeHeroNavigationStyleIds,
  homeHeroPresetIds,
} from "@/data/home-config";

const visibleCardsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const previewCountSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const autoplayMsSchema = z.union([
  z.literal(0),
  z.literal(4000),
  z.literal(6500),
  z.literal(8000),
]);

const transitionSchema = z.enum([
  "slide",
  "coverflow",
  "fade",
  "3d",
  "stack",
  "perspective",
  "custom",
]);

const easingSchema = z.enum([
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
]);

const visualPositionSchema = z.enum([
  "left1",
  "left2",
  "right1",
  "right2",
]);

export const homeHeroPositionStyleSchema = z
  .object({
    scale: z.number().min(0.4).max(1.6),
    rotateX: z.number().min(-60).max(60),
    rotateY: z.number().min(-60).max(60),
    rotateZ: z.number().min(-30).max(30),
    translateX: z.number().min(-300).max(300),
    translateY: z.number().min(-200).max(200),
    translateZ: z.number().min(-500).max(500),
    opacity: z.number().min(0).max(100),
    blur: z.number().min(0).max(20),
    brightness: z.number().min(20).max(180),
    contrast: z.number().min(50).max(180),
    saturation: z.number().min(0).max(200),
  })
  .strict();

function hiddenPositionsSchema() {
  return z
    .array(visualPositionSchema)
    .max(4)
    .refine(
      (items) => new Set(items).size === items.length,
      "Una posición del Hero no puede ocultarse más de una vez."
    );
}

function persistedResponsiveStyleSchema() {
  return z
    .object({
      visibleCards: visibleCardsSchema,
      alignment: z.enum(["left", "center", "right"]).optional(),
      hiddenPositions: hiddenPositionsSchema().optional(),
      cardWidth: z.number().int().min(260).max(1800),
      cardHeight: z.number().int().min(220).max(1200),
      gap: z.number().int().min(0).max(100),
      perspective: z.number().int().min(400).max(2400),
      spaceBefore: z.number().int().min(0).max(160).optional(),
      spaceAfter: z.number().int().min(0).max(200).optional(),
      spacingReference: z.enum(["visual", "canvas"]).optional(),
    })
    .strict();
}

function editorResponsiveStyleSchema(
  spaceBefore: number,
  spaceAfter: number
) {
  return z
    .object({
      visibleCards: visibleCardsSchema,
      alignment: z.enum(["left", "center", "right"]).optional(),
      hiddenPositions: hiddenPositionsSchema().optional(),
      cardWidth: z.number().int().min(260).max(1800),
      cardHeight: z.number().int().min(220).max(1200),
      gap: z.number().int().min(0).max(100),
      perspective: z.number().int().min(400).max(2400),
      spaceBefore: z
        .number()
        .int()
        .min(0)
        .max(160)
        .default(spaceBefore),
      spaceAfter: z
        .number()
        .int()
        .min(0)
        .max(200)
        .default(spaceAfter),
      spacingReference: z
        .enum(["visual", "canvas"])
        .default("visual"),
    })
    .strict();
}

const navigationDefaults = {
  desktop: { x: 50, y: 91, scale: 100 },
  tablet: { x: 50, y: 91, scale: 100 },
  mobile: { x: 50, y: 92, scale: 92 },
} as const;

function navigationPlacementSchema() {
  return z
    .object({
      x: z.number().int().min(0).max(100),
      y: z.number().int().min(0).max(100),
      scale: z.number().int().min(50).max(180),
    })
    .strict();
}

function editorNavigationPlacementSchema(defaults: {
  x: number;
  y: number;
  scale: number;
}) {
  return z
    .object({
      x: z.number().int().min(0).max(100).default(defaults.x),
      y: z.number().int().min(0).max(100).default(defaults.y),
      scale: z
        .number()
        .int()
        .min(50)
        .max(180)
        .default(defaults.scale),
    })
    .strict()
    .default(defaults);
}

const persistedNavigationSchema = z
  .object({
    style: z.enum(homeHeroNavigationStyleIds),
    showIndicators: z.boolean(),
    showPause: z.boolean(),
    showProgress: z.boolean(),
    responsive: z
      .object({
        desktop: navigationPlacementSchema(),
        tablet: navigationPlacementSchema(),
        mobile: navigationPlacementSchema(),
      })
      .strict(),
  })
  .strict();

const editorNavigationSchema = z
  .object({
    style: z
      .enum(homeHeroNavigationStyleIds)
      .default("segmented-pro"),
    showIndicators: z.boolean().default(true),
    showPause: z.boolean().default(true),
    showProgress: z.boolean().default(true),
    responsive: z
      .object({
        desktop: editorNavigationPlacementSchema(
          navigationDefaults.desktop
        ),
        tablet: editorNavigationPlacementSchema(
          navigationDefaults.tablet
        ),
        mobile: editorNavigationPlacementSchema(
          navigationDefaults.mobile
        ),
      })
      .strict()
      .default(navigationDefaults),
  })
  .strict()
  .default({
    style: "segmented-pro",
    showIndicators: true,
    showPause: true,
    showProgress: true,
    responsive: navigationDefaults,
  });

const persistedPositionsSchema = z
  .object({
    all: homeHeroPositionStyleSchema.optional(),
    main: homeHeroPositionStyleSchema.optional(),
    left1: homeHeroPositionStyleSchema.optional(),
    left2: homeHeroPositionStyleSchema.optional(),
    right1: homeHeroPositionStyleSchema.optional(),
    right2: homeHeroPositionStyleSchema.optional(),
  })
  .strict();

const editorPositionsSchema = z
  .object({
    all: homeHeroPositionStyleSchema,
    main: homeHeroPositionStyleSchema,
    left1: homeHeroPositionStyleSchema,
    left2: homeHeroPositionStyleSchema,
    right1: homeHeroPositionStyleSchema,
    right2: homeHeroPositionStyleSchema,
  })
  .strict();

const persistedResponsiveSchema = z
  .object({
    desktop: persistedResponsiveStyleSchema().optional(),
    tablet: persistedResponsiveStyleSchema().optional(),
    mobile: persistedResponsiveStyleSchema().optional(),
  })
  .strict();

const commonRequiredFields = {
  composition: z.enum(homeHeroCompositionIds),
  previewCount: previewCountSchema,
  motion: z.enum(["depth", "slide", "fade"]),
  autoplayMs: autoplayMsSchema,
} as const;

const optionalPresentationFields = {
  preset: z.enum(homeHeroPresetIds).optional(),
  transition: transitionSchema.optional(),
  durationMs: z.number().int().min(150).max(2000).optional(),
  easing: easingSchema.optional(),
  radius: z.number().int().min(0).max(48).optional(),
  shadow: z.number().int().min(0).max(100).optional(),
  borderWidth: z.number().int().min(0).max(6).optional(),
  glow: z.number().int().min(0).max(100).optional(),
  overlay: z.number().int().min(0).max(90).optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  pauseOnHover: z.boolean().optional(),
  drag: z.boolean().optional(),
  touch: z.boolean().optional(),
  keyboard: z.boolean().optional(),
  wheel: z.boolean().optional(),
  direction: z.enum(["forward", "reverse"]).optional(),
} as const;

/**
 * Persisted Home revisions may predate individual Hero controls. Keep those
 * newer fields optional, but validate every value against the same bounds used
 * by the current editor and reject unknown position/device keys.
 */
const basePresentationInputSchema = z
  .object({
    ...commonRequiredFields,
    ...optionalPresentationFields,
    positions: persistedPositionsSchema.optional(),
    responsive: persistedResponsiveSchema.optional(),
    navigation: persistedNavigationSchema.optional(),
  })
  .strict();

/**
 * Fully resolved editor contract. Defaults only cover fields introduced after
 * older local/session drafts existed; current server drafts already resolve to
 * the complete shape before reaching the editor.
 */
const basePresentationEditorSchema = z
  .object({
    ...commonRequiredFields,
    preset: z.enum(homeHeroPresetIds),
    transition: transitionSchema,
    durationMs: z.number().int().min(150).max(2000),
    easing: easingSchema,
    radius: z.number().int().min(0).max(48),
    shadow: z.number().int().min(0).max(100),
    borderWidth: z.number().int().min(0).max(6),
    glow: z.number().int().min(0).max(100),
    overlay: z.number().int().min(0).max(90),
    autoplay: z.boolean(),
    loop: z.boolean(),
    pauseOnHover: z.boolean(),
    drag: z.boolean(),
    touch: z.boolean(),
    keyboard: z.boolean(),
    wheel: z.boolean(),
    direction: z.enum(["forward", "reverse"]),
    positions: editorPositionsSchema,
    responsive: z
      .object({
        desktop: editorResponsiveStyleSchema(28, 58),
        tablet: editorResponsiveStyleSchema(20, 58),
        mobile: editorResponsiveStyleSchema(14, 38),
      })
      .strict(),
    navigation: editorNavigationSchema,
  })
  .strict();

// Device snapshots are bounded: they cannot contain further overrides.
const deviceOverridesSchema = z.object({
  desktop: basePresentationEditorSchema.optional(),
  tablet: basePresentationEditorSchema.optional(),
  mobile: basePresentationEditorSchema.optional(),
}).strict().optional();

export const homeHeroPresentationInputSchema = basePresentationInputSchema.extend({
  deviceOverrides: deviceOverridesSchema,
});
export const homeHeroPresentationEditorSchema = basePresentationEditorSchema.extend({
  deviceOverrides: deviceOverridesSchema,
});
