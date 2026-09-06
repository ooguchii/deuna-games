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
  adminRoute,
  requestSecurity,
  taxonomyForms,
  taxonomyRoute,
  heroRoute,
  homeRoute,
  homePresentationRoute,
  homeCombinedRoute,
] = await Promise.all([
  source("src/lib/admin/admin-route.ts"),
  source("src/lib/admin/request-security.ts"),
  source("src/lib/admin/game-taxonomy-forms.ts"),
  source("src/app/api/admin/content/catalogs/games/route.ts"),
  source("src/app/api/admin/content/home/hero/route.ts"),
  source("src/app/api/admin/content/home/route.ts"),
  source("src/app/api/admin/content/home/presentation/route.ts"),
  source("src/app/api/admin/content/home/content/route.ts"),
]);

assert(
  requestSecurity.includes("const MAX_ADMIN_FORM_BYTES = 8 * 1024") &&
    requestSecurity.includes("maxBytes = MAX_ADMIN_FORM_BYTES"),
  "El lector genérico y el login deben conservar el límite defensivo de 8 KiB.",
);

assert(
  adminRoute.includes("const MAX_AUTHORIZED_ADMIN_FORM_BYTES = 64 * 1024") &&
    adminRoute.includes("options?.maxFormBytes ??") &&
    adminRoute.includes("MAX_AUTHORIZED_ADMIN_FORM_BYTES") &&
    adminRoute.includes("resolveAdminSession(token)") &&
    adminRoute.indexOf("resolveAdminSession(token)") <
      adminRoute.indexOf("readTrustedAdminForm("),
  "Los formularios Admin autenticados deben tener un techo editorial de 64 KiB aplicado sólo después de validar sesión.",
);

assert(
  taxonomyForms.includes("GAME_TAXONOMY_MAX_JSON_CHARS = 100_000") &&
    taxonomyForms.includes("GAME_TAXONOMY_MAX_FORM_BYTES") &&
    taxonomyForms.includes("GAME_TAXONOMY_MAX_JSON_CHARS * 9") &&
    taxonomyForms.includes(".max(GAME_TAXONOMY_MAX_JSON_CHARS)"),
  "Catálogos debe derivar su límite HTTP grande desde el mismo máximo JSON que valida Zod.",
);

assert(
  taxonomyRoute.includes("GAME_TAXONOMY_MAX_FORM_BYTES") &&
    taxonomyRoute.includes("maxFormBytes: GAME_TAXONOMY_MAX_FORM_BYTES"),
  "La ruta de Catálogos debe declarar explícitamente su excepción mayor a 64 KiB.",
);

assert(
  heroRoute.includes("maxFormBytes: HOME_HERO_MAX_FORM_BYTES") &&
    homeRoute.includes("maxFormBytes: HOME_CURATION_MAX_FORM_BYTES") &&
    homePresentationRoute.includes("maxFormBytes: HOME_PRESENTATION_MAX_FORM_BYTES") &&
    homeCombinedRoute.includes("maxFormBytes: HOME_CONTENT_MAX_FORM_BYTES"),
  "Hero e Inicio deben conservar sus límites explícitos derivados del dominio y no depender del techo editorial general.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Admin form limits: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    "Admin form limits: OK (8 KiB genérico/login, 64 KiB editorial autenticado y excepciones explícitas para Catálogos/Hero/Inicio).",
  );
}
