import "server-only";

import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import { open } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  downloadViaMediaImportWorker,
  mediaImportWorkerConfigured,
  requireRemoteImportWorkerInProduction,
} from "./media-import-worker-client";
import {
  MAX_PREVIEW_SOURCE_BYTES,
} from "./preview-video-policy";

export const MAX_REMOTE_PREVIEW_BYTES =
  MAX_PREVIEW_SOURCE_BYTES;

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 60_000;
const SNIFF_BYTES = 512;

const allowedContentTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
]);

const genericBinaryContentTypes = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/binary",
  "application/x-binary",
]);

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type RemoteRequestResult = {
  statusCode: number;
  location?: string;
  contentType?: string;
  bytes?: number;
};

export type RemoteEditorialVideo = {
  bytes: number;
  contentType: string;
  sourceUrl: string;
};

function normalizeHostname(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function addressIsPublic({
  address,
  family,
}: ResolvedAddress) {
  return !blockedAddresses.check(
    address,
    family === 4 ? "ipv4" : "ipv6"
  );
}

async function resolvePublicAddress(
  hostname: string
): Promise<ResolvedAddress> {
  const normalized = normalizeHostname(hostname);
  const literalFamily = isIP(normalized);
  const addresses = literalFamily
    ? [
        {
          address: normalized,
          family: literalFamily,
        },
      ]
    : await lookup(normalized, {
        all: true,
        verbatim: true,
      });

  if (addresses.length === 0) {
    throw new Error("La URL del video no pudo resolverse.");
  }

  const normalizedAddresses = addresses.map(
    ({ address, family }) => ({
      address,
      family: family as 4 | 6,
    })
  );

  if (!normalizedAddresses.every(addressIsPublic)) {
    throw new Error(
      "La URL del video apunta a una red no permitida."
    );
  }

  return normalizedAddresses[0]!;
}

function parseRemoteVideoUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("La URL del video no es válida.");
  }

  const validProtocol =
    url.protocol === "https:" ||
    url.protocol === "http:";
  const validPort =
    !url.port ||
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80");

  if (
    !validProtocol ||
    !validPort ||
    url.username ||
    url.password ||
    !url.hostname ||
    url.toString().length > 2_048
  ) {
    throw new Error(
      "El video remoto debe usar una URL HTTP/HTTPS pública, sin credenciales ni puertos alternativos."
    );
  }

  return url;
}

function contentTypeFromPathname(pathname: string) {
  const extension = path.extname(pathname).toLowerCase();

  if (extension === ".mp4" || extension === ".m4v") {
    return "video/mp4";
  }
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";

  return null;
}

async function sniffVideoContentType(
  filePath: string,
  pathname: string
) {
  const byExtension = contentTypeFromPathname(pathname);
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(SNIFF_BYTES);
    const { bytesRead } = await handle.read(
      buffer,
      0,
      buffer.length,
      0
    );
    const sample = buffer.subarray(0, bytesRead);

    if (
      sample.length >= 12 &&
      sample.toString("ascii", 4, 8) === "ftyp"
    ) {
      return byExtension === "video/quicktime"
        ? "video/quicktime"
        : "video/mp4";
    }

    if (
      sample.length >= 12 &&
      sample.toString("ascii", 0, 4) === "RIFF" &&
      sample.toString("ascii", 8, 12) === "AVI "
    ) {
      return "video/x-msvideo";
    }

    if (
      sample.length >= 4 &&
      sample[0] === 0x1a &&
      sample[1] === 0x45 &&
      sample[2] === 0xdf &&
      sample[3] === 0xa3
    ) {
      return sample.toString("ascii").toLowerCase().includes("webm")
        ? "video/webm"
        : "video/x-matroska";
    }

    return byExtension;
  } finally {
    await handle.close();
  }
}

async function streamResponseToFile(
  response: NodeJS.ReadableStream,
  destinationPath: string
) {
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;

      if (total > MAX_REMOTE_PREVIEW_BYTES) {
        callback(
          new Error(
            "El video remoto supera el límite de importación de 1 GB."
          )
        );
        return;
      }

      callback(null, chunk);
    },
  });
  const output = createWriteStream(destinationPath, {
    flags: "wx",
    mode: 0o600,
  });

  await pipeline(response, limiter, output);

  if (total <= 0) {
    throw new Error("El video remoto está vacío.");
  }

  return total;
}

