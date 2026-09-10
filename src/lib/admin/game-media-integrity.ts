import "server-only";

import { lstat } from "node:fs/promises";
import path from "node:path";

import type { Game } from "@/types/game";

import {
  EDITORIAL_MEDIA_PUBLIC_PREFIX,
  resolveEditorialMediaDiskPath,
} from "@/lib/media/editorial-media";
import {
  galleryImageSources,
  galleryVideoSources,
  resolveGameGalleryItems,
} from "@/lib/media/game-gallery-media";

export type GameMediaIntegrityResult = {
  ok: boolean;
  missing: string[];
  invalidOwnership: string[];
};

export function listGameImageReferences(
  game: Game
) {
  const galleryItems = resolveGameGalleryItems(game);
  return Array.from(
    new Set(
      [
        game.coverImage,
        game.heroImage,
        game.cardImage,
        game.detailImage,
        game.backgroundImage,
        // Compatibilidad defensiva: screenshots sigue siendo un campo válido
        // para snapshots históricos. Se verifica explícitamente además de la
        // Galería mixta para que ningún payload legado pueda eludir integridad.
        ...(game.screenshots ?? []),
        ...galleryImageSources(galleryItems),
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
  const galleryItems = resolveGameGalleryItems(game);

  return Array.from(
    new Set(
      [
        game.videoMedia?.cover?.clip,
        game.videoMedia?.hero?.clip,
        independentCardClip,
        game.videoMedia?.detail?.clip,
        game.videoMedia?.background?.clip,
        ...galleryVideoSources(galleryItems),
        game.previewClip,
      ].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

export function listInvalidGameMediaOwnership(
  game: Game
) {
  const editorialPrefix =
    `${EDITORIAL_MEDIA_PUBLIC_PREFIX}/`;
  const ownedPrefix =
    `${EDITORIAL_MEDIA_PUBLIC_PREFIX}/${game.slug}/`;
  const references = [
    ...listGameImageReferences(game),
    ...listGameVideoReferences(game),
  ];

  return Array.from(
    new Set(
      references.filter(
        (reference) =>
          reference.startsWith(editorialPrefix) &&
          !reference.startsWith(ownedPrefix)
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
    invalidOwnership: [],
  };
}

export async function inspectGameMediaIntegrity(
  game: Game
): Promise<GameMediaIntegrityResult> {
  const mediaPaths = [
    ...listGameImageReferences(game),
    ...listGameVideoReferences(game),
  ];
  const physical = await inspectLocalImageReferences(
    mediaPaths
  );
  const invalidOwnership =
    listInvalidGameMediaOwnership(game);

  return {
    ok:
      physical.ok &&
      invalidOwnership.length === 0,
    missing: physical.missing,
    invalidOwnership,
  };
}
