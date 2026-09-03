import { z } from "zod";

import {
  parseEditorialPayload as parseCoreEditorialPayload,
} from "./content-validation-core.ts";
import type {
  EditorialItemType,
  EditorialPayloadByType,
} from "./content-validation-core.ts";

export * from "./content-validation-core.ts";

const imageViewportSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(3),
    confirmed: z.literal(true).optional(),
  })
  .strict();

const galleryImageMediaSchema = z.record(
  z.string().min(1).max(400),
  imageViewportSchema
);

const imageMediaSchema = z
  .object({
    cover: imageViewportSchema.optional(),
    hero: imageViewportSchema.optional(),
    card: imageViewportSchema.optional(),
    gallery: galleryImageMediaSchema.optional(),
  })
  .strict();

const localPreviewClipSchema = z
  .string()
  .max(400)
  .regex(
    /^\/media\/editorial\/[a-z0-9][a-z0-9._-]{0,159}\/[a-f0-9]{64}\.webm$/
  );

const videoViewportSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(3),
    aspect: z.enum(["source", "16:9", "3:2", "1:1", "4:5", "9:16"]),
    confirmed: z.literal(true).optional(),
  })
  .strict();

const heroVideoSchema = z
  .object({
    clip: localPreviewClipSchema,
    viewport: videoViewportSchema,
    playback: z.enum(["always", "hover"]).optional(),
  })
  .strict();

const cardVideoSchema = z.union([
  z.object({
    source: z.literal("hero"),
    viewport: videoViewportSchema,
  }).strict(),
  z.object({
    source: z.literal("independent"),
    clip: localPreviewClipSchema,
    viewport: videoViewportSchema,
  }).strict(),
]);

const videoMediaSchema = z
  .object({
    hero: heroVideoSchema.optional(),
    card: cardVideoSchema.optional(),
  })
  .strict()
  .superRefine((media, context) => {
    if (media.card?.source === "hero" && !media.hero) {
      context.addIssue({
        code: "custom",
        path: ["card", "source"],
        message: "La Card sólo puede compartir el video del Hero cuando existe un Hero de video configurado.",
      });
    }
  });

function splitGameCompatibilityPayload(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return { core: payload, imageMedia: undefined, videoMedia: undefined };
  }

  const clean = {
    ...(payload as Record<string, unknown>),
  };
  const imageMedia = clean.imageMedia === undefined
    ? undefined
    : imageMediaSchema.parse(clean.imageMedia);
  const videoMedia = clean.videoMedia === undefined
    ? undefined
    : videoMediaSchema.parse(clean.videoMedia);

  delete clean.imageMedia;
  delete clean.videoMedia;

  // Compatibilidad de lectura únicamente. Estas claves pertenecen a las
  // generaciones antiguas de previews externos y ya no forman parte del
  // runtime editorial activo. El único preview publicable es previewClip.
  delete clean.previewMode;
  delete clean.youtubePreview;
  delete clean.directPreview;

  return { core: clean, imageMedia, videoMedia };
}

export function parseEditorialPayload<
  Type extends EditorialItemType,
>(
  type: Type,
  payload: unknown
): EditorialPayloadByType[Type] {
  if (type !== "game") {
    return parseCoreEditorialPayload(
      type,
      payload
    );
  }

  const { core, imageMedia, videoMedia } = splitGameCompatibilityPayload(payload);
  const game = parseCoreEditorialPayload("game", core);

  return {
    ...game,
    ...(imageMedia ? { imageMedia } : {}),
    ...(videoMedia ? { videoMedia } : {}),
  } as EditorialPayloadByType[Type];
}