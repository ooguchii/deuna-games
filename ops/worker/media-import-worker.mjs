import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  createReadStream,
  createWriteStream,
} from "node:fs";
import {
  lstat,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";
import {
  createServer,
  request as httpRequest,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const HOST = "127.0.0.1";
const PORT = Number(
  process.env.DEUNA_MEDIA_IMPORT_WORKER_PORT ?? "3101"
);
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_DIRECT_SOURCE_BYTES = 1024 * 1024 * 1024;
const MAX_PLATFORM_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DIRECT_TIMEOUT_MS = 60_000;
const PLATFORM_TIMEOUT_MS = 10 * 60 * 1_000;
const PLATFORM_DOWNLOAD_RATE = "8M";
const MAX_ERROR_CHARS = 8_000;
const YTDLP_JS_RUNTIME =
  process.env.DEUNA_YTDLP_JS_RUNTIME?.trim() || "node";
const TOKEN =
  process.env.DEUNA_MEDIA_IMPORT_WORKER_TOKEN?.trim() ?? "";

if (
  !Number.isSafeInteger(PORT) ||
  PORT < 1024 ||
  PORT > 65_535
) {
  throw new Error(
    "DEUNA_MEDIA_IMPORT_WORKER_PORT debe ser un puerto local válido entre 1024 y 65535."
  );
}

if (TOKEN.length < 32 || TOKEN.length > 256) {
  throw new Error(
    "DEUNA_MEDIA_IMPORT_WORKER_TOKEN debe tener entre 32 y 256 caracteres."
  );
}

const allowedContentTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
  "application/octet-stream",
  "binary/octet-stream",
]);

const platformHosts = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "facebook.com",
  "fb.watch",
  "fb.com",
  "instagram.com",
  "instagr.am",
  "tiktok.com",
  "vimeo.com",
  "x.com",
  "twitter.com",
  "twitch.tv",
  "dailymotion.com",
  "dai.ly",
  "streamable.com",
  "kick.com",
];

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
]) {
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
]) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

let activeJob = false;

function jsonError(response, status, message) {
  const body = Buffer.from(message, "utf8");
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function authorized(request) {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(TOKEN, "utf8");

  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);
    total += buffer.length;

    if (total > MAX_REQUEST_BYTES) {
      throw new Error("Solicitud demasiado grande.");
    }

    chunks.push(buffer);
  }

  let parsed;
  try {
    parsed = JSON.parse(
      Buffer.concat(chunks).toString("utf8")
    );
  } catch {
    throw new Error("JSON inválido.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Solicitud inválida.");
  }

  return parsed;
}

function normalizeHostname(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function addressIsPublic(address, family) {
  return !blockedAddresses.check(
    address,
    family === 4 ? "ipv4" : "ipv6"
  );
}

async function resolvePublicAddress(hostname) {
  const normalized = normalizeHostname(hostname);
  const literalFamily = isIP(normalized);
  const addresses = literalFamily
    ? [{ address: normalized, family: literalFamily }]
    : await lookup(normalized, {
        all: true,
        verbatim: true,
      });

  if (addresses.length === 0) {
    throw new Error("La URL no pudo resolverse.");
  }

  if (
    !addresses.every(({ address, family }) =>
      addressIsPublic(address, family)
    )
  ) {
    throw new Error(
      "La URL apunta a una red no permitida."
    );
  }

  return addresses[0];
}

function parsePublicUrl(value) {
  const raw = String(value).trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  let url;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("La URL del video no es válida.");
  }

  const isHttp = url.protocol === "http:";
  const isHttps = url.protocol === "https:";
  const validPort =
    !url.port ||
    (isHttp && url.port === "80") ||
    (isHttps && url.port === "443");

  if (
    (!isHttp && !isHttps) ||
    url.username ||
    url.password ||
    !url.hostname ||
    !validPort ||
    url.toString().length > 2_048
  ) {
    throw new Error(
      "El video remoto debe usar una URL HTTP o HTTPS pública sin credenciales ni puertos alternativos."
    );
  }

  return url;
}

function hostnameMatches(hostname, allowedHost) {
  return (
    hostname === allowedHost ||
    hostname.endsWith(`.${allowedHost}`)
  );
}

function parsePlatformUrl(value) {
  const url = parsePublicUrl(value);
  const hostname = url.hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  if (
    !platformHosts.some((allowedHost) =>
      hostnameMatches(hostname, allowedHost)
    )
  ) {
    throw new Error(
      "La plataforma de ese enlace no está habilitada para importación automática."
    );
  }

  return url;
}

