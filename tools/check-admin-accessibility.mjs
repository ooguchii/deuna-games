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
  protectedLayout,
  themeContract,
  taxonomySelectCss,
  platformCss,
  newGameCss,
] = await Promise.all([
  source("src/components/admin/AdminShell.tsx"),
  source("src/components/admin/AdminShellUx.module.css"),
  source("src/components/admin/AdminCatalog.module.css"),
  source("src/components/admin/AdminGamesCatalog.tsx"),
  source("src/components/admin/AdminUpdatesCatalog.tsx"),
  source("src/app/admin/(protected)/page.tsx"),
  source("src/lib/admin/publication-overview.ts"),
  source("src/app/admin/(protected)/layout.tsx"),
  source("src/app/admin/admin-theme-contract.css"),
  source("src/components/admin/GameTaxonomyMultiSelect.module.css"),
  source("src/components/admin/GamePlatformEditor.module.css"),
  source("src/components/admin/NewGameForm.module.css"),
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
  shellUx.includes('.main :is(a, button):focus-visible') &&
    shellUx.includes('.main :is(input, textarea, select):focus-visible') &&
    shellUx.includes('.main input[type="search"]:focus-visible') &&
    shellUx.includes("outline: none;") &&
    shellUx.includes("box-shadow: none;") &&
    !shellUx.includes("#ff9bb3"),
  "El shell debe usar un único sistema de foco y los estados activos deben derivar de la marca."
);

assert(
  protectedLayout.includes('import "../admin-theme-contract.css"') &&
    themeContract.includes(':has(> input[type="search"]):focus-within') &&
    themeContract.includes('input[type="search"]:focus-visible') &&
    themeContract.includes('button[aria-pressed="true"]') &&
    themeContract.includes('main#main-content:focus-visible') &&
    themeContract.includes("var(--admin-brand-text-strong)"),
  "El área protegida debe cargar el contrato de tema adaptativo para foco, búsqueda y selección."
);

assert(
  taxonomySelectCss.includes("color-mix(in srgb, var(--brand)") &&
    taxonomySelectCss.includes(".search input:focus-visible") &&
    !taxonomySelectCss.includes("rgba(255, 21, 84") &&
    !taxonomySelectCss.includes("rgba(255, 80, 126") &&
    !taxonomySelectCss.includes("#ff9bb7"),
  "Las selecciones de taxonomía y su buscador deben adaptarse a la marca sin conservar el rojo histórico."
);

assert(
  platformCss.includes("color-mix(in srgb, var(--brand)") &&
    !platformCss.includes("#ffe1e8"),
  "Las plataformas activas deben derivar su color del tema publicado."
);

assert(
  newGameCss.includes("color-mix(in srgb, var(--brand)") &&
    !newGameCss.includes("#ffb2c4") &&
    !newGameCss.includes("#e9b5c1") &&
    !newGameCss.includes("#e3a4b3"),
  "El flujo Nuevo juego no debe conservar acentos rosados fijos en acciones de marca."
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
  publicationOverview.includes('"game_taxonomy",') &&
    publicationOverview.includes('"public_pages_config",') &&
    publicationOverview.includes("pendingItems") &&
    publicationOverview.includes("ANY($1::text[])") &&
    publicationOverview.includes("[publishableTypes]") &&
    publicationOverview.includes("LIMIT 10"),
  "El overview debe incluir todos los tipos publicables, usar SQL parametrizado y mantener una cola acotada de pendientes."
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
    `Accesibilidad administrativa: OK (${adminCssFiles.length} módulos revisados; escala legible, foco único, tema adaptativo, teclado, movimiento reducido y catálogos semánticos).`
  );
}
