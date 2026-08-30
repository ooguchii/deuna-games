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

async function editorialImageExists(
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

async function localImageExists(
  mediaPath: string
) {
  if (mediaPath.startsWith("/media/editorial/")) {
    return editorialImageExists(mediaPath);
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
    if (!(await localImageExists(mediaPath))) {
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
    game.coverImage,
    game.heroImage,
    ...(game.screenshots ?? []),
  ].filter(
    (value): value is string => Boolean(value)
  );

  return inspectLocalImageReferences(mediaPaths);
}
