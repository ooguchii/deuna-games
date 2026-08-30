import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(
    path.join(root, relativePath),
    "utf8"
  );
}

const [
  page,
  form,
  createRoute,
  creationService,
] = await Promise.all([
  source("src/app/admin/(protected)/juegos/nuevo/page.tsx"),
  source("src/components/admin/NewGameForm.tsx"),
  source("src/app/api/admin/content/games/route.ts"),
  source("src/lib/admin/content-create-service.ts"),
]);

assert(
  page.includes("existingSlugs") &&
    page.includes("games.map((game) => game.key)") &&
    page.includes("existingSlugs={existingSlugs}"),
  "Nuevo juego debe reutilizar la lectura editorial existente para conocer identificadores ocupados sin crear una API pública adicional."
);

assert(
  form.includes("availableSlug") &&
    form.includes("existingSlugSet") &&
    form.includes("existing.has(base)") &&
    form.includes("existing.has(candidate)") &&
    form.includes("160 - suffix.length") &&
    form.includes("slugTaken") &&
    form.includes("Identificador disponible") &&
    form.includes("slugTaken || !slugValid") &&
    form.includes("categories.length === 0"),
  "El formulario debe generar un slug libre, reservar espacio para sufijos, bloquear identificadores ocupados y exigir una categoría maestra disponible."
);

assert(
  form.includes('pattern="[a-z0-9][a-z0-9._-]*"') &&
    form.includes("slugPattern") &&
    form.includes("aria-invalid") &&
    form.includes("aria-live=\"polite\""),
  "La ayuda de slug debe mantener la misma forma permitida por el servidor y comunicar su estado de forma accesible."
);

assert(
  createRoute.includes("hasExactAdminFormFields") &&
    createRoute.includes("resolveGameTaxonomySelection") &&
    createRoute.includes('result.outcome === "exists"') &&
    createRoute.includes("?estado=duplicado") &&
    createRoute.includes("?estado=clasificacion") &&
    creationService.includes("ON CONFLICT (item_type, item_key)") &&
    creationService.includes('outcome: created ? "created" : "exists"'),
  "La prevención visual nunca debe sustituir el rechazo transaccional de duplicados ni la validación de clasificación en el servidor."
);

if (failures.length > 0) {
  console.error("\nAlta de juegos: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Alta de juegos: OK (slug automático libre, categoría maestra obligatoria, detección accesible y rechazo transaccional preservados)."
  );
}
