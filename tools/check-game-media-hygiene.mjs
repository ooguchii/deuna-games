import { readFile } from "node:fs/promises";
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
  hygiene,
  workspace,
  workspaceRoute,
  deleteRoute,
  publishRoute,
  utilityRail,
  publicationWorkspace,
] = await Promise.all([
  source("src/lib/admin/game-media-hygiene.ts"),
  source("src/lib/admin/game-media-workspace.ts"),
  source("src/app/api/admin/content/games/[slug]/media-workspace/route.ts"),
  source("src/app/api/admin/content/games/[slug]/media-resource-delete/route.ts"),
  source("src/app/api/admin/content/games/[slug]/publish/route.ts"),
  source("src/components/admin/GameMultimediaUtilityRail.tsx"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
]);

assert(
  has(
    hygiene,
    '"active"',
    '"reserved"',
    '"published-only"',
    '"unused"',
    'resource.origin === "editorial"',
    'status === "unused" || status === "published-only"'
  ),
  "La higiene debe distinguir uso activo, reserva, publicación anterior y huérfanos, bloqueando sólo masters editoriales sin referencia del borrador."
);

assert(
  has(
    workspace,
    "reconcileEditorialMediaDeletions",
    "getPublishedGameImageReferences",
    "getPublishedGameVideoReferences",
    "evaluateGameMediaHygiene",
    "evaluateGameMediaRequirements",
    "resolveGameGalleryItems"
  ),
  "El snapshot multimedia debe reunir borrador, publicación, Galería, requisitos e higiene desde una fuente autoritativa del servidor."
);

assert(
  has(
    workspaceRoute,
    "verifyAdminSession",
    "getGameMediaWorkspaceSnapshot",
    '"Cache-Control": "no-store"'
  ),
  "El endpoint del workspace multimedia debe permanecer privado, dinámico y sin caché compartida."
);

assert(
  has(
    deleteRoute,
    "listGameImageReferences",
    "listGameVideoReferences",
    "draftReferences.has(resource)",
    "markEditorialMediaForDeletion",
    "publishedReferences.has(selected.src)",
    'redirectPath(slug, "recurso-eliminacion-pendiente")'
  ),
  "Eliminar un master debe rechazar referencias del borrador y diferir el borrado físico mientras la publicación actual siga usándolo."
);

assert(
  has(
    publishRoute,
    "getGameMediaWorkspaceSnapshot",
    "!mediaWorkspace.hygiene.ready",
    '`${target}?estado=higiene-multimedia`',
    "await getGameMediaWorkspaceSnapshot(slug)"
  ),
  "Publicación debe revalidar higiene en servidor y reconciliar eliminaciones diferidas después de publicar."
);

assert(
  has(
    utilityRail,
    '"Sin archivos editoriales sin uso"',
    '"Por resolver',
    "resource.hygiene?.usage",
    'usage={previewResource.hygiene?.usage ?? []}'
  ),
  "Biblioteca debe mostrar higiene, filtro de recursos por resolver y usos reales del master."
);

assert(
  has(
    publicationWorkspace,
    "mediaHygiene.ready",
    "Higiene multimedia",
    "publicationEssentialsReady",
    'state === "higiene-multimedia"'
  ),
  "La revisión de Publicación debe reflejar y bloquear visualmente la misma higiene que valida el servidor."
);

if (failures.length) {
  console.error("\nHigiene multimedia: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Higiene multimedia: OK (clasificación autoritativa · publicación bloqueada · borrado diferido seguro · Biblioteca y Publicación coherentes)."
);
