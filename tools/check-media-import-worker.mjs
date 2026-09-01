import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [
  workerClient,
  worker,
  publicService,
  workerService,
  runtimeEnv,
  workerEnv,
  remoteSource,
  youtubeSource,
  youtubeRoute,
  previewForm,
  hoverPreview,
  nextConfig,
] = await Promise.all([
  source("src/lib/media/media-import-worker-client.ts"),
  source("ops/worker/media-import-worker.mjs"),
  source("ops/systemd/deuna-games.service.example"),
  source("ops/systemd/deuna-games-media-import.service.example"),
  source("ops/systemd/runtime.env.example"),
  source("ops/systemd/media-import.env.example"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/youtube-video-source.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-youtube/route.ts"),
  source("src/components/admin/GamePreviewClipUploadForm.tsx"),
  source("src/components/ui/HoverPreviewMedia.tsx"),
  source("next.config.ts"),
]);

assert(
  publicService.includes("IPAddressDeny=any") &&
    publicService.includes("IPAddressAllow=localhost"),
  "El proceso web público debe conservar su bloqueo de red saliente y limitarse a loopback."
);

assert(
  workerClient.includes('url.protocol !== "http:"') &&
    workerClient.includes('url.hostname === "127.0.0.1"') &&
    workerClient.includes('url.hostname === "localhost"') &&
    workerClient.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN") &&
    workerClient.includes("token.length < 32") &&
    workerClient.includes("MAX_WORKER_RESPONSE_BYTES") &&
    workerClient.includes("createWriteStream") &&
    workerClient.includes("pipeline(response, limiter, output)") &&
    workerClient.includes("requireRemoteImportWorkerInProduction"),
  "El runtime web sólo debe aceptar un worker HTTP de loopback autenticado, acotado y con respuesta en streaming."
);

assert(
  remoteSource.includes("requireRemoteImportWorkerInProduction") &&
    remoteSource.includes("mediaImportWorkerConfigured") &&
    remoteSource.includes("downloadViaMediaImportWorker") &&
    remoteSource.includes('kind: "direct"') &&
    remoteSource.includes("downloadDirectlyForDevelopment"),
  "Las URLs directas deben salir por el worker en producción y conservar un fallback seguro sólo para desarrollo."
);

assert(
  youtubeSource.includes("requireRemoteImportWorkerInProduction") &&
    youtubeSource.includes("downloadViaMediaImportWorker") &&
    youtubeSource.includes('kind: "youtube"') &&
    youtubeSource.includes("youtubeImportActive") &&
    youtubeSource.includes("runYtDlp") &&
    youtubeSource.includes("storeEditorialPreviewVideoFromPath"),
  "YouTube debe usar el worker en producción, mantener una sola importación y reutilizar el transcodificador WebM seguro."
);

assert(
  worker.includes('const HOST = "127.0.0.1"') &&
    worker.includes("timingSafeEqual") &&
    worker.includes("MAX_REQUEST_BYTES = 8 * 1024") &&
    worker.includes("MAX_SOURCE_BYTES = 64 * 1024 * 1024") &&
    worker.includes("activeJob") &&
    worker.includes("BlockList") &&
    worker.includes("lookup") &&
    worker.includes('url.protocol !== "https:"') &&
    worker.includes("MAX_REDIRECTS = 3") &&
    worker.includes('"--no-playlist"') &&
    worker.includes('"--concurrent-fragments"') &&
    worker.includes('"--limit-rate"') &&
    worker.includes('YOUTUBE_DOWNLOAD_RATE = "6M"') &&
    worker.includes('"--download-sections"') &&
    worker.includes('"bestvideo[height<=480]/best[height<=480]/worstvideo"') &&
    worker.includes('"--max-filesize"') &&
    worker.includes("spawn(ytDlpExecutable()") &&
    worker.includes("shell: false") &&
    worker.includes("recursive: true") &&
    worker.includes("maxRequestsPerSocket = 1"),
  "El worker debe ser loopback-only, autenticado, mono-tarea y limitar SSRF, red, calidad, tamaño, procesos y temporales."
);

assert(
  workerService.includes("Nice=10") &&
    workerService.includes("CPUQuota=35%") &&
    workerService.includes("MemoryHigh=256M") &&
    workerService.includes("MemoryMax=384M") &&
    workerService.includes("TasksMax=48") &&
    workerService.includes("PrivateTmp=true") &&
    workerService.includes("ProtectSystem=strict") &&
    workerService.includes("NoNewPrivileges=true") &&
    workerService.includes("/usr/local/lib/deuna-games/media-import-worker.mjs") &&
    !workerService.includes("DEUNA_DATABASE_"),
  "El worker de producción debe tener prioridad baja, cuotas y aislamiento sin recibir credenciales de base de datos."
);

assert(
  runtimeEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_URL=http://127.0.0.1:3101/source") &&
    runtimeEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN=") &&
    workerEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_PORT=3101") &&
    workerEnv.includes("DEUNA_MEDIA_IMPORT_WORKER_TOKEN=") &&
    workerEnv.includes("DEUNA_YTDLP_PATH="),
  "La configuración de producción debe separar el token/URL del runtime y el ejecutable yt-dlp del worker."
);

assert(
  youtubeRoute.includes("authorizeAdminFormRequest") &&
    youtubeRoute.includes("hasExactAdminFormFields") &&
    youtubeRoute.includes("parseYouTubeVideoUrl") &&
    youtubeRoute.includes("parsePreviewTrimWindow") &&
    youtubeRoute.includes("saveGameMediaDraft"),
  "La entrada de YouTube debe seguir atravesando sesión, campos exactos, revisión y borrador editorial."
);

assert(
  previewForm.includes('type SourceMode = "file" | "url" | "youtube"') &&
    previewForm.includes("parseYouTubeVideoUrl") &&
    previewForm.includes("YouTubeTrimEditor") &&
    previewForm.includes("/preview-youtube") &&
    previewForm.includes("DeUna no descarga el video en el servidor"),
  "El panel debe distinguir YouTube y no descargarlo durante la selección IN/OUT."
);

assert(
  nextConfig.includes('"frame-src \'none\'"') &&
    nextConfig.includes("frame-src https://www.youtube-nocookie.com") &&
    nextConfig.includes('source: "/admin/:path*"'),
  "La CSP pública debe bloquear iframes y permitir youtube-nocookie sólo en el panel."
);

assert(
  !hoverPreview.toLowerCase().includes("youtube") &&
    hoverPreview.includes('preload="none"'),
  "Las tarjetas públicas no deben cargar YouTube ni cambiar su estrategia de preview WebM lazy."
);

if (failures.length > 0) {
  console.error("");
  console.error("Worker de importación multimedia: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Worker de importación multimedia: OK (runtime público sin egress, worker loopback con cuotas, YouTube/URL aislados y salida pública WebM preservada)."
);
