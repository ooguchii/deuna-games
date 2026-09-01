import "server-only";

import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MAX_REMOTE_PREVIEW_BYTES = 64 * 1024 * 1024;

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

const allowedContentTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
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

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname ||
    (url.port && url.port !== "443")
  ) {
    throw new Error(
      "El video remoto debe usar una URL HTTPS pública sin credenciales ni puertos alternativos."
    );
  }

  return url;
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
            "El video remoto supera el límite de importación de 64 MB."
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
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "video/webm,video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo;q=0.9",
          "User-Agent": "DeUnaGames-EditorialPreview/1.0",
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

        if (statusCode !== 200) {
          response.resume();
          reject(
            new Error(
              "El servidor remoto no devolvió un video disponible."
            )
          );
          return;
        }

        const contentType = String(
          response.headers["content-type"] ?? ""
        )
          .split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        const contentLength = Number(
          response.headers["content-length"] ?? 0
        );

        if (
          !contentType ||
          !allowedContentTypes.has(contentType)
        ) {
          response.resume();
          reject(
            new Error(
              "La URL debe apuntar directamente a un MP4, WebM, MOV, M4V, MKV o AVI."
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
              "El video remoto supera el límite de importación de 64 MB."
            )
          );
          return;
        }

        void streamResponseToFile(
          response,
          destinationPath
        )
          .then((bytes) => {
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

export async function downloadRemoteEditorialVideo(
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
