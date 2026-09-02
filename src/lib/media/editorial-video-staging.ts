import "server-only";

import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
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
  downloadSegmentViaMediaImportWorker,
  mediaImportWorkerConfigured,
  probeViaMediaImportWorker,
  removeMediaImportWorkerSession,
} from "./media-import-worker-client";
import {
  downloadPlatformEditorialVideo,
} from "./platform-video-source";
import {
  isPreviewProviderId,
  type PreviewProviderId,
} from "./preview-providers";
import {
  MAX_PREVIEW_SOURCE_BYTES,
  type PreviewTrimWindow,
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
const SESSION_PATTERN = /^[a-f0-9]{48}$/;
const METADATA_SUFFIX = ".json";
const SOURCE_SUFFIX = ".video";
const PART_SUFFIX = `${SOURCE_SUFFIX}.part`;
const PROXY_SUFFIX = ".proxy.webm";
const PROXY_PART_SUFFIX = `${PROXY_SUFFIX}.part`;
const proxyJobs = new Map<string, Promise<StagedEditorialPreviewProxy>>();

export type StagedEditorialPreviewBase = {
  token: string;
  slug: string;
  userId: string;
  bytes: number;
  contentType: string;
  sourceUrl: string;
  expiresAt: number;
  durationSeconds: number | null;
};

export type StagedEditorialPreviewFileSource = StagedEditorialPreviewBase & {
  kind: "file";
  filePath: string;
};

export type StagedEditorialPreviewRemoteSource = StagedEditorialPreviewBase & {
  kind: "remote";
  filePath: null;
  workerSessionId: string;
  remoteKind: "direct" | "platform";
  provider: PreviewProviderId | null;
};

export type StagedEditorialPreviewSource =
  | StagedEditorialPreviewFileSource
  | StagedEditorialPreviewRemoteSource;

export type StagedEditorialPreviewProxy = {
  token: string;
  filePath: string;
  bytes: number;
  contentType: "video/webm";
};

type FileMetadata = Omit<StagedEditorialPreviewFileSource, "filePath">;
type RemoteMetadata = Omit<StagedEditorialPreviewRemoteSource, "filePath">;
type StagedMetadata = FileMetadata | RemoteMetadata;

export type PreparedEditorialTrimSource = {
  filePath: string;
  trim: PreviewTrimWindow;
  delivery: "file" | "segment" | "full-fallback";
  cleanup: () => Promise<void>;
};

function stagingRoot() {
  return path.join(os.tmpdir(), "deuna-preview-sources");
}

function metadataPath(token: string) {
  return path.join(stagingRoot(), `${token}${METADATA_SUFFIX}`);
}

function sourcePath(token: string) {
  return path.join(stagingRoot(), `${token}${SOURCE_SUFFIX}`);
}

function proxyPath(token: string) {
  return path.join(stagingRoot(), `${token}${PROXY_SUFFIX}`);
}

function validToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

function tokenFromArtifact(entry: string) {
  for (const suffix of [METADATA_SUFFIX, SOURCE_SUFFIX, PART_SUFFIX, PROXY_SUFFIX, PROXY_PART_SUFFIX]) {
    if (!entry.endsWith(suffix)) continue;
    const token = entry.slice(0, -suffix.length);
    return validToken(token) ? token : null;
  }
  return null;
}

async function ensureStagingRoot() {
  const root = stagingRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const stats = await lstat(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("El staging temporal de previews no es seguro.");
  }
  return root;
}

function commonMetadataIsValid(value: Partial<StagedMetadata>, token: string) {
  return (
    value.token === token &&
    typeof value.slug === "string" &&
    typeof value.userId === "string" &&
    typeof value.bytes === "number" &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    value.bytes <= MAX_PREVIEW_SOURCE_BYTES &&
    typeof value.contentType === "string" &&
    typeof value.sourceUrl === "string" &&
    typeof value.expiresAt === "number" &&
    (value.durationSeconds === null || value.durationSeconds === undefined ||
      (typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds) && value.durationSeconds > 0))
  );
}

