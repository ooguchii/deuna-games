import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const HOST = "127.0.0.1";
const PORT = Number(process.env.DEUNA_MEDIA_IMPORT_WORKER_PORT ?? "3101");
const TOKEN = process.env.DEUNA_MEDIA_IMPORT_WORKER_TOKEN?.trim() ?? "";
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_DIRECT_SOURCE_BYTES = 1024 * 1024 * 1024;
const MAX_PLATFORM_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 128 * 1024 * 1024;
const MAX_STREAM_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DIRECT_TIMEOUT_MS = 60_000;
const PLATFORM_TIMEOUT_MS = 10 * 60 * 1_000;
const SEGMENT_TIMEOUT_MS = 2 * 60 * 1_000;
const PLATFORM_DOWNLOAD_RATE = "8M";
const MAX_ERROR_CHARS = 8_000;
const SESSION_TTL_MS = 35 * 60 * 1_000;
const MAX_SESSIONS = 8;
const SESSION_PATTERN = /^[a-f0-9]{48}$/;
const INTERNAL_KEY_PATTERN = /^[a-f0-9]{48}$/;
const YTDLP_JS_RUNTIME = process.env.DEUNA_YTDLP_JS_RUNTIME?.trim() || "node";
const YTDLP_REMOTE_COMPONENT = process.env.DEUNA_YTDLP_REMOTE_COMPONENT?.trim() || "ejs:github";
const YTDLP_COOKIES_FILE = process.env.DEUNA_YTDLP_COOKIES_FILE?.trim() || "";
const YTDLP_PLUGIN_DIR = process.env.DEUNA_YTDLP_PLUGIN_DIR?.trim() || "";
const YTDLP_POT_PROVIDER_URL = process.env.DEUNA_YTDLP_POT_PROVIDER_URL?.trim() || "";
const YTDLP_DIAGNOSTICS = process.env.DEUNA_YTDLP_DIAGNOSTICS?.trim() === "1";
const FFMPEG_PATH = process.env.DEUNA_FFMPEG_PATH?.trim() || "ffmpeg";

if (!Number.isSafeInteger(PORT) || PORT < 1024 || PORT > 65_535) throw new Error("DEUNA_MEDIA_IMPORT_WORKER_PORT debe ser un puerto local válido entre 1024 y 65535.");
if (TOKEN.length < 32 || TOKEN.length > 256) throw new Error("DEUNA_MEDIA_IMPORT_WORKER_TOKEN debe tener entre 32 y 256 caracteres.");

const allowedContentTypes = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/x-matroska",
  "video/avi", "video/x-msvideo", "application/octet-stream", "binary/octet-stream",
]);

const providerHosts = {
  youtube: ["youtube.com", "youtu.be", "youtube-nocookie.com"], facebook: ["facebook.com", "fb.watch", "fb.com"],
  instagram: ["instagram.com", "instagr.am"], tiktok: ["tiktok.com"], vimeo: ["vimeo.com"],
  x: ["x.com", "twitter.com", "t.co"], twitch: ["twitch.tv"], dailymotion: ["dailymotion.com", "dai.ly"],
  streamable: ["streamable.com"], kick: ["kick.com"], reddit: ["reddit.com", "redd.it"], rumble: ["rumble.com"],
  odysee: ["odysee.com"], bilibili: ["bilibili.com", "b23.tv"], vk: ["vk.com"], imgur: ["imgur.com"],
  pinterest: ["pinterest.com", "pin.it"], tumblr: ["tumblr.com"], snapchat: ["snapchat.com"], loom: ["loom.com"],
  wistia: ["wistia.com", "wistia.net", "wi.st"], nicovideo: ["nicovideo.jp", "nico.ms"],
};

const providerLabels = {
  youtube: "YouTube", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", vimeo: "Vimeo",
  x: "X / Twitter", twitch: "Twitch", dailymotion: "Dailymotion", streamable: "Streamable", kick: "Kick",
  reddit: "Reddit", rumble: "Rumble", odysee: "Odysee", bilibili: "Bilibili", vk: "VK", imgur: "Imgur",
  pinterest: "Pinterest", tumblr: "Tumblr", snapchat: "Snapchat", loom: "Loom", wistia: "Wistia", nicovideo: "Niconico",
};

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]]) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

let activeJob = false;
const sessions = new Map();

class YtDlpCommandError extends Error {
  constructor(stderr) { super("yt-dlp terminó con error."); this.name = "YtDlpCommandError"; this.stderr = stderr; }
}

function jsonError(response, status, message) {
  const body = Buffer.from(message, "utf8");
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Content-Length": String(body.length), "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
  response.end(body);
}

