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

function splitGameCompatibilityPayload(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return { core: payload, imageMedia: undefined };
  }

  const clean = {
    ...(payload as Record<string, unknown>),
  };
  const imageMedia = clean.imageMedia === undefined
    ? undefined
    : imageMediaSchema.parse(clean.imageMedia);

  delete clean.imageMedia;

  // Compatibilidad de lectura únicamente. Estas claves pertenecen a las
  // generaciones antiguas de previews externos y ya no forman parte del
  // runtime editorial activo. El único preview publicable es previewClip.
  delete clean.previewMode;
  delete clean.youtubePreview;
  delete clean.directPreview;

  return { core: clean, imageMedia };
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

  const { core, imageMedia } = splitGameCompatibilityPayload(payload);
  const game = parseCoreEditorialPayload("game", core);

  return {
    ...game,
    ...(imageMedia ? { imageMedia } : {}),
  } as EditorialPayloadByType[Type];
}
