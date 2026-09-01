import "server-only";

import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  downloadPlatformEditorialVideo,
} from "./platform-video-source";
import {
  parseSupportedPlatformVideoUrl,
} from "./platform-video-url";
import {
  downloadRemoteEditorialVideo,
  MAX_REMOTE_PREVIEW_BYTES,
} from "./remote-video-source";

const STAGING_TTL_MS = 30 * 60 * 1_000;
const MAX_STAGED_SOURCES = 8;
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const METADATA_SUFFIX = ".json";
const SOURCE_SUFFIX = ".video";
const PART_SUFFIX = `${SOURCE_SUFFIX}.part`;

export type StagedEditorialPreviewSource = {
  token: string;
  slug: string;
  userId: string;
  filePath: string;
  bytes: number;
  contentType: string;
  sourceUrl: string;
  expiresAt: number;
};

type StagedMetadata = Omit<
  StagedEditorialPreviewSource,
  "filePath"
>;

function stagingRoot() {
  return path.join(
    os.tmpdir(),
    "deuna-preview-sources"
  );
}

function metadataPath(token: string) {
  return path.join(
    stagingRoot(),
    `${token}${METADATA_SUFFIX}`
  );
}

function sourcePath(token: string) {
  return path.join(
    stagingRoot(),
    `${token}${SOURCE_SUFFIX}`
  );
}

function validToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

function tokenFromArtifact(entry: string) {
  for (const suffix of [
    METADATA_SUFFIX,
    SOURCE_SUFFIX,
    PART_SUFFIX,
  ]) {
    if (!entry.endsWith(suffix)) continue;

    const token = entry.slice(0, -suffix.length);
    return validToken(token) ? token : null;
  }

  return null;
}

async function ensureStagingRoot() {
  const root = stagingRoot();
  await mkdir(root, {
    recursive: true,
    mode: 0o700,
  });

  const stats = await lstat(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(
      "El staging temporal de previews no es seguro."
    );
  }

  return root;
}

async function readMetadata(
  token: string
): Promise<StagedMetadata | null> {
  if (!validToken(token)) return null;

  try {
    const raw = await readFile(
      metadataPath(token),
      "utf8"
    );
    const value = JSON.parse(raw) as Partial<StagedMetadata>;

    if (
      value.token !== token ||
      typeof value.slug !== "string" ||
      typeof value.userId !== "string" ||
      typeof value.bytes !== "number" ||
      typeof value.contentType !== "string" ||
      typeof value.sourceUrl !== "string" ||
      typeof value.expiresAt !== "number"
    ) {
      return null;
    }

    return value as StagedMetadata;
  } catch {
    return null;
  }
}

export async function removeStagedEditorialPreviewSource(
  token: string
) {
  if (!validToken(token)) return;

  await Promise.all([
    rm(metadataPath(token), { force: true }),
    rm(sourcePath(token), { force: true }),
    rm(`${sourcePath(token)}.part`, { force: true }),
  ]);
}

async function artifactIsAbandoned(
  root: string,
  entry: string,
  now: number
) {
  try {
    const stats = await lstat(
      path.join(root, entry)
    );

    if (!stats.isFile() || stats.isSymbolicLink()) {
      return true;
    }

    return now - stats.mtimeMs > STAGING_TTL_MS;
  } catch {
    return false;
  }
}

async function cleanupExpiredSources() {
  const root = await ensureStagingRoot();
  const entries = await readdir(root);
  const now = Date.now();
  const tokens = new Set<string>();

  for (const entry of entries) {
    const token = tokenFromArtifact(entry);
    if (token) tokens.add(token);
  }

  await Promise.all(
    [...tokens].map(async (token) => {
      const metadata = await readMetadata(token);

      if (metadata) {
        if (metadata.expiresAt <= now) {
          await removeStagedEditorialPreviewSource(token);
        }
        return;
      }

      const artifacts = [
        `${token}${SOURCE_SUFFIX}`,
        `${token}${PART_SUFFIX}`,
      ].filter((entry) => entries.includes(entry));

      if (artifacts.length === 0) {
        await rm(metadataPath(token), {
          force: true,
        });
        return;
      }

      const abandoned = await Promise.all(
        artifacts.map((entry) =>
          artifactIsAbandoned(root, entry, now)
        )
      );

      if (abandoned.every(Boolean)) {
        await removeStagedEditorialPreviewSource(token);
      }
    })
  );
}

async function stagedSourceCount() {
  const entries = await readdir(stagingRoot());
  return entries.filter(
    (entry) =>
      entry.endsWith(METADATA_SUFFIX) &&
      validToken(entry.slice(0, -METADATA_SUFFIX.length))
  ).length;
}

async function downloadPreviewSource(
  sourceUrl: string,
  destinationPath: string
) {
  if (parseSupportedPlatformVideoUrl(sourceUrl)) {
    return downloadPlatformEditorialVideo(
      sourceUrl,
      destinationPath
    );
  }

  return downloadRemoteEditorialVideo(
    sourceUrl,
    destinationPath
  );
}

export async function createStagedRemotePreviewSource(
  slug: string,
  userId: string,
  sourceUrl: string
): Promise<StagedEditorialPreviewSource> {
  await cleanupExpiredSources();

  if ((await stagedSourceCount()) >= MAX_STAGED_SOURCES) {
    throw new Error(
      "Hay demasiadas vistas previas remotas abiertas. Termina o recarga alguna antes de preparar otra."
    );
  }

  const token = randomBytes(24).toString("hex");
  const destination = sourcePath(token);
  const temporaryDestination = `${destination}.part`;

  try {
    const remote = await downloadPreviewSource(
      sourceUrl,
      temporaryDestination
    );

    await rename(temporaryDestination, destination);

    const stats = await lstat(destination);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size !== remote.bytes ||
      stats.size > MAX_REMOTE_PREVIEW_BYTES
    ) {
      throw new Error(
        "El video temporal no superó la validación de almacenamiento."
      );
    }

    const metadata: StagedMetadata = {
      token,
      slug,
      userId,
      bytes: remote.bytes,
      contentType: remote.contentType,
      sourceUrl: remote.sourceUrl,
      expiresAt: Date.now() + STAGING_TTL_MS,
    };

    await writeFile(
      metadataPath(token),
      JSON.stringify(metadata),
      {
        flag: "wx",
        mode: 0o600,
      }
    );

    return {
      ...metadata,
      filePath: destination,
    };
  } catch (error) {
    await removeStagedEditorialPreviewSource(token);
    throw error;
  }
}

export async function resolveStagedEditorialPreviewSource(
  slug: string,
  userId: string,
  token: string
): Promise<StagedEditorialPreviewSource | null> {
  if (!validToken(token)) return null;

  const metadata = await readMetadata(token);
  if (!metadata) return null;

  if (metadata.expiresAt <= Date.now()) {
    await removeStagedEditorialPreviewSource(token);
    return null;
  }

  if (
    metadata.slug !== slug ||
    metadata.userId !== userId ||
    metadata.bytes <= 0 ||
    metadata.bytes > MAX_REMOTE_PREVIEW_BYTES
  ) {
    return null;
  }

  const filePath = sourcePath(token);

  try {
    const stats = await lstat(filePath);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size !== metadata.bytes
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    ...metadata,
    filePath,
  };
}

export const STAGED_PREVIEW_SOURCE_TTL_MS =
  STAGING_TTL_MS;