function requestRemoteVideo(
  url: URL,
  resolved: ResolvedAddress,
  destinationPath: string
): Promise<RemoteRequestResult> {
  return new Promise((resolve, reject) => {
    const requestFunction =
      url.protocol === "http:"
        ? httpRequest
        : httpsRequest;
    const request = requestFunction(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "video/webm,video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,application/octet-stream;q=0.8,*/*;q=0.1",
          "User-Agent": "Mozilla/5.0 (compatible; DeUnaGames-EditorialPreview/2.0)",
        },
        lookup: (_hostname, _options, callback) => {
          callback(
            null,
            resolved.address,
            resolved.family
          );
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          location
        ) {
          response.resume();
          resolve({ statusCode, location });
          return;
        }

        if (statusCode !== 200 && statusCode !== 206) {
          response.resume();
          reject(
            new Error(
              `El servidor remoto respondió HTTP ${statusCode || "desconocido"} en lugar de entregar el video.`
            )
          );
          return;
        }

        const declaredContentType = String(
          response.headers["content-type"] ?? ""
        )
          .split(";", 1)[0]
          ?.trim()
          .toLowerCase() ?? "";
        const contentLength = Number(
          response.headers["content-length"] ?? 0
        );

        if (
          declaredContentType &&
          !allowedContentTypes.has(declaredContentType) &&
          !genericBinaryContentTypes.has(declaredContentType)
        ) {
          response.resume();
          reject(
            new Error(
              `La URL devolvió ${declaredContentType}, no un archivo de video directo.`
            )
          );
          return;
        }

        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_REMOTE_PREVIEW_BYTES
        ) {
          response.resume();
          reject(
            new Error(
              "El video remoto supera el límite de importación de 1 GB."
            )
          );
          return;
        }

        void streamResponseToFile(
          response,
          destinationPath
        )
          .then(async (bytes) => {
            const contentType =
              allowedContentTypes.has(declaredContentType)
                ? declaredContentType
                : await sniffVideoContentType(
                    destinationPath,
                    url.pathname
                  );

            if (!contentType) {
              throw new Error(
                "La URL respondió datos binarios, pero no se pudo reconocer un MP4, WebM, MOV, MKV o AVI válido."
              );
            }

            resolve({
              statusCode,
              contentType,
              bytes,
            });
          })
          .catch(reject);
      }
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(
        new Error(
          "La descarga del video agotó el tiempo permitido."
        )
      );
    });
    request.on("error", reject);
    request.end();
  });
}

async function downloadDirectlyForDevelopment(
  value: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  let current = parseRemoteVideoUrl(value);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const resolved = await resolvePublicAddress(
      current.hostname
    );
    const response = await requestRemoteVideo(
      current,
      resolved,
      destinationPath
    );

    if (
      response.statusCode >= 300 &&
      response.statusCode < 400 &&
      response.location
    ) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error(
          "La URL del video tiene demasiadas redirecciones."
        );
      }

      current = parseRemoteVideoUrl(
        new URL(response.location, current).toString()
      );
      continue;
    }

    if (!response.contentType || !response.bytes) {
      throw new Error(
        "El video remoto no pudo descargarse."
      );
    }

    return {
      bytes: response.bytes,
      contentType: response.contentType,
      sourceUrl: current.toString(),
    };
  }

  throw new Error("El video remoto no pudo descargarse.");
}

export async function downloadRemoteEditorialVideo(
  value: string,
  destinationPath: string
): Promise<RemoteEditorialVideo> {
  const parsed = parseRemoteVideoUrl(value);

  requireRemoteImportWorkerInProduction();

  if (mediaImportWorkerConfigured()) {
    const worker = await downloadViaMediaImportWorker(
      {
        kind: "direct",
        url: parsed.toString(),
      },
      destinationPath
    );

    if (!allowedContentTypes.has(worker.contentType)) {
      throw new Error(
        "El worker multimedia no devolvió un tipo de video permitido."
      );
    }

    return {
      bytes: worker.bytes,
      contentType: worker.contentType,
      sourceUrl:
        worker.sourceUrl || parsed.toString(),
    };
  }

  return downloadDirectlyForDevelopment(
    parsed.toString(),
    destinationPath
  );
}
