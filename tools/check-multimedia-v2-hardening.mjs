import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) =>
  needles.every((needle) => text.includes(needle));

const [
  policy,
  editorialVideo,
  videoEditor,
  uploadRoute,
  importRoute,
  multimediaPage,
  multimediaEditor,
  workspace,
  contextualCss,
] = await Promise.all([
  source("src/lib/media/preview-video-policy.ts"),
  source("src/lib/media/editorial-video.ts"),
  source("src/components/admin/GameVideoLibraryEditor.tsx"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/admin/(protected)/juegos/[slug]/page.tsx"),
  source("src/components/admin/GameMultimediaEditor.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.module.css"),
]);

assert(
  has(
    policy,
    'PREVIEW_QUALITY_IDS = ["720p", "1080p"]',
    'DEFAULT_PREVIEW_QUALITY: PreviewQualityId = "1080p"',
    "PREVIEW_FPS_OPTIONS = [24, 25, 30, 50, 60]",
    "DEFAULT_PREVIEW_FPS: PreviewFps = 50",
    "MAX_PREVIEW_FPS: PreviewFps = 60",
    "parsePreviewFps"
  ) &&
    !policy.includes('"performance",\n  "balanced",\n  "high"'),
  "La política activa debe ser 720p/1080p con 1080p50 por defecto y máximo 60 FPS."
);

assert(
  has(
    editorialVideo,
    '"720p"',
    '"1080p"',
    "probeSourceFps",
    "Math.min(requestedFps, sourceFps)",
    "effectiveFps",
    "profile.compression",
    "MAX_EDITORIAL_PREVIEW_BYTES"
  ) &&
    !editorialVideo.includes("cardQualityProfiles") &&
    !editorialVideo.includes("heroQualityProfiles"),
  "El master debe conservar resolución/FPS elegidos, no inventar cuadros y variar sólo compresión antes de fallar."
);

assert(
  has(
    videoEditor,
    "PREVIEW_FPS_OPTIONS",
    "DEFAULT_PREVIEW_FPS",
    '"X-Deuna-Preview-Fps": String(fps)',
    'fps: String(fps)',
    "Default 50 FPS",
    "máximo 60"
  ),
  "El editor debe exponer FPS reales y enviarlos tanto a upload local como a import remoto."
);

assert(
  has(uploadRoute, "parsePreviewFps", "x-deuna-preview-fps", "preview-fps-invalido") &&
    has(importRoute, "parsePreviewFps", "targetViewportFpsFields", "preview-fps-invalido"),
  "El servidor debe revalidar FPS en las dos rutas de creación del master."
);

assert(
  !multimediaPage.includes("GamePreviewClipUploadForm") &&
    !multimediaPage.includes("mediaAction") &&
    !multimediaEditor.includes("mediaAction") &&
    has(multimediaEditor, "GameVideoLibraryEditor", "GameMultimediaWorkspaceContextual"),
  "La pantalla multimedia no debe conservar el wrapper temporal ni el plumbing del formulario manual antiguo."
);

assert(
  workspace.includes("DeleteImageResourceForm") &&
    workspace.includes('value="gallery-remove"') &&
    workspace.includes("Editar") &&
    workspace.includes("Quitar") &&
    contextualCss.includes(".galleryItemPreview .deleteResourceForm") &&
    contextualCss.includes("display: none"),
  "Galería debe ofrecer Editar/Quitar sin exponer la eliminación destructiva; la Biblioteca conserva su ×."
);

try {
  await access(
    path.join(root, "src/components/admin/GamePreviewClipUploadForm.tsx")
  );
  failures.push(
    "GamePreviewClipUploadForm.tsx volvió a aparecer aunque el editor ya usa GameVideoLibraryEditor directamente."
  );
} catch {}

if (failures.length) {
  console.error("\nMultimedia v2 hardening: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Multimedia v2 hardening: OK (1080p50 default · 60 FPS máximo · sin FPS inventados · master único · Galería no destructiva · wrapper temporal eliminado)."
);
