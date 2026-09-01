import { z } from "zod";

import {
  DIRECT_PREVIEW_PLATFORM_VALUES,
  isDirectPreviewPlatformValue,
  validateDirectPreviewEditorialValue,
} from "../media/direct-platform-validation.ts";
import type {
  Game,
  GameDirectPreview,
} from "../../types/game.ts";

import {
  parseEditorialPayload as parseCoreEditorialPayload,
} from "./content-validation-core.ts";
import type {
  EditorialItemType,
  EditorialPayloadByType,
} from "./content-validation-core.ts";

export * from "./content-validation-core.ts";

const directPreviewInputSchema = z
  .object({
    platform: z.enum(DIRECT_PREVIEW_PLATFORM_VALUES),
    url: z.string().trim().min(1).max(2_048),
    startSeconds: z.number().min(0).max(86_400),
    endSeconds: z.number().positive().max(86_400),
  })
  .strict();

function parseDirectPreview(value: unknown): GameDirectPreview | undefined {
  if (value === undefined) return undefined;

  const parsed = directPreviewInputSchema.parse(value);

  if (!validateDirectPreviewEditorialValue(parsed)) {
    throw new Error(
      "El preview directo no coincide con su plataforma o su tramo no es válido."
    );
  }

  return parsed;
}

function parseGamePayload(payload: unknown): Game {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return parseCoreEditorialPayload(
      "game",
      payload
    );
  }

  const raw = payload as Record<string, unknown>;
  const directPreview = parseDirectPreview(
    raw.directPreview
  );
  const directMode = isDirectPreviewPlatformValue(
    raw.previewMode
  )
    ? raw.previewMode
    : null;

  if (
    directMode &&
    (
      !directPreview ||
      directPreview.platform !== directMode
    )
  ) {
    throw new Error(
      "El modo de preview directo debe coincidir con la plataforma guardada."
    );
  }

  const corePayload: Record<string, unknown> = {
    ...raw,
  };
  delete corePayload.directPreview;

  if (directMode) {
    delete corePayload.previewMode;
  }

  const core = parseCoreEditorialPayload(
    "game",
    corePayload
  );

  return {
    ...core,
    ...(directPreview ? { directPreview } : {}),
    ...(directMode ? { previewMode: directMode } : {}),
  };
}

export function parseEditorialPayload<
  Type extends EditorialItemType,
>(
  type: Type,
  payload: unknown
): EditorialPayloadByType[Type] {
  if (type === "game") {
    return parseGamePayload(
      payload
    ) as EditorialPayloadByType[Type];
  }

  return parseCoreEditorialPayload(
    type,
    payload
  );
}
