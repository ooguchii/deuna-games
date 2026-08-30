import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export const MAX_REMOTE_IMAGE_BYTES =
  16 * 1024 * 1024;

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const allowedContentTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
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
  blockedAddresses.addSubnet(
    network,
    prefix,
    "ipv4"
  );
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
  blockedAddresses.addSubnet(
    network,
    prefix,
    "ipv6"
  );
}

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type RemoteEditorialImage = {
  bytes: Buffer;
  contentType: string;
  sourceUrl: string;
};

function normalizeHostname(hostname: string) {
  return hostname.startsWith("[") &&
    hostname.endsWith("]")
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
    throw new Error(
      "La URL no pudo resolverse."
    );
  }

  const normalizedAddresses = addresses.map(
    ({ address, family }) => ({
      address,
      family: family as 4 | 6,
    })
  );

  if (!normalizedAddresses.every(addressIsPublic)) {
    throw new Error(
      "La URL apunta a una red no permitida."
    );
  }

  return normalizedAddresses[0]!;
}

function parseRemoteUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "La URL de la imagen no es válida."
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname ||
    url.port && url.port !== "443"
  ) {
    throw new Error(
      "La imagen remota debe usar una URL HTTPS pública sin credenciales ni puertos alternativos."
    );
  }

  return url;
}

async function requestRemoteImage(
  url: URL,
  resolved: ResolvedAddress
): Promise<{
  statusCode: number;
  location?: string;
  contentType?: string;
  bytes?: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "image/avif,image/webp,image/png,image/jpeg;q=0.9",
          "User-Agent": "DeUnaGames-EditorialMedia/1.0",
        },
        lookup: (
          _hostname,
          _options,
          callback
        ) => {
          callback(
            null,
            resolved.address,
            resolved.family
          );
        },
      },
      (response) => {
        const statusCode =
          response.statusCode ?? 0;
        const location = response.headers.location;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          location
        ) {
          response.resume();
          resolve({
            statusCode,
            location,
          });
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(
            new Error(
              "El servidor remoto no devolvió una imagen disponible."
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
              "La URL no entrega PNG, JPEG, AVIF o WebP."
            )
          );
          return;
        }

        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_REMOTE_IMAGE_BYTES
        ) {
          response.resume();
          reject(
            new Error(
              "La imagen remota supera el límite de importación."
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;

        response.on("data", (chunk: Buffer) => {
          total += chunk.length;

          if (total > MAX_REMOTE_IMAGE_BYTES) {
            response.destroy(
              new Error(
                "La imagen remota supera el límite de importación."
              )
            );
            return;
          }

          chunks.push(chunk);
        });

        response.on("end", () => {
          if (total <= 0) {
            reject(
              new Error(
                "La imagen remota está vacía."
              )
            );
            return;
          }

          resolve({
            statusCode,
            contentType,
            bytes: Buffer.concat(chunks, total),
          });
        });
      }
    );

    request.setTimeout(
      REQUEST_TIMEOUT_MS,
      () => {
        request.destroy(
          new Error(
            "La descarga de la imagen agotó el tiempo permitido."
          )
        );
      }
    );
    request.on("error", reject);
    request.end();
  });
}

export async function fetchRemoteEditorialImage(
  value: string
): Promise<RemoteEditorialImage> {
  let current = parseRemoteUrl(value);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const resolved = await resolvePublicAddress(
      current.hostname
    );
    const response = await requestRemoteImage(
      current,
      resolved
    );

    if (
      response.statusCode >= 300 &&
      response.statusCode < 400 &&
      response.location
    ) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error(
          "La URL remota tiene demasiadas redirecciones."
        );
      }

      current = parseRemoteUrl(
        new URL(
          response.location,
          current
        ).toString()
      );
      continue;
    }

    if (
      !response.bytes ||
      !response.contentType
    ) {
      throw new Error(
        "La imagen remota no pudo descargarse."
      );
    }

    return {
      bytes: response.bytes,
      contentType: response.contentType,
      sourceUrl: current.toString(),
    };
  }

  throw new Error(
    "La imagen remota no pudo descargarse."
  );
}
