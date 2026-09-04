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

const imageViewportAspectSchema = z.enum([
  "16:9",
  "3:2",
  "1:1",
  "4:5",
  "9:16",
  "free",
]);

const fixedImageViewportSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(3),
    confirmed: z.literal(true).optional(),
  })
  .strict();

const galleryImageViewportSchema = fixedImageViewportSchema
  .extend({
    aspect: imageViewportAspectSchema.optional(),
    aspectRatio: z.number().min(0.1).max(10).optional(),
  })
  .strict()
  .superRefine((viewport, context) => {
    if (viewport.aspect === "free" && viewport.aspectRatio === undefined) {
      context.addIssue({
        code: "custom",
        path: ["aspectRatio"],
        message: "Un recorte libre debe conservar su relación exacta.",
      });
    }
    if (viewport.aspect !== "free" && viewport.aspectRatio !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["aspectRatio"],
        message: "La relación numérica sólo corresponde a un recorte libre.",
      });
    }
  });

const galleryImageMediaSchema = z.record(
  z.string().min(1).max(400),
  galleryImageViewportSchema
);

const imageMediaSchema = z
  .object({
    cover: fixedImageViewportSchema.optional(),
    hero: fixedImageViewportSchema.optional(),
    card: fixedImageViewportSchema.optional(),
    detail: fixedImageViewportSchema.optional(),
    background: fixedImageViewportSchema.optional(),
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
    detail: mediaModeSchema.optional(),
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
    detail: destinationVideoSchema.optional(),
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

const performanceMetadataSchema = z
  .object({
    source: z
      .enum(["internal", "developer", "publisher", "community", "external"])
      .optional(),
    sourceLabel: z.string().trim().min(1).max(160).optional(),
    measuredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          Number.isFinite(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      })
      .optional(),
    confidence: z.enum(["low", "medium", "high"]).optional(),
  })
  .strict();

const galleryMediaSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("image"),
        src: localImageSchema,
      }).strict(),
      z.object({
        kind: z.literal("video"),
        src: localPreviewClipSchema,
        viewport: videoViewportSchema,
      }).strict(),
    ])
  )
  .max(8)
  .superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = `${item.kind}:${item.src}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index, "src"],
          message: "Un mismo recurso no puede repetirse dentro de la Galería.",
        });
      }
      seen.add(key);
    });
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
      detailImage: undefined,
      backgroundImage: undefined,
      galleryMedia: undefined,
      imageMedia: undefined,
      mediaModes: undefined,
      videoMedia: undefined,
      performanceMetadata: undefined,
    };
  }

  const clean = {
    ...(payload as Record<string, unknown>),
  };
  const cardImage = clean.cardImage === undefined
    ? undefined
    : localImageSchema.parse(clean.cardImage);
  const detailImage = clean.detailImage === undefined
    ? undefined
    : localImageSchema.parse(clean.detailImage);
  const backgroundImage = clean.backgroundImage === undefined
    ? undefined
    : localImageSchema.parse(clean.backgroundImage);
  const galleryMedia = clean.galleryMedia === undefined
    ? undefined
    : galleryMediaSchema.parse(clean.galleryMedia);
  const imageMedia = clean.imageMedia === undefined
    ? undefined
    : imageMediaSchema.parse(clean.imageMedia);
  const mediaModes = clean.mediaModes === undefined
    ? undefined
    : mediaModesSchema.parse(clean.mediaModes);
  const videoMedia = clean.videoMedia === undefined
    ? undefined
    : videoMediaSchema.parse(clean.videoMedia);
  const performanceMetadata = clean.performanceMetadata === undefined
    ? undefined
    : performanceMetadataSchema.parse(clean.performanceMetadata);

  delete clean.cardImage;
  delete clean.detailImage;
  delete clean.backgroundImage;
  delete clean.galleryMedia;
  delete clean.imageMedia;
  delete clean.mediaModes;
  delete clean.videoMedia;
  delete clean.performanceMetadata;

  // Compatibilidad de lectura únicamente. Estas claves pertenecen a las
  // generaciones antiguas de previews externos y ya no forman parte del
  // runtime editorial activo. El único preview publicable es previewClip.
  delete clean.previewMode;
  delete clean.youtubePreview;
  delete clean.directPreview;

  return {
    core: clean,
    cardImage,
    detailImage,
    backgroundImage,
    galleryMedia,
    imageMedia,
    mediaModes,
    videoMedia,
    performanceMetadata,
  };
}

function inferredMode(
  explicit: "image" | "video" | "hover-video" | undefined,
  video: { playback?: "always" | "hover" } | undefined,
  image: string | undefined,
  fallback: "image" | "video" | "hover-video"
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
    detailImage,
    backgroundImage,
    galleryMedia,
    imageMedia,
    mediaModes,
    videoMedia,
    performanceMetadata,
  } = splitGameCompatibilityPayload(payload);
  const game = parseCoreEditorialPayload("game", core);

  // Migración compatible: una publicación histórica sin cardImage conserva
  // exactamente su aspecto actual, pero captura la portada de ese snapshot
  // como recurso propio. Cambiar la Portada después ya no cambia la Card.
  const resolvedCardImage = cardImage ?? game.coverImage;

  // Compatibilidad del Contenedor: antes la ficha reutilizaba directamente el
  // Hero (o Portada). Capturamos esa misma referencia y encuadre como metadata
  // propia, sin copiar bytes, para que desde aquí cambie de forma independiente.
  const resolvedDetailImage = detailImage ?? game.heroImage ?? game.coverImage;
  const legacyDetailMigration = detailImage === undefined && Boolean(resolvedDetailImage);
  const inheritedDetailViewport = game.heroImage && resolvedDetailImage === game.heroImage
    ? imageMedia?.hero
    : imageMedia?.cover;
  const resolvedImageMedia = legacyDetailMigration
    ? {
        ...imageMedia,
        detail: {
          x: inheritedDetailViewport?.x ?? 0.5,
          y: inheritedDetailViewport?.y ?? 0.5,
          zoom: inheritedDetailViewport?.zoom ?? 1,
          confirmed: true as const,
        },
      }
    : imageMedia;

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
    detail: inferredMode(
      mediaModes?.detail,
      videoMedia?.detail,
      resolvedDetailImage,
      "image"
    ),
    ...(backgroundMode ? { background: backgroundMode } : {}),
  };

  return {
    ...game,
    ...(resolvedCardImage ? { cardImage: resolvedCardImage } : {}),
    ...(resolvedDetailImage ? { detailImage: resolvedDetailImage } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(galleryMedia !== undefined ? { galleryMedia } : {}),
    ...(resolvedImageMedia ? { imageMedia: resolvedImageMedia } : {}),
    mediaModes: resolvedMediaModes,
    ...(videoMedia ? { videoMedia } : {}),
    ...(performanceMetadata ? { performanceMetadata } : {}),
  } as EditorialPayloadByType[Type];
}
