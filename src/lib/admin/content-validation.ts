import { z } from "zod";

import {
  parseEditorialPayload as parseCoreEditorialPayload,
} from "./content-validation-core.ts";
import type {
  EditorialItemType,
  EditorialPayloadByType,
} from "./content-validation-core.ts";

export * from "./content-validation-core.ts";

const bundledImagePattern =
  /^\/images\/[A-Za-z0-9/_.,@+() -]+\.(?:avif|gif|jpe?g|png|webp)$/i;
const editorialMediaPattern =
  /^\/media\/editorial\/[a-z0-9][a-z0-9._-]{0,159}\/[a-f0-9]{64}\.webp$/;

function isSafeLocalImagePath(value: string) {
  if (editorialMediaPattern.test(value)) return true;
  if (
    !bundledImagePattern.test(value) ||
    value.includes("\\") ||
    value.includes("//")
  ) {
    return false;
  }
  return !value
    .split("/")
    .some((segment) => segment === "." || segment === "..");
}

const localImageSchema = z
  .string()
  .max(400)
  .refine(isSafeLocalImagePath);

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
    background: imageViewportSchema.optional(),
    gallery: galleryImageMediaSchema.optional(),
  })
  .strict();

const mediaModeSchema = z.enum([
  "image",
  "video",
  "hover-video",
]);

const mediaModesSchema = z
  .object({
    cover: mediaModeSchema.optional(),
    hero: mediaModeSchema.optional(),
    card: mediaModeSchema.optional(),
    background: mediaModeSchema.optional(),
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

const destinationVideoSchema = z
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
    playback: z.enum(["always", "hover"]).optional(),
  }).strict(),
  z.object({
    source: z.literal("independent"),
    clip: localPreviewClipSchema,
    viewport: videoViewportSchema,
    playback: z.enum(["always", "hover"]).optional(),
  }).strict(),
]);

const videoMediaSchema = z
  .object({
    cover: destinationVideoSchema.optional(),
    hero: destinationVideoSchema.optional(),
    card: cardVideoSchema.optional(),
    background: destinationVideoSchema.optional(),
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
    return {
      core: payload,
      cardImage: undefined,
      backgroundImage: undefined,
      imageMedia: undefined,
      mediaModes: undefined,
      videoMedia: undefined,
    };
  }

  const clean = {
    ...(payload as Record<string, unknown>),
  };
  const cardImage = clean.cardImage === undefined
    ? undefined
    : localImageSchema.parse(clean.cardImage);
  const backgroundImage = clean.backgroundImage === undefined
    ? undefined
    : localImageSchema.parse(clean.backgroundImage);
  const imageMedia = clean.imageMedia === undefined
    ? undefined
    : imageMediaSchema.parse(clean.imageMedia);
  const mediaModes = clean.mediaModes === undefined
    ? undefined
    : mediaModesSchema.parse(clean.mediaModes);
  const videoMedia = clean.videoMedia === undefined
    ? undefined
    : videoMediaSchema.parse(clean.videoMedia);

  delete clean.cardImage;
  delete clean.backgroundImage;
  delete clean.imageMedia;
  delete clean.mediaModes;
  delete clean.videoMedia;

  // Compatibilidad de lectura únicamente. Estas claves pertenecen a las
  // generaciones antiguas de previews externos y ya no forman parte del
  // runtime editorial activo. El único preview publicable es previewClip.
  delete clean.previewMode;
  delete clean.youtubePreview;
  delete clean.directPreview;

  return {
    core: clean,
    cardImage,
    backgroundImage,
    imageMedia,
    mediaModes,
    videoMedia,
  };
}

function inferredMode(
  explicit: "image" | "video" | "hover-video" | undefined,
  video: { playback?: "always" | "hover" } | undefined,
  image: string | undefined,
  fallback: "video" | "hover-video"
) {
  if (explicit) return explicit;
  if (video) return video.playback === "hover" ? "hover-video" : "video";
  if (image) return "image";
  return fallback;
}

function inferredOptionalMode(
  explicit: "image" | "video" | "hover-video" | undefined,
  video: { playback?: "always" | "hover" } | undefined,
  image: string | undefined
) {
  if (explicit) return explicit;
  if (video) return video.playback === "hover" ? "hover-video" : "video";
  if (image) return "image";
  return undefined;
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

  const {
    core,
    cardImage,
    backgroundImage,
    imageMedia,
    mediaModes,
    videoMedia,
  } = splitGameCompatibilityPayload(payload);
  const game = parseCoreEditorialPayload("game", core);

  // Migración compatible: una publicación histórica sin cardImage conserva
  // exactamente su aspecto actual, pero captura la portada de ese snapshot
  // como recurso propio. Cambiar la Portada después ya no cambia la Card.
  const resolvedCardImage = cardImage ?? game.coverImage;
  const backgroundMode = inferredOptionalMode(
    mediaModes?.background,
    videoMedia?.background,
    backgroundImage
  );
  const resolvedMediaModes = {
    cover: inferredMode(
      mediaModes?.cover,
      videoMedia?.cover,
      game.coverImage,
      "video"
    ),
    hero: inferredMode(
      mediaModes?.hero,
      videoMedia?.hero,
      game.heroImage,
      "hover-video"
    ),
    card: inferredMode(
      mediaModes?.card,
      videoMedia?.card,
      resolvedCardImage,
      "hover-video"
    ),
    ...(backgroundMode ? { background: backgroundMode } : {}),
  };

  return {
    ...game,
    ...(resolvedCardImage ? { cardImage: resolvedCardImage } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(imageMedia ? { imageMedia } : {}),
    mediaModes: resolvedMediaModes,
    ...(videoMedia ? { videoMedia } : {}),
  } as EditorialPayloadByType[Type];
}