import "server-only";

import { createWriteStream } from "node:fs";
import { request as httpRequest } from "node:http";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { PreviewProviderId } from "./preview-providers";
import { MAX_PREVIEW_SOURCE_BYTES } from "./preview-video-policy";

const WORKER_TIMEOUT_MS = 10 * 60 * 1_000;
const MAX_WORKER_RESPONSE_BYTES = MAX_PREVIEW_SOURCE_BYTES;

export type MediaImportWorkerPayload =
  | { kind: "direct"; url: string }
  | { kind: "platform"; provider: PreviewProviderId; url: string };

export type MediaImportWorkerResult = {
  bytes: number;
  contentType: string;
  sourceUrl: string;
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

export function downloadViaMediaImportWorker(
  payload: MediaImportWorkerPayload,
  destinationPath: string
): Promise<MediaImportWorkerResult> {
  const workerUrl = configuredWorkerUrl();
  if (!workerUrl) throw new Error("El worker multimedia no está configurado.");
  const token = configuredWorkerToken();
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (body.length > 8 * 1024) throw new Error("La solicitud al worker multimedia es demasiado grande.");

  return new Promise((resolve, reject) => {
    const request = httpRequest(workerUrl, {
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
        let errorText = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          if (errorText.length < 4_000) errorText += chunk.slice(0, 4_000 - errorText.length);
        });
        response.on("end", () => reject(new Error(errorText.trim() || `El worker multimedia respondió ${statusCode}.`)));
        return;
      }
      const announcedLength = Number(response.headers["content-length"] ?? 0);
      if (Number.isFinite(announcedLength) && announcedLength > MAX_WORKER_RESPONSE_BYTES) {
        response.destroy();
        reject(new Error("El worker multimedia produjo una fuente que supera el límite máximo de 1 GB."));
        return;
      }
      let total = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          total += chunk.length;
          if (total > MAX_WORKER_RESPONSE_BYTES) return callback(new Error("El worker multimedia produjo una fuente que supera el límite máximo de 1 GB."));
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
