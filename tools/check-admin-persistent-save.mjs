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
  themeContract,
  gameActions,
  newGame,
  taxonomy,
  homeCuration,
  homePresentation,
  configuration,
  appearance,
  backgrounds,
  publicPresentation,
  about,
  historicalUpdate,
  publicationPanel,
  gamePublication,
  integratedUpdate,
  mediaUpload,
] = await Promise.all([
  source("src/app/admin/admin-theme-contract.css"),
  source("src/components/admin/GameEditorFormActions.tsx"),
  source("src/components/admin/NewGameForm.tsx"),
  source("src/components/admin/GameTaxonomyEditor.tsx"),
  source("src/components/admin/HomeCurationEditor.tsx"),
  source("src/components/admin/HomePresentationEditor.tsx"),
  source("src/app/admin/(protected)/configuracion/page.tsx"),
  source("src/components/admin/SiteAppearanceWorkspace.tsx"),
  source("src/components/admin/SiteBackgroundManager.tsx"),
  source("src/app/admin/(protected)/paginas/presentacion/page.tsx"),
  source("src/app/admin/(protected)/paginas/quienes-somos/page.tsx"),
  source("src/app/admin/(protected)/actualizaciones/[id]/page.tsx"),
  source("src/components/admin/PublicationPanel.tsx"),
  source("src/components/admin/GamePublicationWorkspace.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/actualizacion/page.tsx"),
  source("src/components/admin/GameMediaUploadForm.tsx"),
]);

assert(
  themeContract.includes('form:has(> input[name="expectedRevision"])') &&
    themeContract.includes('form[action="/api/admin/content/games"]') &&
    themeContract.includes("position: fixed !important") &&
    themeContract.includes("left: 248px") &&
    themeContract.includes("left: 220px") &&
    themeContract.includes("left: 0") &&
    themeContract.includes("env(safe-area-inset-bottom)"),
  "El panel debe conservar una barra de guardado fija, adaptable al sidebar, móvil y safe-area."
);

for (const excludedAction of [
  "/publish",
  "/hide",
  "/restore",
  "/media-upload",
  "/preview-upload",
  "/preview-import",
  "/background-upload",
  "/icon-upload",
]) {
  assert(
    themeContract.includes(`[action*="${excludedAction}"]`),
    `La barra persistente debe excluir el subflujo ${excludedAction}.`
  );
}

assert(
  gameActions.includes("admin-form-actions") &&
    gameActions.includes("saveLabel") &&
    gameActions.includes("continueLabel") &&
    gameActions.includes('type="submit"'),
  "Juegos debe conservar su contrato común de Guardar / Guardar y continuar."
);

const revisionEditors = [
  ["Clasificaciones y etiquetas", taxonomy, "Guardar"],
  ["Inicio · Curaduría", homeCuration, "Guardar curaduría"],
  ["Inicio · Presentación", homePresentation, "Guardar presentación"],
  ["Marca · Identidad", configuration, "Guardar borrador"],
  ["Marca · Paleta", appearance, "Guardar colores"],
  ["Marca · Fondos", backgrounds, "Guardar fondo"],
  ["Páginas públicas · Presentación", publicPresentation, "Guardar borrador"],
  ["Páginas públicas · Quiénes somos", about, "Guardar"],
  ["Actualización histórica", historicalUpdate, "Guardar borrador histórico"],
];

for (const [label, content, saveCopy] of revisionEditors) {
  assert(
    content.includes("expectedRevision") && content.includes(saveCopy),
    `${label} debe seguir usando revisión editorial y una acción de guardado cubierta por la barra persistente.`
  );
}

assert(
  newGame.includes('action="/api/admin/content/games"') &&
    newGame.includes("Crear borrador y continuar"),
  "Nuevo juego debe conservar la excepción persistente que crea el primer borrador."
);

assert(
  publicationPanel.includes("publish") &&
    publicationPanel.includes("restore") &&
    gamePublication.includes("Publicar") &&
    integratedUpdate.includes("publish-update") &&
    integratedUpdate.includes("Publicar nueva versión") &&
    mediaUpload.includes("media-upload"),
  "Las acciones de publicación y los subflujos multimedia deben seguir identificables para quedar fuera del guardado persistente."
);

if (failures.length > 0) {
  console.error("\nGuardado persistente administrativo: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Guardado persistente administrativo: OK (editores de borrador cubiertos; publicación, acciones operativas y cargas auxiliares separadas)."
);
