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
  editor,
  multimedia,
  route,
  staging,
  remote,
  platform,
] = await Promise.all([
  source("src/components/admin/GamePreviewAutoUrlEditor.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-url/route.ts"),
  source("src/lib/media/editorial-video-staging.ts"),
  source("src/lib/media/remote-video-source.ts"),
  source("src/lib/media/platform-video-source.ts"),
]);

assert(
  multimedia.includes("GamePreviewAutoUrlEditor") &&
    multimedia.includes("slug={slug}") &&
    multimedia.includes("revision={revision}"),
  "Multimedia debe exponer el importador automático de URL con slug y revisión actuales."
);

assert(
  editor.includes("parseSupportedPlatformVideoUrl") &&
    editor.includes("/preview-url") &&
    editor.includes("VideoTrimEditor") &&
    editor.includes("/preview-import") &&
    editor.includes("Crear preview WebM con este recorte"),
  "La URL automática debe detectar plataforma, preparar staging, recortar con IN/OUT y finalizar por preview-import."
);

assert(
  route.includes("createStagedRemotePreviewSource") &&
    route.includes("parseSupportedPlatformVideoUrl") &&
    route.includes("expectedRevisionSchema") &&
    route.includes("hasExactAdminFormFields") &&
    route.includes('sourceKind: platform ? "platform" : "direct"'),
  "La API automática debe mantener seguridad editorial y elegir plataforma o URL directa sin confiar en el cliente."
);

assert(
  staging.includes("downloadPlatformEditorialVideo") &&
    staging.includes("downloadRemoteEditorialVideo") &&
    staging.includes("parseSupportedPlatformVideoUrl"),
  "El staging compartido debe enrutar redes conocidas al importador de plataforma y URLs directas al importador remoto."
);

assert(
  remote.includes("BlockList") &&
    remote.includes("resolvePublicAddress") &&
    remote.includes("MAX_REDIRECTS") &&
    remote.includes("allowedContentTypes") &&
    remote.includes("requireRemoteImportWorkerInProduction"),
  "La URL directa debe conservar defensa SSRF, redirecciones limitadas, MIME permitido y worker aislado en producción."
);

assert(
  platform.includes("yt-dlp") &&
    platform.includes("configuredYouTubeClients") &&
    platform.includes('return "web_embedded,default"'),
  "Las plataformas detectadas deben conservar yt-dlp y la estrategia estable de adquisición de YouTube."
);

if (failures.length > 0) {
  console.error("");
  console.error("Importación automática de URL: ERROR");
  console.error("");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Importación automática de URL: OK (detección de plataforma/directa → staging privado → IN/OUT → WebM interno)."
);
