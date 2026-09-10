import {
  readFile,
} from "node:fs/promises";
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
  packageJson,
  serving,
  route,
  createService,
  lifecycleSmoke,
] = await Promise.all([
  source("package.json"),
  source("src/lib/media/editorial-media-serving.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/lib/admin/content-create-service.ts"),
  source("tools/editorial-media-serving-lifecycle-smoke.mjs"),
]);

assert(
  has(
    serving,
    '"game"',
    '"game_taxonomy"',
    '"site_config"',
    "editorial_publications",
    "publication_number",
    "parseEditorialPayload",
    "listGameImageReferences",
    "listGameVideoReferences",
    "taxonomy.classifications",
    "taxonomy.tags",
    "site.logoAsset"
  ),
  "La decisión pública debe derivarse de snapshots publicados reales para juegos, taxonomía y logo, sin leer borradores."
);

assert(
  has(
    serving,
    "publishedReferenceCache",
    "cached?.references.has(publicPath)",
    "cached.publicationNumber",
    "item.publication_number"
  ),
  "La ruta debe reutilizar sólo referencias positivas ya publicadas y refrescar la historia cuando cambia publication_number."
);

assert(
  has(
    createService,
    "public_visible",
    "false",
    "'bootstrap'",
    "actor_user_id"
  ) &&
    has(
      serving,
      "action <> 'bootstrap'",
      "OR actor_user_id IS NULL"
    ),
  "Los bootstraps administrativos de contenido nuevo oculto no deben contarse como exposición pública; sólo bootstraps fuente/migración sin actor y publicaciones explícitas."
);

assert(
  has(
    serving,
    "isAdminEnabled()",
    "readAdminSessionToken()",
    "resolveAdminSession",
    'return "public"',
    'return (await hasAdminMediaAccess())',
    ': "admin"',
    ": null"
  ),
  "Un asset no publicado sólo puede degradar a preview Admin autenticado; el tráfico anónimo debe fallar cerrado."
);

assert(
  has(
    route,
    "resolveEditorialMediaServingAccess",
    "if (!servingAccess)",
    'servingAccess === "admin"',
    '"private, no-store, max-age=0"',
    '"public, max-age=31536000, immutable"',
    'servingAccess === "public"',
    "ETag"
  ),
  "La ruta física debe aplicar 404 anónimo, no-store privado y cache inmutable únicamente a referencias publicadas."
);

assert(
  route.indexOf("await lstat(resolved.filePath)") <
    route.indexOf("resolveEditorialMediaServingAccess") &&
    route.indexOf("resolveEditorialMediaServingAccess") <
      route.indexOf("const sharedHeaders"),
  "La ruta debe descartar paths inexistentes antes de consultar publicación y decidir acceso antes de construir headers cacheables."
);

assert(
  has(
    lifecycleSmoke,
    'kind="kind"'
  ) === false &&
    has(
      lifecycleSmoke,
      'name="kind"',
      "library",
      "assertAnonymousPrivate",
      "assertPrivatePreview",
      "assertPublicImmutable",
      "/media-upload",
      "/media",
      "/publish",
      "/restore",
      "historical-public"
    ),
  "El smoke debe cubrir upload aislado, borrador, preview Admin, publicación y restauración histórica sobre la ruta real."
);

assert(
  packageJson.includes("check-editorial-media-serving-boundary.mjs") &&
    packageJson.includes("editorial-media-serving-lifecycle-smoke.mjs"),
  "La barrera estática y el lifecycle real deben permanecer conectados a los comandos canónicos."
);

if (failures.length > 0) {
  console.error("\nFrontera de serving multimedia editorial: ERROR\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exit(1);
}

console.log(
  "Frontera de serving multimedia editorial: OK (historial público real inmutable; bootstrap oculto excluido; draft/biblioteca 404 anónimo + preview Admin privado)."
);
