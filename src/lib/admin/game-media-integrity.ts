import "server-only";

import { lstat } from "node:fs/promises";
import path from "node:path";

import type { Game } from "@/types/game";

import {
  resolveEditorialMediaDiskPath,
} from "@/lib/media/editorial-media";

export type GameMediaIntegrityResult = {
  ok: boolean;
  missing: string[];
};

export function listGameImageReferences(
  game: Game
) {
  return Array.from(
    new Set(
      [
        game.coverImage,
        game.heroImage,
        game.cardImage,
        game.detailImage,
        game.backgroundImage,
        ...(game.screenshots ?? []),
      ].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

export function listGameVideoReferences(
  game: Game
) {
  const independentCardClip =
    game.videoMedia?.card?.source === "independent"
      ? game.videoMedia.card.clip
      : undefined;

  return Array.from(
    new Set(
      [
        game.videoMedia?.cover?.clip,
        game.videoMedia?.hero?.clip,
        independentCardClip,
        game.videoMedia?.detail?.clip,
        game.videoMedia?.background?.clip,
        game.previewClip,
      ].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

async function fileIsRegular(
  absolutePath: string
) {
  try {
    const stats = await lstat(absolutePath);
    return (
      stats.isFile() &&
      !stats.isSymbolicLink()
    );
  } catch {
    return false;
  }
}

async function bundledImageExists(
  mediaPath: string
) {
  const publicRoot = path.resolve(
    process.cwd(),
    "public"
  );
  const imagesRoot = path.resolve(
    publicRoot,
    "images"
  );
  const absolutePath = path.resolve(
    publicRoot,
    `.${mediaPath}`
  );

  if (
    !absolutePath.startsWith(
      `${imagesRoot}${path.sep}`
    )
  ) {
    return false;
  }

  return fileIsRegular(absolutePath);
}

async function editorialMediaExists(
  mediaPath: string
) {
  try {
    const resolved =
      resolveEditorialMediaDiskPath(mediaPath);

    return resolved
      ? fileIsRegular(resolved.filePath)
      : false;
  } catch {
    return false;
  }
}

async function localMediaExists(
  mediaPath: string
) {
  if (mediaPath.startsWith("/media/editorial/")) {
    return editorialMediaExists(mediaPath);
  }

  if (mediaPath.startsWith("/images/")) {
    return bundledImageExists(mediaPath);
  }

  return false;
}

export async function inspectLocalImageReferences(
  mediaPaths: string[]
): Promise<GameMediaIntegrityResult> {
  const missing: string[] = [];

  for (const mediaPath of new Set(mediaPaths)) {
    if (!(await localMediaExists(mediaPath))) {
      missing.push(mediaPath);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

export async function inspectGameMediaIntegrity(
  game: Game
): Promise<GameMediaIntegrityResult> {
  const mediaPaths = [
    ...listGameImageReferences(game),
    ...listGameVideoReferences(game),
  ];

  return inspectLocalImageReferences(mediaPaths);
}