function jsonResponse(response, status, value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": String(body.length), "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
  response.end(body);
}

function authorized(request) {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(TOKEN, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJsonBody(request) {
  const chunks = []; let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_REQUEST_BYTES) throw new Error("Solicitud demasiado grande.");
    chunks.push(buffer);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("JSON inválido."); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Solicitud inválida.");
  return parsed;
}

function parsePublicUrl(value) {
  const raw = String(value).trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(candidate); } catch { throw new Error("La URL del video no es válida."); }
  const isHttp = url.protocol === "http:"; const isHttps = url.protocol === "https:";
  const validPort = !url.port || (isHttp && url.port === "80") || (isHttps && url.port === "443");
  if ((!isHttp && !isHttps) || url.username || url.password || !url.hostname || !validPort || url.toString().length > 8_192) throw new Error("El video remoto debe usar una URL HTTP o HTTPS pública sin credenciales ni puertos alternativos.");
  return url;
}

function hostnameMatches(hostname, allowedHost) { return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`); }
function parsePlatformUrl(provider, value) {
  const hosts = providerHosts[provider];
  if (!hosts) throw new Error("Proveedor multimedia no permitido.");
  const url = parsePublicUrl(value);
  const hostname = url.hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!hosts.some((allowedHost) => hostnameMatches(hostname, allowedHost))) throw new Error(`El enlace no pertenece al proveedor declarado: ${provider}.`);
  return url;
}

function normalizeHostname(hostname) { return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname; }
async function resolvePublicAddress(hostname) {
  const normalized = normalizeHostname(hostname); const literalFamily = isIP(normalized);
  const addresses = literalFamily ? [{ address: normalized, family: literalFamily }] : await lookup(normalized, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("La URL no pudo resolverse.");
  if (!addresses.every(({ address, family }) => !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6"))) throw new Error("La URL apunta a una red no permitida.");
  return addresses[0];
}

function sanitizeUpstreamHeaders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Map([
    ["user-agent", "User-Agent"], ["referer", "Referer"], ["origin", "Origin"],
    ["accept", "Accept"], ["accept-language", "Accept-Language"],
  ]);
  const result = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = allowed.get(rawName.toLowerCase());
    if (!name || typeof rawValue !== "string" || rawValue.length > 2_048 || /[\r\n]/.test(rawValue)) continue;
    result[name] = rawValue;
  }
  return result;
}

function requestResponse(url, resolved, method, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestFn = url.protocol === "http:" ? httpRequest : httpsRequest;
    const request = requestFn(url, {
      method,
      headers,
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
    }, resolve);
    request.setTimeout(timeoutMs, () => request.destroy(new Error("La conexión con el origen multimedia agotó el tiempo permitido.")));
    request.on("error", reject);
    request.end();
  });
}

async function openPublicResponse(value, method, headers, timeoutMs = DIRECT_TIMEOUT_MS) {
  let current = parsePublicUrl(value);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const resolved = await resolvePublicAddress(current.hostname);
    const response = await requestResponse(current, resolved, method, headers, timeoutMs);
    const statusCode = response.statusCode ?? 0;
    const location = response.headers.location;
    if (statusCode >= 300 && statusCode < 400 && location) {
      response.resume();
      if (redirectCount === MAX_REDIRECTS) throw new Error("La URL del video tiene demasiadas redirecciones.");
      current = parsePublicUrl(new URL(location, current).toString());
      continue;
    }
    return { response, finalUrl: current.toString() };
  }
  throw new Error("El origen multimedia no pudo resolverse.");
}

function parseContentRange(value) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(String(value ?? "").trim());
  if (!match) return null;
  const start = Number(match[1]); const end = Number(match[2]); const total = Number(match[3]);
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) return null;
  return { start, end, total };
}

async function probeSeekableUrl(value, upstreamHeaders, maximumBytes) {
  const headers = {
    ...sanitizeUpstreamHeaders(upstreamHeaders),
    Accept: "video/webm,video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,application/octet-stream;q=0.8,*/*;q=0.1",
    Range: "bytes=0-0",
  };
  const opened = await openPublicResponse(value, "GET", headers);
  const { response } = opened;
  const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase();
  const contentRange = parseContentRange(response.headers["content-range"]);
  if ((response.statusCode ?? 0) !== 206 || !contentRange) {
    response.destroy();
    throw new Error("Este origen no permite acceso parcial por bytes; se usará el modo compatible con copia temporal.");
  }
  if (!contentType || !allowedContentTypes.has(contentType)) {
    response.destroy();
    throw new Error("El origen parcial no devolvió un tipo de video permitido.");
  }
  if (contentRange.total <= 0 || contentRange.total > maximumBytes) {
    response.destroy();
    throw new Error("El video remoto supera el límite permitido para esta fuente.");
  }
  response.destroy();
  return { url: opened.finalUrl, bytes: contentRange.total, contentType };
}

async function streamResponseToFile(input, destinationPath, maximumBytes) {
  let total = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) { total += chunk.length; if (total > maximumBytes) return callback(new Error("El video remoto supera el límite permitido.")); callback(null, chunk); } });
  const output = createWriteStream(destinationPath, { flags: "wx", mode: 0o600 });
  await pipeline(input, limiter, output);
  if (total <= 0) throw new Error("El video remoto está vacío.");
  return total;
}

function requestDirectVideo(url, resolved, destinationPath) {
  return new Promise((resolve, reject) => {
    const requestFn = url.protocol === "http:" ? httpRequest : httpsRequest;
    const request = requestFn(url, { method: "GET", headers: { Accept: "video/webm,video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/x-msvideo,application/octet-stream;q=0.8,*/*;q=0.1", "User-Agent": "DeUnaGames-MediaImportWorker/5.0" }, lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family) }, (response) => {
      const statusCode = response.statusCode ?? 0; const location = response.headers.location;
      if (statusCode >= 300 && statusCode < 400 && location) { response.resume(); resolve({ statusCode, location }); return; }
      if (statusCode !== 200) { response.resume(); reject(new Error("El servidor remoto no devolvió un video disponible.")); return; }
      const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase();
      const contentLength = Number(response.headers["content-length"] ?? 0);
      if (!contentType || !allowedContentTypes.has(contentType)) { response.resume(); reject(new Error("La URL directa debe devolver un archivo de video o un flujo binario; no una página web.")); return; }
      if (Number.isFinite(contentLength) && contentLength > MAX_DIRECT_SOURCE_BYTES) { response.resume(); reject(new Error("El video remoto supera el límite de 1 GB.")); return; }
      void streamResponseToFile(response, destinationPath, MAX_DIRECT_SOURCE_BYTES).then((bytes) => resolve({ statusCode, contentType, bytes })).catch(reject);
    });
    request.setTimeout(DIRECT_TIMEOUT_MS, () => request.destroy(new Error("La descarga del video agotó el tiempo permitido.")));
    request.on("error", reject); request.end();
  });
}

async function downloadDirectVideo(value, destinationPath) {
  let current = parsePublicUrl(value);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const resolved = await resolvePublicAddress(current.hostname);
    const response = await requestDirectVideo(current, resolved, destinationPath);
    if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
      if (redirectCount === MAX_REDIRECTS) throw new Error("La URL del video tiene demasiadas redirecciones.");
      current = parsePublicUrl(new URL(response.location, current).toString()); continue;
    }
    return { filePath: destinationPath, bytes: response.bytes, contentType: response.contentType, sourceUrl: current.toString() };
  }
  throw new Error("El video remoto no pudo descargarse.");
}

function ytDlpExecutable() { return process.env.DEUNA_YTDLP_PATH?.trim() || "yt-dlp"; }
function contentTypeFromFilename(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".mp4" || extension === ".m4v") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";
  return "application/octet-stream";
}

function configuredYouTubeClients() {
  const configured = process.env.DEUNA_YTDLP_YOUTUBE_CLIENTS?.trim() ?? "";
  if (!configured || configured.toLowerCase() === "auto") return null;
  return configured;
}
function poTokenProviderConfigured() { return Boolean(YTDLP_PLUGIN_DIR && YTDLP_POT_PROVIDER_URL); }
function youtubeClientAttempts() {
  const configured = configuredYouTubeClients();
  if (configured) return [configured];
  return poTokenProviderConfigured() ? [null, "web_safari", "web_embedded", "mweb"] : [null, "web_safari", "web_embedded"];
}
function youtubeProbeAttempts() {
  const configured = configuredYouTubeClients();
  if (configured) return [configured];
  return poTokenProviderConfigured() ? [null, "web_embedded", "mweb"] : [null, "web_embedded"];
}

function classifyYtDlpFailure(stderr, provider) {
  const normalized = stderr.toLowerCase(); const label = providerLabels[provider] ?? provider;
  if (normalized.includes("no such option: --js-runtimes") || normalized.includes("no such option: --remote-components") || normalized.includes("unrecognized arguments: --js-runtimes") || normalized.includes("unrecognized arguments: --remote-components")) return new Error("La instalación de yt-dlp es demasiado antigua para el extractor actual de YouTube.");
  if (provider === "youtube" && (normalized.includes("challenge solving failed") || normalized.includes("failed to solve") || normalized.includes("signature solving") || normalized.includes("yt-dlp-ejs") || normalized.includes("ejs:github"))) return new Error("YouTube no pudo resolver su desafío JavaScript. Revisa Node/EJS y la versión de yt-dlp.");
  if (provider === "youtube" && (normalized.includes("http error 429") || normalized.includes("too many requests"))) return new Error("YouTube bloqueó temporalmente esta IP (HTTP 429).");
  if (provider === "youtube" && (normalized.includes("captcha") || normalized.includes("sign in to confirm"))) return new Error("YouTube activó una verificación anti-bot para esta IP.");
  if (provider === "youtube" && (normalized.includes("http error 403") || normalized.includes("forbidden"))) return new Error("YouTube rechazó la descarga del stream. DeUna ya probó sus rutas públicas compatibles; puede requerirse Proof-of-Origin.");
  if (provider === "youtube" && (normalized.includes("requested format is not available") || normalized.includes("only images are available") || normalized.includes("forcing sabr") || normalized.includes("only sabr formats available"))) return new Error("YouTube no expuso un stream descargable convencional. Para algunos contenidos hace falta el fallback Proof-of-Origin.");
  if (normalized.includes("private") || normalized.includes("members-only")) return new Error(`${label} no permite importar este contenido porque es privado o exclusivo para miembros.`);
  if (normalized.includes("sign in") || normalized.includes("login") || normalized.includes("unavailable") || normalized.includes("not available")) return new Error(`${label} no entregó un stream público descargable para este enlace.`);
  if (normalized.includes("unsupported url") || normalized.includes("no suitable extractor")) return new Error(`El enlace pertenece a ${label}, pero el extractor no reconoce ese formato.`);
  if (normalized.includes("max-filesize") || normalized.includes("file is larger")) return new Error(`La copia temporal de ${label} supera 512 MB.`);
  return new Error(`No se pudo obtener el video público desde ${label}.`);
}

function youtubeRuntimeArgs(provider) { return provider === "youtube" ? ["--js-runtimes", YTDLP_JS_RUNTIME, "--remote-components", YTDLP_REMOTE_COMPONENT] : []; }
function youtubePluginArgs(provider) {
  if (provider !== "youtube" || !poTokenProviderConfigured()) return [];
  return ["--plugin-dirs", YTDLP_PLUGIN_DIR, "--extractor-args", `youtubepot-bgutilhttp:base_url=${YTDLP_POT_PROVIDER_URL}`];
}
function platformSpecificArgs(provider, youtubeClients) { return provider === "youtube" && youtubeClients ? ["--extractor-args", `youtube:player_client=${youtubeClients}`] : []; }
function formatSelectionArgs(provider, youtubeClients) {
  if (provider === "youtube") {
    if (youtubeClients === "web_safari") return ["--format", "b[protocol^=m3u8][height<=480]/b[protocol^=m3u8]/bv*[height<=480]/bv*", "--format-sort", "res:480"];
    return ["--format", "bv*[height<=480]/bv*/b[height<=480]/b", "--format-sort", "res:480"];
  }
  return ["--format", "best[height<=480][vcodec^=avc1][ext=mp4]/best[height<=480][ext=mp4]/best[height<=480]/worst[ext=mp4]/worst"];
}
function lazyFormatSelectionArgs() {
  return [
    "--format",
    "b[protocol=https][height<=480][ext=mp4]/b[protocol=http][height<=480][ext=mp4]/bv*[protocol=https][height<=480][ext=mp4]/bv*[protocol=http][height<=480][ext=mp4]/b[protocol=https][height<=480]/b[protocol=http][height<=480]/bv*[protocol=https][height<=480]/bv*[protocol=http][height<=480]/b[protocol=https]/b[protocol=http]/bv*[protocol=https]/bv*[protocol=http]",
    "--format-sort", "res:480",
  ];
}

function runPlatformYtDlpAttempt(provider, sourceUrl, temporaryDirectory, youtubeClients) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(temporaryDirectory, "source.%(ext)s");
    const args = ["--no-config", ...youtubePluginArgs(provider), ...youtubeRuntimeArgs(provider), ...(YTDLP_COOKIES_FILE ? ["--cookies", YTDLP_COOKIES_FILE] : []), ...platformSpecificArgs(provider, youtubeClients), "--no-playlist", "--concurrent-fragments", "1", "--limit-rate", PLATFORM_DOWNLOAD_RATE, "--retries", "2", "--fragment-retries", "2", "--socket-timeout", "20", "--no-cache-dir", "--no-progress", "--no-part", "--no-mtime", "--no-write-subs", "--no-write-auto-subs", "--no-write-thumbnail", "--no-write-info-json", "--no-write-playlist-metafiles", ...formatSelectionArgs(provider, youtubeClients), "--max-filesize", "512M", "--output", outputTemplate, sourceUrl];
    const child = spawn(ytDlpExecutable(), args, { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = ""; let settled = false;
    const timeout = setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, PLATFORM_TIMEOUT_MS);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { if (stderr.length < MAX_ERROR_CHARS) stderr += chunk.slice(0, MAX_ERROR_CHARS - stderr.length); });
    child.once("error", (error) => { if (settled) return; settled = true; clearTimeout(timeout); reject(error.code === "ENOENT" ? new Error("yt-dlp no está disponible en el worker multimedia.") : error); });
    child.once("close", (code, signal) => { if (settled) return; settled = true; clearTimeout(timeout); if (signal) return reject(new Error("La importación de plataforma excedió el tiempo permitido.")); if (code !== 0) return reject(new YtDlpCommandError(stderr)); resolve(); });
  });
}

async function clearPlatformOutputs(temporaryDirectory) {
  const entries = await readdir(temporaryDirectory);
  await Promise.all(entries.filter((entry) => entry.startsWith("source.")).map((entry) => rm(path.join(temporaryDirectory, entry), { recursive: true, force: true })));
}

async function runPlatformYtDlp(provider, sourceUrl, temporaryDirectory) {
  const attempts = provider === "youtube" ? youtubeClientAttempts() : [null]; const diagnostics = [];
  for (let index = 0; index < attempts.length; index += 1) {
    const youtubeClients = attempts[index] ?? null;
    if (index > 0) await clearPlatformOutputs(temporaryDirectory);
    try { await runPlatformYtDlpAttempt(provider, sourceUrl, temporaryDirectory, youtubeClients); return; }
    catch (error) {
      if (!(error instanceof YtDlpCommandError)) throw error;
      const attemptLabel = provider === "youtube" ? (youtubeClients ?? "auto") : provider;
      diagnostics.push(`[${attemptLabel}] ${error.stderr}`);
      if (YTDLP_DIAGNOSTICS && error.stderr.trim()) console.error(`[yt-dlp:${provider}:${attemptLabel}] ${error.stderr.slice(-MAX_ERROR_CHARS)}`);
    }
  }
  throw classifyYtDlpFailure(diagnostics.join("\n--- siguiente intento ---\n"), provider);
}

function runYtDlpProbeAttempt(provider, sourceUrl, youtubeClients) {
  return new Promise((resolve, reject) => {
    const args = ["--no-config", ...youtubePluginArgs(provider), ...youtubeRuntimeArgs(provider), ...(YTDLP_COOKIES_FILE ? ["--cookies", YTDLP_COOKIES_FILE] : []), ...platformSpecificArgs(provider, youtubeClients), "--no-playlist", "--skip-download", "--no-warnings", "--no-progress", "--no-cache-dir", ...lazyFormatSelectionArgs(provider), "--dump-single-json", sourceUrl];
    const child = spawn(ytDlpExecutable(), args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = ""; let settled = false;
    const timeout = setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, PLATFORM_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8"); child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      if (stdout.length + chunk.length > MAX_METADATA_BYTES) { child.kill("SIGKILL"); return; }
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => { if (stderr.length < MAX_ERROR_CHARS) stderr += chunk.slice(0, MAX_ERROR_CHARS - stderr.length); });
    child.once("error", (error) => { if (settled) return; settled = true; clearTimeout(timeout); reject(error.code === "ENOENT" ? new Error("yt-dlp no está disponible en el worker multimedia.") : error); });
    child.once("close", (code, signal) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (signal) return reject(new Error(stdout.length >= MAX_METADATA_BYTES ? "La metadata de la plataforma es demasiado grande." : "La consulta de metadata excedió el tiempo permitido."));
      if (code !== 0) return reject(new YtDlpCommandError(stderr));
      let parsed;
      try { parsed = JSON.parse(stdout); } catch { return reject(new Error("yt-dlp no devolvió metadata JSON válida.")); }
      resolve(parsed);
    });
  });
}

function selectedRemoteFormat(info) {
  const candidates = [
    info,
    ...(Array.isArray(info?.requested_downloads) ? info.requested_downloads : []),
    ...(Array.isArray(info?.requested_formats) ? info.requested_formats : []),
  ];
  return candidates.find((candidate) => {
    const protocol = String(candidate?.protocol ?? "").toLowerCase();
    return candidate && typeof candidate.url === "string" && /^https?:\/\//i.test(candidate.url) && (protocol === "http" || protocol === "https" || protocol === "");
  }) ?? null;
}

async function probePlatformVideo(provider, value) {
  const sourceUrl = parsePlatformUrl(provider, value).toString();
  const attempts = provider === "youtube" ? youtubeProbeAttempts() : [null];
  const diagnostics = [];
  for (const attemptedClients of attempts) {
    try {
      const info = await runYtDlpProbeAttempt(provider, sourceUrl, attemptedClients ?? null);
      const selected = selectedRemoteFormat(info);
      if (!selected) throw new Error("La plataforma sólo ofreció un manifiesto/stream no apto para acceso parcial seguro.");
      const headers = sanitizeUpstreamHeaders(selected.http_headers ?? info.http_headers);
      const probed = await probeSeekableUrl(selected.url, headers, MAX_PLATFORM_SOURCE_BYTES);
      const duration = Number(info.duration);
      return {
        kind: "platform",
        provider,
        sourceUrl,
        resolvedUrl: probed.url,
        upstreamHeaders: headers,
        bytes: probed.bytes,
        contentType: probed.contentType,
        durationSeconds: Number.isFinite(duration) && duration > 0 && duration <= 86_400 ? Math.round(duration * 1_000) / 1_000 : null,
      };
    } catch (error) {
      if (error instanceof YtDlpCommandError) diagnostics.push(error.stderr);
      else diagnostics.push(error instanceof Error ? error.message : "fallo de sondeo");
    }
  }
  const joined = diagnostics.join("\n--- siguiente intento ---\n");
  if (/private|members-only|sign in|login|unavailable|not available|unsupported url|no suitable extractor/i.test(joined)) throw classifyYtDlpFailure(joined, provider);
  throw new Error("Esta plataforma no expuso una fuente HTTP seekable. DeUna usará automáticamente la copia temporal compatible.");
}

async function probeDirectVideo(value) {
  const sourceUrl = parsePublicUrl(value).toString();
  const headers = { "User-Agent": "DeUnaGames-MediaImportWorker/5.0" };
  const probed = await probeSeekableUrl(sourceUrl, headers, MAX_DIRECT_SOURCE_BYTES);
  return {
    kind: "direct",
    provider: null,
    sourceUrl,
    resolvedUrl: probed.url,
    upstreamHeaders: headers,
    bytes: probed.bytes,
    contentType: probed.contentType,
    durationSeconds: null,
  };
}

function cleanupSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(sessionId);
  }
}

function createPreviewSession(probe) {
  cleanupSessions();
  if (sessions.size >= MAX_SESSIONS) throw new Error("Hay demasiadas vistas previas remotas abiertas. Termina o recarga alguna antes de preparar otra.");
  const sessionId = randomBytes(24).toString("hex");
  const internalKey = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const session = { ...probe, sessionId, internalKey, expiresAt };
  sessions.set(sessionId, session);
  return session;
}

function resolveSession(sessionId) {
  if (!SESSION_PATTERN.test(sessionId)) return null;
  cleanupSessions();
  const session = sessions.get(sessionId) ?? null;
  if (!session || session.expiresAt <= Date.now()) { sessions.delete(sessionId); return null; }
  return session;
}

function requestedRange(value, totalBytes) {
  const maximumChunkEnd = (start) => Math.min(totalBytes - 1, start + MAX_STREAM_CHUNK_BYTES - 1);
  if (!value) return { start: 0, end: maximumChunkEnd(0) };
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value).trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, MAX_STREAM_CHUNK_BYTES, totalBytes);
    return { start: totalBytes - length, end: totalBytes - 1 };
  }
  const start = Number(match[1]);
  const desiredEnd = match[2] ? Number(match[2]) : totalBytes - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(desiredEnd) || start < 0 || start >= totalBytes || desiredEnd < start) return null;
  return { start, end: Math.min(desiredEnd, maximumChunkEnd(start)) };
}

async function serveSessionStream(request, response, session, headOnly) {
  const shared = {
    "Content-Type": session.contentType,
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  };
  if (headOnly) {
    response.writeHead(200, { ...shared, "Content-Length": String(session.bytes) });
    response.end();
    return;
  }
  const range = requestedRange(request.headers.range, session.bytes);
  if (!range) {
    response.writeHead(416, { ...shared, "Content-Range": `bytes */${session.bytes}` });
    response.end();
    return;
  }
  const headers = {
    ...sanitizeUpstreamHeaders(session.upstreamHeaders),
    Accept: "*/*",
    Range: `bytes=${range.start}-${range.end}`,
  };
  const opened = await openPublicResponse(session.resolvedUrl, "GET", headers);
  const upstream = opened.response;
  const upstreamRange = parseContentRange(upstream.headers["content-range"]);
  if ((upstream.statusCode ?? 0) !== 206 || !upstreamRange || upstreamRange.start !== range.start || upstreamRange.end < range.start) {
    upstream.destroy();
    throw new Error("El origen dejó de aceptar rangos parciales.");
  }
  const end = Math.min(range.end, upstreamRange.end);
  const length = end - range.start + 1;
  response.writeHead(206, {
    ...shared,
    "Content-Length": String(length),
    "Content-Range": `bytes ${range.start}-${end}/${session.bytes}`,
  });
  let total = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) {
    total += chunk.length;
    if (total > length) return callback(new Error("El origen remoto excedió el rango solicitado."));
    callback(null, chunk);
  } });
  await pipeline(upstream, limiter, response);
}

function parseTrimWindow(startValue, endValue, durationSeconds) {
  const start = Number(startValue); const end = Number(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start > 86_400 || end > 86_400) throw new Error("El recorte solicitado no es válido.");
  const roundedStart = Math.round(start * 1_000) / 1_000;
  const roundedEnd = Math.round(end * 1_000) / 1_000;
  const duration = Math.round((roundedEnd - roundedStart) * 1_000) / 1_000;
  if (duration <= 0 || duration > 30) throw new Error("El recorte debe durar como máximo 30 segundos.");
  if (Number.isFinite(durationSeconds) && durationSeconds > 0 && roundedEnd > durationSeconds + 0.25) throw new Error("El recorte termina después de la duración del video.");
  return { startSeconds: roundedStart, endSeconds: roundedEnd, durationSeconds: duration };
}

function formatSeconds(value) { return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }

function runSegmentFfmpeg(session, trim, outputPath) {
  return new Promise((resolve, reject) => {
    const inputUrl = `http://${HOST}:${PORT}/internal-stream/${session.sessionId}/${session.internalKey}`;
    const args = [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-ss", formatSeconds(trim.startSeconds), "-i", inputUrl,
      "-t", formatSeconds(trim.durationSeconds),
      "-map", "0:v:0", "-an", "-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
      "-filter_threads", "1",
      "-vf", "scale=w='min(640,iw)':h=-2:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=20",
      "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-threads", "2",
      "-b:v", "500k", "-maxrate", "700k", "-bufsize", "1400k", "-g", "40", "-pix_fmt", "yuv420p",
      "-f", "webm", outputPath,
    ];
    const child = spawn(FFMPEG_PATH, args, { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = ""; let settled = false;
    const timeout = setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, SEGMENT_TIMEOUT_MS);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { if (stderr.length < MAX_ERROR_CHARS) stderr += chunk.slice(0, MAX_ERROR_CHARS - stderr.length); });
    child.once("error", (error) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      reject(error.code === "ENOENT" ? new Error("FFmpeg no está disponible dentro del worker multimedia.") : error);
    });
    child.once("close", (code, signal) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (signal) return reject(new Error("El recorte remoto excedió el tiempo permitido."));
      if (code !== 0) return reject(new Error(stderr.trim() || "FFmpeg no pudo extraer el tramo remoto."));
      resolve();
    });
  });
}