async function readMetadata(token: string): Promise<StagedMetadata | null> {
  if (!validToken(token)) return null;
  try {
    const raw = await readFile(metadataPath(token), "utf8");
    const value = JSON.parse(raw) as Partial<StagedMetadata> & { kind?: unknown };
    if (!commonMetadataIsValid(value, token)) return null;

    if (value.kind === "remote") {
      const provider = value.provider;
      const remoteKind = value.remoteKind;
      if (
        typeof value.workerSessionId !== "string" || !SESSION_PATTERN.test(value.workerSessionId) ||
        (remoteKind !== "direct" && remoteKind !== "platform") ||
        (remoteKind === "direct" && provider !== null) ||
        (remoteKind === "platform" && (typeof provider !== "string" || !isPreviewProviderId(provider)))
      ) return null;
      return {
        ...(value as RemoteMetadata),
        kind: "remote",
        durationSeconds: value.durationSeconds ?? null,
      };
    }

    // Metadata anterior a lazy-preview no tenía `kind`; se considera staging local.
    return {
      ...(value as FileMetadata),
      kind: "file",
      durationSeconds: value.durationSeconds ?? null,
    };
  } catch {
    return null;
  }
}

async function writeMetadata(metadata: StagedMetadata) {
  await writeFile(metadataPath(metadata.token), JSON.stringify(metadata), { flag: "wx", mode: 0o600 });
}

async function replaceMetadata(metadata: StagedMetadata) {
  await writeFile(metadataPath(metadata.token), JSON.stringify(metadata), { mode: 0o600 });
}

export async function removeStagedEditorialPreviewSource(token: string) {
  if (!validToken(token)) return;
  const metadata = await readMetadata(token);
  proxyJobs.delete(token);
  await Promise.all([
    rm(metadataPath(token), { force: true }),
    rm(sourcePath(token), { force: true }),
    rm(`${sourcePath(token)}.part`, { force: true }),
    rm(proxyPath(token), { force: true }),
    rm(`${proxyPath(token)}.part`, { force: true }),
  ]);
  if (metadata?.kind === "remote") {
    await removeMediaImportWorkerSession(metadata.workerSessionId);
  }
}