async function streamResponseToFile(
  input,
  destinationPath,
  maximumBytes
) {
  let total = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;

      if (total > maximumBytes) {
        callback(
          new Error(
            "El video remoto supera el límite permitido."
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

  await pipeline(input, limiter, output);

  if (total <= 0) {
    throw new Error("El video remoto está vacío.");
  }

  return total;
}

function requestDirectVideo(
  url,
  resolved,
  destinationPath
) {
  return new Promise((resolve, reject) => {
    const requestFn =
      url.protocol === "http:" ? httpRequest : httpsRequest;
    const request = requestFn(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "video/webm,video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,application/octet-stream;q=0.8,*/*;q=0.1",
          "User-Agent": "DeUnaGames-MediaImportWorker/3.0",
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
              "La URL directa debe devolver un archivo de video o un flujo binario; no una página web."
            )
          );
          return;
        }

        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_DIRECT_SOURCE_BYTES
        ) {
          response.resume();
          reject(
            new Error(
              "El video remoto supera el límite de 1 GB."
            )
          );
          return;
        }

        void streamResponseToFile(
          response,
          destinationPath,
          MAX_DIRECT_SOURCE_BYTES
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

    request.setTimeout(DIRECT_TIMEOUT_MS, () => {
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

async function downloadDirectVideo(value, destinationPath) {
  let current = parsePublicUrl(value);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const resolved = await resolvePublicAddress(
      current.hostname
    );
    const response = await requestDirectVideo(
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

      current = parsePublicUrl(
        new URL(response.location, current).toString()
      );
      continue;
    }

    return {
      filePath: destinationPath,
      bytes: response.bytes,
      contentType: response.contentType,
      sourceUrl: current.toString(),
    };
  }

  throw new Error("El video remoto no pudo descargarse.");
}

function ytDlpExecutable() {
  return process.env.DEUNA_YTDLP_PATH?.trim() || "yt-dlp";
}

function contentTypeFromFilename(filename) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".mp4" || extension === ".m4v") {
    return "video/mp4";
  }
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";

  return "application/octet-stream";
}

function classifyYtDlpFailure(stderr) {
  const normalized = stderr.toLowerCase();

  if (
    normalized.includes("no supported javascript runtime") ||
    normalized.includes("javascript runtime") &&
      normalized.includes("unavailable") ||
    normalized.includes("challenge solving failed")
  ) {
    return new Error(
      "YouTube requiere un runtime JavaScript compatible en el worker multimedia. Confirma Node 22 o superior y DEUNA_YTDLP_JS_RUNTIME=node."
    );
  }

  if (
    normalized.includes("sign in") ||
    normalized.includes("login") ||
    normalized.includes("private") ||
    normalized.includes("age-restricted") ||
    normalized.includes("members-only") ||
    normalized.includes("not available") ||
    normalized.includes("unavailable")
  ) {
    return new Error(
      "La plataforma no permite importar este video sin iniciar sesión, o el contenido no es público."
    );
  }

  if (
    normalized.includes("unsupported url") ||
    normalized.includes("no suitable extractor")
  ) {
    return new Error(
      "Ese enlace pertenece a una plataforma reconocida, pero yt-dlp no pudo extraer el video. Actualiza yt-dlp y vuelve a intentarlo."
    );
  }

  if (
    normalized.includes("max-filesize") ||
    normalized.includes("file is larger")
  ) {
    return new Error(
      "La copia liviana necesaria para recortar ese video supera 512 MB. Prueba con un video más corto o una URL directa al archivo."
    );
  }

  return new Error(
    "No se pudo obtener el video público desde la plataforma. Comprueba el enlace y mantén yt-dlp actualizado."
  );
}

function runPlatformYtDlp(
  sourceUrl,
  temporaryDirectory
) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(
      temporaryDirectory,
      "source.%(ext)s"
    );
    const args = [
      "--no-config",
      "--js-runtimes",
      YTDLP_JS_RUNTIME,
      "--no-playlist",
      "--max-downloads",
      "1",
      "--concurrent-fragments",
      "1",
      "--limit-rate",
      PLATFORM_DOWNLOAD_RATE,
      "--retries",
      "2",
      "--fragment-retries",
      "2",
      "--socket-timeout",
      "20",
      "--no-cache-dir",
      "--no-progress",
      "--no-part",
      "--no-mtime",
      "--no-write-subs",
      "--no-write-auto-subs",
      "--no-write-thumbnail",
      "--no-write-info-json",
      "--no-write-playlist-metafiles",
      "--format",
      "best[height<=480][vcodec^=avc1][ext=mp4]/best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst",
      "--max-filesize",
      "512M",
      "--output",
      outputTemplate,
      sourceUrl,
    ];
    const child = spawn(ytDlpExecutable(), args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, PLATFORM_TIMEOUT_MS);

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      if (stderr.length >= MAX_ERROR_CHARS) return;
      stderr += chunk.slice(
        0,
        MAX_ERROR_CHARS - stderr.length
      );
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      reject(
        error.code === "ENOENT"
          ? new Error(
              "yt-dlp no está disponible en el worker multimedia."
            )
          : error
      );
    });

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (signal) {
        reject(
          new Error(
            "La importación de plataforma excedió el tiempo permitido."
          )
        );
        return;
      }

      if (code !== 0) {
        reject(classifyYtDlpFailure(stderr));
        return;
      }

      resolve();
    });
  });
}

