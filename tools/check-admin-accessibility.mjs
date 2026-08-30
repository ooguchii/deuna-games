import {
  readdir,
  readFile,
} from "node:fs/promises";
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
  shell,
  shellUx,
  catalogCss,
  gamesCatalog,
  updatesCatalog,
  dashboard,
  publicationOverview,
] = await Promise.all([
  source("src/components/admin/AdminShell.tsx"),
  source("src/components/admin/AdminShellUx.module.css"),
  source("src/components/admin/AdminCatalog.module.css"),
  source("src/components/admin/AdminGamesCatalog.tsx"),
  source("src/components/admin/AdminUpdatesCatalog.tsx"),
  source("src/app/admin/(protected)/page.tsx"),
  source("src/lib/admin/publication-overview.ts"),
]);

assert(
  shell.includes('href="#main-content"') &&
    shell.includes("Saltar al contenido principal") &&
    shell.includes('id="main-content"') &&
    shell.includes("tabIndex={-1}"),
  "El shell administrativo debe conservar un salto de teclado al contenido principal."
);

assert(
  shellUx.includes(":focus-visible") &&
    shellUx.includes("outline: 3px solid") &&
    shellUx.includes("@media (prefers-reduced-motion: reduce)") &&
    shellUx.includes("min-height: 44px") &&
    shellUx.includes("font-size: 14px"),
  "El shell administrativo debe conservar foco visible, reducción de movimiento y una escala legible de controles."
);

assert(
  catalogCss.includes("font-size: 15px") &&
    catalogCss.includes("font-size: 12px") &&
    catalogCss.includes("border-bottom: 1px solid #2e3a47") &&
    catalogCss.includes("nth-child(even)") &&
    catalogCss.includes(":focus-within") &&
    catalogCss.includes("min-height: 38px"),
  "Los catálogos administrativos deben distinguir filas, jerarquía de texto, foco y acciones legibles."
);

for (const [name, content] of [
  ["Juegos", gamesCatalog],
  ["Actualizaciones", updatesCatalog],
]) {
  assert(
    content.includes('role="search"') &&
      content.includes('role="status"') &&
      content.includes('aria-live="polite"') &&
      content.includes("<caption") &&
      content.includes('className={styles.srOnly}'),
    `${name} debe conservar búsqueda semántica, resultados anunciables y caption accesible.`
  );
}

assert(
  gamesCatalog.includes("Todas las clasificaciones") &&
    gamesCatalog.includes(">Clasificación<") &&
    !gamesCatalog.includes("Todas las categorías"),
  "El catálogo de Juegos debe presentar la taxonomía unificada como Clasificación."
);

assert(
  dashboard.includes("Requiere atención") &&
    dashboard.includes("publication.pendingItems") &&
    dashboard.includes("attentionPath"),
  "El Resumen debe ofrecer una cola operativa de contenido que requiere atención."
);

assert(
  publicationOverview.includes('| "game_taxonomy"') &&
    publicationOverview.includes('| "public_pages_config"') &&
    publicationOverview.includes("pendingItems") &&
    publicationOverview.includes("LIMIT 10"),
  "El overview debe incluir Catálogos, Presentación pública y una cola acotada de pendientes."
);

const adminCssDir = path.join(
  root,
  "src/components/admin"
);
const adminCssFiles = (await readdir(adminCssDir))
  .filter((file) => file.endsWith(".module.css"));

for (const file of adminCssFiles) {
  const css = await readFile(
    path.join(adminCssDir, file),
    "utf8"
  );
  const tinyPixelSizes = [
    ...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px\s*;/g),
  ]
    .map((match) => Number(match[1]))
    .filter((size) => size < 11);

  assert(
    tinyPixelSizes.length === 0,
    `${file} vuelve a introducir tipografía menor a 11px (${tinyPixelSizes.join(", ")}).`
  );
}

if (failures.length > 0) {
  console.error("\nAccesibilidad administrativa: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Accesibilidad administrativa: OK (${adminCssFiles.length} módulos revisados; escala legible, foco visible, teclado, movimiento reducido y catálogos semánticos).`
  );
}