async function buildRemoteSegment(session, startSeconds, endSeconds, temporaryDirectory) {
  const trim = parseTrimWindow(startSeconds, endSeconds, session.durationSeconds);
  const filePath = path.join(temporaryDirectory, "segment.webm");
  await runSegmentFfmpeg(session, trim, filePath);
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > MAX_SEGMENT_BYTES) throw new Error("El tramo remoto generado no superó la validación de tamaño.");
  return { filePath, bytes: stats.size, contentType: "video/webm", sourceUrl: session.sourceUrl, trim };
}

async function downloadPlatformVideo(provider, value, temporaryDirectory) {
  const sourceUrl = parsePlatformUrl(provider, value).toString();
  await runPlatformYtDlp(provider, sourceUrl, temporaryDirectory);
  const entries = await readdir(temporaryDirectory);
  const candidates = entries.filter((entry) => entry.startsWith("source.") && !entry.endsWith(".part") && !entry.endsWith(".ytdl") && !entry.endsWith(".json"));
  if (candidates.length !== 1) throw new Error("La plataforma no produjo una única fuente temporal válida.");
  const filename = candidates[0]; const filePath = path.join(temporaryDirectory, filename); const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > MAX_PLATFORM_SOURCE_BYTES) throw new Error("La copia temporal de la plataforma supera 512 MB o no es válida.");
  return { filePath, bytes: stats.size, contentType: contentTypeFromFilename(filename), sourceUrl };
}

