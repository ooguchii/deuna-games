import "server-only";

import { createWriteStream } from "node:fs";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { PreviewProviderId } from "./preview-providers";
import { MAX_PREVIEW_SOURCE_BYTES, type PreviewTrimWindow } from "./preview-video-policy";

const WORKER_TIMEOUT_MS = 10 * 60 * 1_000;
const STREAM_TIMEOUT_MS = 60_000;
const MAX_WORKER_RESPONSE_BYTES = MAX_PREVIEW_SOURCE_BYTES;
const MAX_SEGMENT_RESPONSE_BYTES = 128 * 1024 * 1024;
const MAX_JSON_RESPONSE_BYTES = 32 * 1024;
const SESSION_PATTERN = /^[a-f0-9]{48}$/;

export type MediaImportWorkerPayload =
  | { kind: "direct"; url: string }
  | { kind: "platform"; provider: PreviewProviderId; url: string };

export type MediaImportWorkerResult = {
  bytes: number;
  contentType: string;
  sourceUrl: string;
};

export type MediaImportWorkerProbe = MediaImportWorkerResult & {
  sessionId: string;
  durationSeconds: number | null;
  expiresAt: number;
};

export type MediaImportWorkerStream = {
  statusCode: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange: string | null;
  stream: IncomingMessage | null;
};

function configuredWorkerUrl() {
  const raw = process.env.DEUNA_MEDIA_IMPORT_WORKER_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("DEUNA_MEDIA_IMPORT_WORKER_URL no es una URL válida."); }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]" || url.hostname === "::1";
  if (url.protocol !== "http:" || !loopback || url.username || url.password || url.search || url.hash) {
    throw new Error("El worker multimedia debe usar HTTP sobre loopback sin credenciales, query ni fragmento.");
  }
  return url;
}

function workerEndpoint(pathname: string) {
  const configured = configuredWorkerUrl();
  if (!configured) throw new Error("El worker multimedia no está configurado.");
  const url = new URL(configured);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url;
}

function configuredWorkerToken() {
  const token = process.env.DEUNA_MEDIA_IMPORT_WORKER_TOKEN?.trim() ?? "";
  if (token.length < 32 || token.length > 256) throw new Error("DEUNA_MEDIA_IMPORT_WORKER_TOKEN debe tener entre 32 y 256 caracteres.");
  return token;
}

export function mediaImportWorkerConfigured() {
  return Boolean(process.env.DEUNA_MEDIA_IMPORT_WORKER_URL?.trim());
}

export function requireRemoteImportWorkerInProduction() {
  if (process.env.NODE_ENV === "production" && !mediaImportWorkerConfigured()) {
    throw new Error("La importación remota requiere DEUNA_MEDIA_IMPORT_WORKER_URL en producción para mantener aislado el proceso público.");
  }
}

function decodeSourceUrl(value: string | undefined) {
  if (!value) return "";
  try { return Buffer.from(value, "base64url").toString("utf8"); } catch { return ""; }
}

function assertSessionId(sessionId: string) {
  if (!SESSION_PATTERN.test(sessionId)) throw new Error("La sesión multimedia no es válida.");
}

function collectError(response: IncomingMessage, fallback: string) {
  return new Promise<Error>((resolve) => {
    let errorText = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      if (errorText.length < 4_000) errorText += chunk.slice(0, 4_000 - errorText.length);
    });
    response.on("end", () => resolve(new Error(errorText.trim() || fallback)));
    response.on("error", () => resolve(new Error(errorText.trim() || fallback)));
  });
}

function postJson(pathname: string, payload: Record<string, unknown>, timeoutMs = WORKER_TIMEOUT_MS) {
  const url = workerEndpoint(pathname);
  const token = configuredWorkerToken();
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (body.length > 8 * 1024) throw new Error("La solicitud al worker multimedia es demasiado grande.");

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = httpRequest(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
        Accept: "application/json",
      },
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode !== 200) {
        void collectError(response, `El worker multimedia respondió ${statusCode}.`).then(reject);
        return;
      }
      let total = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_JSON_RESPONSE_BYTES) {
          response.destroy(new Error("La respuesta JSON del worker es demasiado grande."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("El worker devolvió JSON inválido.");
          resolve(parsed as Record<string, unknown>);
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("El worker multimedia agotó el tiempo permitido.")));
    request.on("error", reject);
    request.end(body);
  });
}

