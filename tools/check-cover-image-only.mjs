import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const [
  types,
  workspace,
  libraryRoute,
  uploadRoute,
  importRoute,
  layoutRoute,
  videoMedia,
  requirements,
  readiness,
  integrity,
  validation,
  history,
  serving,
  legacy,
] = await Promise.all([
  source("src/types/game.ts"),
  source("src/components/admin/GameMultimediaWorkspaceContextual.tsx"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-upload/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-import/route.ts"),
  source("src/app/api/admin/content/games/[slug]/preview-layout/route.ts"),
  source("src/lib/media/game-video-media.ts"),
  source("src/lib/media/game-media-requirements.ts"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/lib/admin/game-media-integrity.ts"),
  source("src/lib/admin/content-validation.ts"),
  source("src/lib/admin/game-media-history.ts"),
  source("src/lib/media/editorial-media-serving.ts"),
  source("src/lib/media/legacy-game-cover-video.ts"),
]);

assert(
  types.includes("Portada es siempre imagen") &&
    !types.includes("GameCoverVideo") &&
    !types.includes("cover?: GameDestinationMediaMode") &&
    !types.includes("cover?: GameCoverVideo"),
  "Game no debe volver a exponer modo o video para Portada."
);

assert(
  workspace.includes('target="cover-image"') &&
    workspace.includes("Imagen obligatoria · recorte 4:5") &&
    workspace.includes("Sólo imagen. Selecciona un recurso y confirma un único recorte 4:5.") &&
    !workspace.includes('target="cover-video"') &&
    !workspace.includes('target="cover-mode"') &&
    !workspace.includes("coverVideo") &&
    !workspace.includes("coverMode"),
  "El editor de Portada debe ofrecer únicamente imagen y un recorte 4:5."
);

for (const [name, text] of [
  ["media-library", libraryRoute],
  ["preview-upload", uploadRoute],
  ["preview-import", importRoute],
  ["preview-layout", layoutRoute],
]) {
  assert(
    !text.includes('"cover-video"') &&
      !text.includes('"cover-mode"') &&
      !text.includes('normalized === "cover"') &&
      !text.includes('value === "cover"'),
    `${name} no debe admitir un target de video/modo para Portada.`
  );
}

assert(
  videoMedia.includes('if (target === "cover") return "image"') &&
    !videoMedia.includes("resolveGameCoverVideo") &&
    !videoMedia.includes("media?.cover"),
  "El dominio de video debe tratar Portada como imagen y excluir cualquier resolver de video."
);

assert(
  requirements.includes("const coverAssigned = Boolean(game.coverImage)") &&
    requirements.includes('mode: "image" as const') &&
    !requirements.includes("videoMedia?.cover") &&
    readiness.includes("La Portada requiere una imagen y su recorte 4:5 confirmado."),
  "Readiness/publicación debe depender sólo de coverImage y su recorte 4:5."
);

assert(
  !integrity.includes("game.videoMedia?.cover") &&
    !integrity.includes("game.videoMedia.cover"),
  "La integridad activa no debe considerar video de Portada."
);

assert(
  validation.includes('cover: destinationVideoSchema.optional()') &&
    validation.includes("activeVideoMedia") &&
    legacy.includes("legacyGameCoverVideoReference") &&
    history.includes("legacyGameCoverVideoReference(row.payload)") &&
    serving.includes("legacyGameCoverVideoReference(payload)"),
  "La única compatibilidad de cover-video debe quedar aislada en lectura histórica/retención/serving."
);

if (failures.length) {
  console.error("\nPortada image-only: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Portada image-only: OK (imagen + recorte 4:5; sin video/hover en UI, API, dominio, tipos o readiness; legado histórico aislado)."
);
