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
  createEditorialPreviewProxy,
  MAX_EDITORIAL_EDIT_PROXY_BYTES,
} from "./editorial-preview-proxy";
import {
  MAX_PREVIEW_SOURCE_BYTES,
} from "./preview-video-policy";
import {
  downloadRemoteEditorialVideo,
  MAX_REMOTE_PREVIEW_BYTES,
} from "./remote-video-source";
import {
  stageStreamedPreviewSource,
} from "./streamed-preview-source";

const STAGING_TTL_MS = 30 * 60 * 1_000;
const MAX_STAGED_SOURCES = 8;
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const METADATA_SUFFIX = ".json";
const SOURCE_SUFFIX = ".video";
const PART_SUFFIX = `${SOURCE_SUFFIX}.part`;
const PROXY_SUFFIX = ".proxy.webm";
const PROXY_PART_SUFFIX = `${PROXY_SUFFIX}.part`;
const proxyJobs = new Map<
  string,
  Promise<StagedEditorialPreviewProxy>
>();

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

export type StagedEditorialPreviewProxy = {
  token: string;
  filePath: string;
  bytes: number;
  contentType: "video/webm";
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

function proxyPath(token: string) {
  return path.join(
    stagingRoot(),
    `${token}${PROXY_SUFFIX}`
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
    PROXY_SUFFIX,
    PROXY_PART_SUFFIX,
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

  proxyJobs.delete(token);

  await Promise.all([
    rm(metadataPath(token), { force: true }),
    rm(sourcePath(token), { force: true }),
    rm(`${sourcePath(token)}.part`, { force: true }),
    rm(proxyPath(token), { force: true }),
    rm(`${proxyPath(token)}.part`, { force: true }),
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
        `${token}${PROXY_SUFFIX}`,
        `${token}${PROXY_PART_SUFFIX}`,
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

async function assertStagingCapacity() {
  await cleanupExpiredSources();

  if ((await stagedSourceCount()) >= MAX_STAGED_SOURCES) {
    throw new Error(
      "Hay demasiadas vistas previas abiertas. Termina o recarga alguna antes de preparar otra."
    );
  }
}

async function writeMetadata(
  metadata: StagedMetadata
) {
  await writeFile(
    metadataPath(metadata.token),
    JSON.stringify(metadata),
    {
      flag: "wx",
      mode: 0o600,
    }
  );
}

export async function createStagedRemotePreviewSource(
  slug: string,
  userId: string,
  sourceUrl: string
): Promise<StagedEditorialPreviewSource> {
  await assertStagingCapacity();

  const token = randomBytes(24).toString("hex");
  const destination = sourcePath(token);
  const temporaryDestination = `${destination}.part`;

  try {
    const remote = await downloadRemoteEditorialVideo(
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

    await writeMetadata(metadata);

    return {
      ...metadata,
      filePath: destination,
    };
  } catch (error) {
    await removeStagedEditorialPreviewSource(token);
    throw error;
  }
}

export async function createStagedUploadedPreviewSource(
  slug: string,
  userId: string,
  body: ReadableStream<Uint8Array>,
  expectedBytes: number,
  contentType: string
): Promise<StagedEditorialPreviewSource> {
  await assertStagingCapacity();

  const token = randomBytes(24).toString("hex");
  const destination = sourcePath(token);
  let streamedDirectory: string | null = null;

  try {
    const streamed = await stageStreamedPreviewSource(
      body,
      expectedBytes
    );
    streamedDirectory = streamed.directory;

    await rename(streamed.filePath, destination);
    await rm(streamed.directory, {
      recursive: true,
      force: true,
    });
    streamedDirectory = null;

    const stats = await lstat(destination);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size !== expectedBytes ||
      stats.size > MAX_PREVIEW_SOURCE_BYTES
    ) {
      throw new Error(
        "El video temporal no superó la validación de almacenamiento."
      );
    }

    const metadata: StagedMetadata = {
      token,
      slug,
      userId,
      bytes: stats.size,
      contentType,
      sourceUrl: "local-upload",
      expiresAt: Date.now() + STAGING_TTL_MS,
    };

    await writeMetadata(metadata);

    return {
      ...metadata,
      filePath: destination,
    };
  } catch (error) {
    if (streamedDirectory) {
      await rm(streamedDirectory, {
        recursive: true,
        force: true,
      });
    }
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
    metadata.bytes > MAX_PREVIEW_SOURCE_BYTES
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

async function readExistingProxy(
  token: string
): Promise<StagedEditorialPreviewProxy | null> {
  try {
    const filePath = proxyPath(token);
    const stats = await lstat(filePath);

    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size <= 0 ||
      stats.size > MAX_EDITORIAL_EDIT_PROXY_BYTES
    ) {
      return null;
    }

    return {
      token,
      filePath,
      bytes: stats.size,
      contentType: "video/webm",
    };
  } catch {
    return null;
  }
}

export async function ensureStagedEditorialPreviewProxy(
  source: StagedEditorialPreviewSource
): Promise<StagedEditorialPreviewProxy> {
  const existing = await readExistingProxy(source.token);
  if (existing) return existing;

  const running = proxyJobs.get(source.token);
  if (running) return running;

  const job = (async () => {
    const output = proxyPath(source.token);
    const temporaryOutput = `${output}.part`;

    try {
      const proxy = await createEditorialPreviewProxy(
        source.filePath,
        temporaryOutput
      );
      await rename(proxy.filePath, output);

      const stored = await readExistingProxy(source.token);
      if (!stored) {
        throw new Error(
          "La vista previa compatible no pudo almacenarse de forma segura."
        );
      }

      return stored;
    } finally {
      await rm(temporaryOutput, { force: true });
    }
  })();

  proxyJobs.set(source.token, job);

  try {
    return await job;
  } finally {
    if (proxyJobs.get(source.token) === job) {
      proxyJobs.delete(source.token);
    }
  }
}

export async function resolveStagedEditorialPreviewProxy(
  slug: string,
  userId: string,
  token: string
): Promise<StagedEditorialPreviewProxy | null> {
  const source = await resolveStagedEditorialPreviewSource(
    slug,
    userId,
    token
  );
  if (!source) return null;

  return readExistingProxy(token);
}

export const STAGED_PREVIEW_SOURCE_TTL_MS =
  STAGING_TTL_MS;