async function sendFile(response, result) {
  response.writeHead(200, { "Content-Type": result.contentType, "Content-Length": String(result.bytes), "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Deuna-Source-Url": Buffer.from(result.sourceUrl, "utf8").toString("base64url") });
  await pipeline(createReadStream(result.filePath), response);
}

function routeParts(request) {
  try { return new URL(request.url ?? "/", `http://${HOST}:${PORT}`).pathname.split("/").filter(Boolean); }
  catch { return []; }
}

const server = createServer(async (request, response) => {
  response.setHeader("Connection", "close");
  const parts = routeParts(request);

  if ((request.method === "GET" || request.method === "HEAD") && parts[0] === "internal-stream" && parts.length === 3) {
    const session = resolveSession(parts[1]);
    if (!session || !INTERNAL_KEY_PATTERN.test(parts[2]) || parts[2] !== session.internalKey) return jsonError(response, 404, "No encontrado.");
    try { await serveSessionStream(request, response, session, request.method === "HEAD"); }
    catch { if (!response.headersSent) jsonError(response, 502, "El stream remoto no está disponible."); else if (!response.writableEnded) response.destroy(); }
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && parts[0] === "stream" && parts.length === 2) {
    if (!authorized(request)) return jsonError(response, 401, "No autorizado.");
    const session = resolveSession(parts[1]);
    if (!session) return jsonError(response, 404, "La sesión multimedia venció.");
    try { await serveSessionStream(request, response, session, request.method === "HEAD"); }
    catch (error) { if (!response.headersSent) jsonError(response, 502, error instanceof Error ? error.message : "El stream remoto no está disponible."); else if (!response.writableEnded) response.destroy(); }
    return;
  }

  if (request.method === "DELETE" && parts[0] === "session" && parts.length === 2) {
    if (!authorized(request)) return jsonError(response, 401, "No autorizado.");
    if (SESSION_PATTERN.test(parts[1])) sessions.delete(parts[1]);
    response.writeHead(204, { "Cache-Control": "no-store, max-age=0" }); response.end(); return;
  }

  if (request.method !== "POST" || !["source", "probe", "segment"].includes(parts[0]) || parts.length !== 1) return jsonError(response, 404, "No encontrado.");
  if (!authorized(request)) return jsonError(response, 401, "No autorizado.");
  if (activeJob) return jsonError(response, 429, "Ya hay una tarea multimedia pesada en curso.");
  activeJob = true;
  let temporaryDirectory = null;
  try {
    const payload = await readJsonBody(request);

    if (parts[0] === "probe") {
      let probe;
      if (payload.kind === "direct") {
        if (typeof payload.url !== "string") throw new Error("Falta la URL directa.");
        probe = await probeDirectVideo(payload.url);
      } else if (payload.kind === "platform") {
        if (typeof payload.provider !== "string" || typeof payload.url !== "string") throw new Error("Falta el proveedor o el enlace de plataforma.");
        probe = await probePlatformVideo(payload.provider, payload.url);
      } else throw new Error("Tipo de sondeo no permitido.");
      const session = createPreviewSession(probe);
      jsonResponse(response, 200, {
        sessionId: session.sessionId,
        bytes: session.bytes,
        contentType: session.contentType,
        sourceUrl: session.sourceUrl,
        durationSeconds: session.durationSeconds,
        expiresAt: session.expiresAt,
      });
      return;
    }

    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "deuna-media-import-worker-"));

    if (parts[0] === "segment") {
      if (typeof payload.sessionId !== "string") throw new Error("Falta la sesión multimedia.");
      const session = resolveSession(payload.sessionId);
      if (!session) throw new Error("La sesión multimedia venció.");
      const result = await buildRemoteSegment(session, payload.startSeconds, payload.endSeconds, temporaryDirectory);
      await sendFile(response, result);
      return;
    }

    let result;
    if (payload.kind === "direct") {
      if (typeof payload.url !== "string") throw new Error("Falta la URL directa.");
      result = await downloadDirectVideo(payload.url, path.join(temporaryDirectory, "source.video"));
    } else if (payload.kind === "platform") {
      if (typeof payload.provider !== "string" || typeof payload.url !== "string") throw new Error("Falta el proveedor o el enlace de plataforma.");
      result = await downloadPlatformVideo(payload.provider, payload.url, temporaryDirectory);
    } else throw new Error("Tipo de importación no permitido.");
    await sendFile(response, result);
  } catch (error) {
    if (!response.headersSent) jsonError(response, 400, error instanceof Error ? error.message : "La tarea multimedia falló.");
    else if (!response.writableEnded) response.destroy();
  } finally {
    activeJob = false;
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

server.requestTimeout = 11 * 60 * 1_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 2_000;
server.maxRequestsPerSocket = 1;
server.listen(PORT, HOST, () => console.log(`DeUna media import worker escuchando sólo en ${HOST}:${PORT}.`));
