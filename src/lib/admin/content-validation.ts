import {
  parseEditorialPayload as parseCoreEditorialPayload,
} from "./content-validation-core.ts";
import type {
  EditorialItemType,
  EditorialPayloadByType,
} from "./content-validation-core.ts";

export * from "./content-validation-core.ts";

function withoutLegacyExternalPreview(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return payload;
  }

  const clean = {
    ...(payload as Record<string, unknown>),
  };

  // Compatibilidad de lectura únicamente. Estas claves pertenecen a las
  // generaciones antiguas de previews externos y ya no forman parte del
  // runtime editorial activo. El único preview publicable es previewClip.
  delete clean.previewMode;
  delete clean.youtubePreview;
  delete clean.directPreview;

  return clean;
}

export function parseEditorialPayload<
  Type extends EditorialItemType,
>(
  type: Type,
  payload: unknown
): EditorialPayloadByType[Type] {
  return parseCoreEditorialPayload(
    type,
    type === "game"
      ? withoutLegacyExternalPreview(payload)
      : payload
  );
}