async function downloadPlatformVideo(
  value,
  temporaryDirectory
) {
  const sourceUrl = parsePlatformUrl(value).toString();

  await runPlatformYtDlp(
    sourceUrl,
    temporaryDirectory
  );

  const entries = await readdir(temporaryDirectory);
  const candidates = entries.filter(
    (entry) =>
      entry.startsWith("source.") &&
      !entry.endsWith(".part") &&
      !entry.endsWith(".ytdl") &&
      !entry.endsWith(".json")
  );

  if (candidates.length !== 1) {
    throw new Error(
      "La plataforma no produjo una única fuente temporal válida."
    );
  }

  const filename = candidates[0];
  const filePath = path.join(
    temporaryDirectory,
    filename
  );
  const stats = await lstat(filePath);

  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size <= 0 ||
    stats.size > MAX_PLATFORM_SOURCE_BYTES
  ) {
    throw new Error(
      "La copia temporal de la plataforma supera el límite de 512 MB o no es válida."
    );
  }

  return {
    filePath,
    bytes: stats.size,
    contentType: contentTypeFromFilename(filename),
    sourceUrl,
  };
}

async function sendFile(response, result) {
  response.writeHead(200, {
    "Content-Type": result.contentType,
    "Content-Length": String(result.bytes),
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Deuna-Source-Url": Buffer.from(
      result.sourceUrl,
      "utf8"
    ).toString("base64url"),
  });

  await pipeline(
    createReadStream(result.filePath),
    response
  );
}

const server = createServer(async (request, response) => {
  response.setHeader("Connection", "close");

  if (
    request.method !== "POST" ||
    request.url !== "/source"
  ) {
    jsonError(response, 404, "No encontrado.");
    return;
  }

  if (!authorized(request)) {
    jsonError(response, 401, "No autorizado.");
    return;
  }

  if (activeJob) {
    jsonError(
      response,
      429,
      "Ya hay una importación multimedia en curso."
    );
    return;
  }

  activeJob = true;
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "deuna-media-import-worker-")
  );

  try {
    const payload = await readJsonBody(request);
    let result;

    if (payload.kind === "direct") {
      if (typeof payload.url !== "string") {
        throw new Error("Falta la URL directa.");
      }

      result = await downloadDirectVideo(
        payload.url,
        path.join(temporaryDirectory, "source.video")
      );
    } else if (payload.kind === "platform") {
      if (typeof payload.url !== "string") {
        throw new Error("Falta el enlace de plataforma.");
      }

      result = await downloadPlatformVideo(
        payload.url,
        temporaryDirectory
      );
    } else {
      throw new Error("Tipo de importación no permitido.");
    }

    await sendFile(response, result);
  } catch (error) {
    if (!response.headersSent) {
      jsonError(
        response,
        400,
        error instanceof Error
          ? error.message
          : "La importación multimedia falló."
      );
    } else if (!response.writableEnded) {
      response.destroy();
    }
  } finally {
    activeJob = false;
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

server.requestTimeout = 11 * 60 * 1_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 2_000;
server.maxRequestsPerSocket = 1;

server.listen(PORT, HOST, () => {
  console.log(
    `DeUna media import worker escuchando sólo en ${HOST}:${PORT}.`
  );
});