async function artifactIsAbandoned(root: string, entry: string, now: number) {
  try {
    const stats = await lstat(path.join(root, entry));
    if (!stats.isFile() || stats.isSymbolicLink()) return true;
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
  await Promise.all([...tokens].map(async (token) => {
    const metadata = await readMetadata(token);
    if (metadata) {
      if (metadata.expiresAt <= now) await removeStagedEditorialPreviewSource(token);
      return;
    }
    const artifacts = [
      `${token}${SOURCE_SUFFIX}`,
      `${token}${PART_SUFFIX}`,
      `${token}${PROXY_SUFFIX}`,
      `${token}${PROXY_PART_SUFFIX}`,
    ].filter((entry) => entries.includes(entry));
    if (artifacts.length === 0) {
      await rm(metadataPath(token), { force: true });
      return;
    }
    const abandoned = await Promise.all(artifacts.map((entry) => artifactIsAbandoned(root, entry, now)));
    if (abandoned.every(Boolean)) await removeStagedEditorialPreviewSource(token);
  }));
}

async function stagedSourceCount() {
  const entries = await readdir(stagingRoot());
  return entries.filter((entry) => entry.endsWith(METADATA_SUFFIX) && validToken(entry.slice(0, -METADATA_SUFFIX.length))).length;
}

async function assertStagingCapacity() {
  await cleanupExpiredSources();
  if ((await stagedSourceCount()) >= MAX_STAGED_SOURCES) {
    throw new Error("Hay demasiadas vistas previas abiertas. Termina o recarga alguna antes de preparar otra.");
  }
}

async function stageDownloadedSource(
  slug: string,
  userId: string,
  downloader: (destinationPath: string) => Promise<{ bytes: number; contentType: string; sourceUrl: string }>
): Promise<StagedEditorialPreviewFileSource> {
  await assertStagingCapacity();
  const token = randomBytes(24).toString("hex");
  const destination = sourcePath(token);
  const temporaryDestination = `${destination}.part`;

  try {
    const remote = await downloader(temporaryDestination);
    await rename(temporaryDestination, destination);
    const stats = await lstat(destination);
    if (
      !stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 ||
      stats.size !== remote.bytes || stats.size > MAX_REMOTE_PREVIEW_BYTES
    ) {
      throw new Error("El video temporal no superó la validación de almacenamiento.");
    }
    const metadata: FileMetadata = {
      kind: "file",
      token,
      slug,
      userId,
      bytes: remote.bytes,
      contentType: remote.contentType,
      sourceUrl: remote.sourceUrl,
      expiresAt: Date.now() + STAGING_TTL_MS,
      durationSeconds: null,
    };
    await writeMetadata(metadata);
    return { ...metadata, filePath: destination };
  } catch (error) {
    await removeStagedEditorialPreviewSource(token);
    throw error;
  }
}

async function stageRemoteProbe(
  slug: string,
  userId: string,
  payload:
    | { kind: "direct"; url: string }
    | { kind: "platform"; provider: PreviewProviderId; url: string }
): Promise<StagedEditorialPreviewRemoteSource> {
  await assertStagingCapacity();
  const token = randomBytes(24).toString("hex");
  const probe = await probeViaMediaImportWorker(payload);
  const expiresAt = Math.min(Date.now() + STAGING_TTL_MS, probe.expiresAt);
  const metadata: RemoteMetadata = {
    kind: "remote",
    token,
    slug,
    userId,
    bytes: probe.bytes,
    contentType: probe.contentType,
    sourceUrl: probe.sourceUrl,
    expiresAt,
    durationSeconds: probe.durationSeconds,
    workerSessionId: probe.sessionId,
    remoteKind: payload.kind,
    provider: payload.kind === "platform" ? payload.provider : null,
  };
  try {
    await writeMetadata(metadata);
    return { ...metadata, filePath: null };
  } catch (error) {
    await removeMediaImportWorkerSession(probe.sessionId);
    throw error;
  }
}

export async function createStagedPlatformPreviewSource(
  slug: string,
  userId: string,
  provider: PreviewProviderId,
  sourceUrl: string
): Promise<StagedEditorialPreviewSource> {
  if (mediaImportWorkerConfigured()) {
    try {
      return await stageRemoteProbe(slug, userId, { kind: "platform", provider, url: sourceUrl });
    } catch {
      // Compatibilidad: si el origen no admite la ruta lazy, se conserva el staging completo.
    }
  }
  return stageDownloadedSource(slug, userId, (destinationPath) =>
    downloadPlatformEditorialVideo(provider, sourceUrl, destinationPath)
  );
}

export async function createStagedDirectPreviewSource(
  slug: string,
  userId: string,
  sourceUrl: string
): Promise<StagedEditorialPreviewSource> {
  if (mediaImportWorkerConfigured()) {
    try {
      return await stageRemoteProbe(slug, userId, { kind: "direct", url: sourceUrl });
    } catch {
      // Compatibilidad: si el origen no admite la ruta lazy, se conserva el staging completo.
    }
  }
  return stageDownloadedSource(slug, userId, (destinationPath) =>
    downloadRemoteEditorialVideo(sourceUrl, destinationPath)
  );
}

export async function createStagedUploadedPreviewSource(
  slug: string,
  userId: string,
  body: ReadableStream<Uint8Array>,
  expectedBytes: number | null,
  contentType: string
): Promise<StagedEditorialPreviewFileSource> {
  await assertStagingCapacity();
  const token = randomBytes(24).toString("hex");
  const destination = sourcePath(token);
  let streamedDirectory: string | null = null;
  try {
    const streamed = await stageStreamedPreviewSource(body, expectedBytes);
    streamedDirectory = streamed.directory;
    await rename(streamed.filePath, destination);
    await rm(streamed.directory, { recursive: true, force: true });
    streamedDirectory = null;
    const stats = await lstat(destination);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size !== streamed.bytes || stats.size > MAX_PREVIEW_SOURCE_BYTES) {
      throw new Error("El video temporal no superó la validación de almacenamiento.");
    }
    const metadata: FileMetadata = {
      kind: "file",
      token,
      slug,
      userId,
      bytes: stats.size,
      contentType,
      sourceUrl: "local-upload",
      expiresAt: Date.now() + STAGING_TTL_MS,
      durationSeconds: null,
    };
    await writeMetadata(metadata);
    return { ...metadata, filePath: destination };
  } catch (error) {
    if (streamedDirectory) await rm(streamedDirectory, { recursive: true, force: true });
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
  if (metadata.slug !== slug || metadata.userId !== userId || metadata.bytes <= 0 || metadata.bytes > MAX_PREVIEW_SOURCE_BYTES) return null;

  if (metadata.kind === "remote") {
    return { ...metadata, filePath: null };
  }

  const filePath = sourcePath(token);
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== metadata.bytes) return null;
  } catch {
    return null;
  }
  return { ...metadata, filePath };
}