function downloadWorkerBinary(
  pathname: string,
  payload: Record<string, unknown>,
  destinationPath: string,
  maximumBytes: number
): Promise<MediaImportWorkerResult> {
  const url = workerEndpoint(pathname);
  const token = configuredWorkerToken();
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (body.length > 8 * 1024) throw new Error("La solicitud al worker multimedia es demasiado grande.");

  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
        Accept: "application/octet-stream,video/*",
      },
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode !== 200) {
        void collectError(response, `El worker multimedia respondió ${statusCode}.`).then(reject);
        return;
      }
      const announcedLength = Number(response.headers["content-length"] ?? 0);
      if (Number.isFinite(announcedLength) && announcedLength > maximumBytes) {
        response.destroy();
        reject(new Error("El worker multimedia produjo una fuente que supera el límite permitido."));
        return;
      }
      let total = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          total += chunk.length;
          if (total > maximumBytes) return callback(new Error("El worker multimedia produjo una fuente que supera el límite permitido."));
          callback(null, chunk);
        },
      });
      const output = createWriteStream(destinationPath, { flags: "wx", mode: 0o600 });
      void pipeline(response, limiter, output).then(() => {
        if (total <= 0) return reject(new Error("El worker multimedia devolvió una fuente vacía."));
        resolve({
          bytes: total,
          contentType: String(response.headers["content-type"] ?? "application/octet-stream").split(";", 1)[0]?.trim().toLowerCase() || "application/octet-stream",
          sourceUrl: decodeSourceUrl(Array.isArray(response.headers["x-deuna-source-url"]) ? response.headers["x-deuna-source-url"][0] : response.headers["x-deuna-source-url"]),
        });
      }).catch(reject);
    });
    request.setTimeout(WORKER_TIMEOUT_MS, () => request.destroy(new Error("El worker multimedia agotó el tiempo permitido.")));
    request.on("error", reject);
    request.end(body);
  });
}

export function downloadViaMediaImportWorker(
  payload: MediaImportWorkerPayload,
  destinationPath: string
) {
  return downloadWorkerBinary("/source", payload, destinationPath, MAX_WORKER_RESPONSE_BYTES);
}

export async function probeViaMediaImportWorker(
  payload: MediaImportWorkerPayload
): Promise<MediaImportWorkerProbe> {
  const result = await postJson("/probe", payload);
  const sessionId = typeof result.sessionId === "string" ? result.sessionId : "";
  const bytes = Number(result.bytes);
  const contentType = typeof result.contentType === "string" ? result.contentType : "";
  const sourceUrl = typeof result.sourceUrl === "string" ? result.sourceUrl : "";
  const expiresAt = Number(result.expiresAt);
  const rawDuration = result.durationSeconds;
  const durationSeconds = rawDuration === null || rawDuration === undefined ? null : Number(rawDuration);
  assertSessionId(sessionId);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_PREVIEW_SOURCE_BYTES || !contentType || !sourceUrl || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("El worker multimedia devolvió metadata de streaming inválida.");
  }
  return {
    sessionId,
    bytes,
    contentType,
    sourceUrl,
    durationSeconds: durationSeconds !== null && Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
    expiresAt,
  };
}

export function downloadSegmentViaMediaImportWorker(
  sessionId: string,
  trim: PreviewTrimWindow,
  destinationPath: string
) {
  assertSessionId(sessionId);
  return downloadWorkerBinary("/segment", {
    sessionId,
    startSeconds: trim.startSeconds,
    endSeconds: trim.endSeconds,
  }, destinationPath, MAX_SEGMENT_RESPONSE_BYTES);
}

export function openMediaImportWorkerPreviewStream(
  sessionId: string,
  range: string | null,
  headOnly: boolean
): Promise<MediaImportWorkerStream> {
  assertSessionId(sessionId);
  const url = workerEndpoint(`/stream/${sessionId}`);
  const token = configuredWorkerToken();

  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: headOnly ? "HEAD" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "video/*,application/octet-stream;q=0.8,*/*;q=0.1",
        ...(range ? { Range: range } : {}),
      },
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode !== 200 && statusCode !== 206) {
        void collectError(response, `El worker multimedia respondió ${statusCode}.`).then(reject);
        return;
      }
      const contentLength = Number(response.headers["content-length"] ?? 0);
      const contentType = String(response.headers["content-type"] ?? "application/octet-stream").split(";", 1)[0]?.trim().toLowerCase() || "application/octet-stream";
      const contentRange = Array.isArray(response.headers["content-range"]) ? response.headers["content-range"][0] ?? null : response.headers["content-range"] ?? null;
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_PREVIEW_SOURCE_BYTES) {
        response.destroy();
        reject(new Error("El worker multimedia devolvió una longitud de stream inválida."));
        return;
      }
      if (headOnly) {
        response.resume();
        resolve({ statusCode: statusCode as 200 | 206, contentType, contentLength, contentRange, stream: null });
        return;
      }
      resolve({ statusCode: statusCode as 200 | 206, contentType, contentLength, contentRange, stream: response });
    });
    request.setTimeout(STREAM_TIMEOUT_MS, () => request.destroy(new Error("El stream del worker multimedia agotó el tiempo permitido.")));
    request.on("error", reject);
    request.end();
  });
}

export async function removeMediaImportWorkerSession(sessionId: string) {
  if (!SESSION_PATTERN.test(sessionId) || !mediaImportWorkerConfigured()) return;
  const url = workerEndpoint(`/session/${sessionId}`);
  const token = configuredWorkerToken();
  await new Promise<void>((resolve) => {
    const request = httpRequest(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, (response) => {
      response.resume();
      response.on("end", resolve);
    });
    request.setTimeout(5_000, () => request.destroy());
    request.on("error", () => resolve());
    request.end();
  });
}