async function materializeRemoteSource(
  source: StagedEditorialPreviewRemoteSource
): Promise<StagedEditorialPreviewFileSource> {
  const destination = sourcePath(source.token);
  const temporaryDestination = `${destination}.part`;
  try {
    const downloaded = source.remoteKind === "platform" && source.provider
      ? await downloadPlatformEditorialVideo(source.provider, source.sourceUrl, temporaryDestination)
      : await downloadRemoteEditorialVideo(source.sourceUrl, temporaryDestination);
    await rename(temporaryDestination, destination);
    const stats = await lstat(destination);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size !== downloaded.bytes || stats.size > MAX_PREVIEW_SOURCE_BYTES) {
      throw new Error("La copia temporal de compatibilidad no superó la validación de almacenamiento.");
    }
    const metadata: FileMetadata = {
      kind: "file",
      token: source.token,
      slug: source.slug,
      userId: source.userId,
      bytes: stats.size,
      contentType: downloaded.contentType,
      sourceUrl: source.sourceUrl,
      expiresAt: source.expiresAt,
      durationSeconds: source.durationSeconds,
    };
    await replaceMetadata(metadata);
    await removeMediaImportWorkerSession(source.workerSessionId);
    return { ...metadata, filePath: destination };
  } catch (error) {
    await rm(temporaryDestination, { force: true });
    throw error;
  }
}

export async function prepareStagedEditorialPreviewForTrim(
  source: StagedEditorialPreviewSource,
  trim: PreviewTrimWindow
): Promise<PreparedEditorialTrimSource> {
  if (source.kind === "file") {
    return {
      filePath: source.filePath,
      trim,
      delivery: "file",
      cleanup: async () => undefined,
    };
  }

  const root = await ensureStagingRoot();
  const directory = await mkdtemp(path.join(root, ".trim-"));
  const segmentPath = path.join(directory, "segment.webm");
  try {
    await downloadSegmentViaMediaImportWorker(source.workerSessionId, trim, segmentPath);
    const stats = await lstat(segmentPath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > MAX_PREVIEW_SOURCE_BYTES) {
      throw new Error("El tramo remoto no superó la validación temporal.");
    }
    const segmentTrim: PreviewTrimWindow = {
      startSeconds: 0,
      endSeconds: trim.durationSeconds,
      durationSeconds: trim.durationSeconds,
    };
    return {
      filePath: segmentPath,
      trim: segmentTrim,
      delivery: "segment",
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch {
    await rm(directory, { recursive: true, force: true });
    const materialized = await materializeRemoteSource(source);
    return {
      filePath: materialized.filePath,
      trim,
      delivery: "full-fallback",
      cleanup: async () => undefined,
    };
  }
}

async function readExistingProxy(token: string): Promise<StagedEditorialPreviewProxy | null> {
  try {
    const filePath = proxyPath(token);
    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > MAX_EDITORIAL_EDIT_PROXY_BYTES) return null;
    return { token, filePath, bytes: stats.size, contentType: "video/webm" };
  } catch {
    return null;
  }
}

export async function ensureStagedEditorialPreviewProxy(source: StagedEditorialPreviewSource): Promise<StagedEditorialPreviewProxy> {
  const existing = await readExistingProxy(source.token);
  if (existing) return existing;
  const running = proxyJobs.get(source.token);
  if (running) return running;
  const job = (async () => {
    const localSource = source.kind === "remote" ? await materializeRemoteSource(source) : source;
    const output = proxyPath(source.token);
    const temporaryOutput = `${output}.part`;
    try {
      const proxy = await createEditorialPreviewProxy(localSource.filePath, temporaryOutput);
      await rename(proxy.filePath, output);
      const stored = await readExistingProxy(source.token);
      if (!stored) throw new Error("La vista previa compatible no pudo almacenarse de forma segura.");
      return stored;
    } finally {
      await rm(temporaryOutput, { force: true });
    }
  })();
  proxyJobs.set(source.token, job);
  try {
    return await job;
  } finally {
    if (proxyJobs.get(source.token) === job) proxyJobs.delete(source.token);
  }
}

export async function resolveStagedEditorialPreviewProxy(
  slug: string,
  userId: string,
  token: string
): Promise<StagedEditorialPreviewProxy | null> {
  const source = await resolveStagedEditorialPreviewSource(slug, userId, token);
  if (!source) return null;
  return readExistingProxy(token);
}

export const STAGED_PREVIEW_SOURCE_TTL_MS = STAGING_TTL_MS;
