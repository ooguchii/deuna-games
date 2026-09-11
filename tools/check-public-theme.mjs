import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const minimumPublicTextSizePx = 11;

const read = async (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");

async function sourceFiles(directory) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(relative));
      continue;
    }
    if (/\.(?:css|js|jsx|mjs|ts|tsx)$/.test(entry.name)) {
      files.push(relative.replaceAll(path.sep, "/"));
    }
  }

  return files;
}

function requireIncludes(content, marker, message) {
  if (!content.includes(marker)) {
    failures.push(message);
  }
}

function requireExcludes(content, marker, message) {
  if (content.includes(marker)) {
    failures.push(message);
  }
}

function selectorForDeclaration(content, declarationIndex) {
  const blockStart = content.lastIndexOf("{", declarationIndex);
  if (blockStart < 0) return "";

  const previousClose = content.lastIndexOf("}", blockStart - 1);
  const previousOpen = content.lastIndexOf("{", blockStart - 1);
  const selectorStart = Math.max(previousClose, previousOpen) + 1;

  return content
    .slice(selectorStart, blockStart)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const legacyBrandMarkers = [
  "#ff0847",
  "#ff2d68",
  "#ff3b78",
  "rgba(255, 8, 71",
  "rgba(255, 45, 104",
  "rgba(255, 59, 120",
];

/*
 * Estos archivos ya fueron saneados desde la fuente. Un regreso de cualquiera
 * de los colores históricos debe bloquear mantenimiento. No se incluyen aquí
 * rojo de error, verde de éxito/rendimiento ni dorado de rating/warning.
 */
const strictThemeFiles = [
  "src/app/cuenta/account.module.css",
  "src/app/cuenta/account-dashboard.module.css",
  "src/app/cuenta/account-rewards.module.css",
  "src/app/actualizaciones/page.module.css",
  "src/app/juegos/page.module.css",
  "src/app/not-found.module.css",
  "src/components/home/HeroSection.module.css",
  "src/features/game-finder/GameFinderClient.module.css",
  "src/features/game-finder/CpuIdentificationAssistant.module.css",
  "src/features/game-finder/HardwareSetupModal.module.css",
];

for (const file of strictThemeFiles) {
  const content = await read(file);

  for (const marker of legacyBrandMarkers) {
    requireExcludes(
      content,
      marker,
      `${file}: reapareció el color histórico de marca ${marker}. Usa tokens de tema.`
    );
  }
}

const layout = await read("src/app/layout.tsx");
const theme = await read("src/theme/deuna-theme.css");
const contract = await read("src/theme/public-theme-contract.css");
const routeContract = await read("src/theme/public-route-theme-contract.css");
const hero = await read("src/components/home/HeroSection.module.css");
const heroComponent = await read("src/components/home/HeroSection.tsx");
const gamesHero = await read("src/app/juegos/page.module.css");

requireIncludes(
  layout,
  '"--theme-brand": config.brandColor',
  "src/app/layout.tsx: debe publicar --theme-brand desde la configuración pública."
);
requireIncludes(
  layout,
  '"--theme-bg": readableThemeBackground',
  "src/app/layout.tsx: debe publicar un fondo de tema normalizado."
);
requireIncludes(
  layout,
  '"--text-on-brand": readableBrandText',
  "src/app/layout.tsx: debe publicar contraste adaptable sobre la marca."
);
requireIncludes(
  layout,
  'import "@/theme/public-theme-contract.css";',
  "src/app/layout.tsx: falta el contrato visual público general."
);
requireIncludes(
  layout,
  'import "@/theme/public-route-theme-contract.css";',
  "src/app/layout.tsx: falta el contrato visual por ruta."
);

const generalContractIndex = layout.indexOf(
  'import "@/theme/public-theme-contract.css";'
);
const routeContractIndex = layout.indexOf(
  'import "@/theme/public-route-theme-contract.css";'
);
if (
  generalContractIndex < 0 ||
  routeContractIndex < 0 ||
  routeContractIndex < generalContractIndex
) {
  failures.push(
    "src/app/layout.tsx: el contrato por ruta debe cargarse después del contrato público general."
  );
}

requireIncludes(
  theme,
  "--theme-violet: color-mix(in srgb, var(--theme-brand)",
  "src/theme/deuna-theme.css: el antiguo acento violeta debe derivarse de la marca configurada."
);
requireIncludes(
  theme,
  "--gradient-page:",
  "src/theme/deuna-theme.css: falta el gradiente de página temático."
);
requireIncludes(
  theme,
  "body { background: var(--gradient-page); }",
  "src/theme/deuna-theme.css: el fondo público final debe usar --gradient-page."
);

/* Los tres módulos heredados grandes siguen teniendo declaraciones antiguas,
 * pero su estilo efectivo final está cubierto semánticamente por este contrato.
 * Si desaparece una cobertura, CI falla aunque el módulo siga compilando. */
for (const marker of [
  'section[aria-label="Actualizaciones destacadas"]',
  '[role="dialog"][aria-labelledby="config-title"]',
  'section[aria-labelledby="finder-unified-title"]',
]) {
  requireIncludes(
    contract,
    marker,
    `src/theme/public-theme-contract.css: falta cobertura dinámica para ${marker}.`
  );
}

requireIncludes(
  contract,
  "var(--text-on-brand)",
  "src/theme/public-theme-contract.css: las superficies de marca deben respetar contraste adaptable."
);
requireIncludes(
  routeContract,
  '[aria-label="Resumen del catálogo"] strong',
  "src/theme/public-route-theme-contract.css: falta tematizar el resumen de /juegos."
);
requireIncludes(
  routeContract,
  'section[aria-labelledby="overview-title"]',
  "src/theme/public-route-theme-contract.css: falta tematizar la barra informativa de la ficha de juego."
);

/*
 * Finder unificado y ficha de juego conservan CSS legacy compacto, pero el
 * contrato por ruta es la última autoridad visual. Estas marcas son parte de
 * la excepción: si una desaparece, no se permite ocultar los literales chicos
 * del módulo fuente sin una cobertura efectiva equivalente.
 */
for (const marker of [
  'section[aria-labelledby="finder-unified-title"]\n  [aria-label="Resumen del proceso"]',
  'article[aria-label="Perfil actual del equipo"]',
  'article:has(button[aria-label^="Ver análisis de "])',
  'aside[aria-labelledby="compatibility-title"]',
  'section[aria-labelledby="versions-title"]',
]) {
  requireIncludes(
    routeContract,
    marker,
    `src/theme/public-route-theme-contract.css: falta cobertura de legibilidad para ${marker}.`
  );
}
requireIncludes(
  routeContract,
  "font-size: var(--font-micro) !important;",
  "src/theme/public-route-theme-contract.css: la cobertura legacy debe imponer --font-micro como mínimo efectivo."
);

/*
 * El Hero no puede volver a crear una segunda escena ambiental ni conservar
 * parámetros de esa implementación retirada. La comprobación recorre todo
 * `src/` para que tampoco sobrevivan restos en schemas, tipos o editores.
 */
const forbiddenHeroAmbientMarkers = [
  "ambientBackdrop",
  "ambientFrame",
  "ambientImage",
  "ambientShade",
  "ambientBlur",
  "ambientOpacity",
];

const allSourceFiles = await sourceFiles("src");

for (const file of allSourceFiles) {
  const content = await read(file);
  for (const marker of forbiddenHeroAmbientMarkers) {
    requireExcludes(
      content,
      marker,
      `${file}: quedó un resto de la capa ambiental eliminada (${marker}).`
    );
  }
}

/*
 * La escala tipográfica pública define 11px como `--font-micro`, su mínimo.
 * Los literales menores eluden el sistema y en capturas mobile/low-resolution
 * pierden legibilidad. Se excluye Admin porque tiene su contrato visual propio.
 *
 * Dos módulos legacy densos aún declaran tamaños históricos, pero sólo se
 * toleran los selectores exactos cubiertos por el contrato efectivo anterior.
 * Cualquier selector nuevo por debajo del mínimo vuelve a bloquear CI.
 */
const legacyTypographyCoveredSelectors = new Map([
  [
    "src/app/juegos/[slug]/page.module.css",
    new Set([
      ".compatibilityEyebrow",
      ".compatibilityStatus",
      ".compatibilitySteps li::before",
      ".compatibilityResult > div span",
      ".compatibilityResult > p span",
      ".compatibilityMeta dt",
      ".versionRow > div span",
    ]),
  ],
  [
    "src/features/game-finder/GameFinderUnifiedHero.module.css",
    new Set([
      ".microFlow",
      ".trust",
      ".profileIdentityTop > span",
      ".profileTitleLine small",
      ".profileStateLabel",
      ".profileHint",
      ".specLabel",
      ".specItem dd",
      ".profileActions button",
      ".recommendationsHeader > span",
      ".recommendationsHeader button",
      ".recommendationMeta strong",
      ".recommendationFooter > span",
    ]),
  ],
]);
const publicStyleFiles = allSourceFiles.filter(
  (file) =>
    file.endsWith(".css") &&
    !file.startsWith("src/components/admin/") &&
    !file.includes("/admin/")
);
const literalFontSizePattern = /font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px\s*;/g;

for (const file of publicStyleFiles) {
  const content = await read(file);
  for (const match of content.matchAll(literalFontSizePattern)) {
    const size = Number.parseFloat(match[1]);
    if (size <= 0 || size >= minimumPublicTextSizePx) continue;

    const selector = selectorForDeclaration(content, match.index);
    const coveredSelectors = legacyTypographyCoveredSelectors.get(file);
    if (coveredSelectors?.has(selector)) continue;

    const line = content.slice(0, match.index).split("\n").length;
    const selectorDetail = selector ? ` en ${selector}` : "";
    failures.push(
      `${file}:${line}: font-size ${size}px${selectorDetail} queda por debajo de ` +
      `--font-micro (${minimumPublicTextSizePx}px). Usa la escala tipográfica pública.`
    );
  }
}

requireExcludes(
  hero,
  "ambientBackdrop",
  "HeroSection: reapareció la capa ambiental eliminada."
);
requireExcludes(
  heroComponent,
  "ambientBackdrop",
  "HeroSection.tsx: reapareció la capa ambiental eliminada."
);
requireIncludes(
  hero,
  "var(--brand)",
  "HeroSection: sus controles y acentos deben seguir respondiendo a la marca configurada."
);

requireIncludes(
  gamesHero,
  ".heroImage::after",
  "Juegos Hero: falta la capa de recoloración de la imagen."
);
requireIncludes(
  gamesHero,
  "background:\n    var(--brand);",
  "Juegos Hero: el tono de la imagen debe derivarse directamente de la marca configurada."
);
requireIncludes(
  gamesHero,
  "mix-blend-mode: hue",
  "Juegos Hero: la recoloración debe preservar luminosidad y detalle de la imagen."
);

if (failures.length > 0) {
  console.error("\nTema público: BLOQUEADO\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Tema público: OK (marca/fondo dinámicos, contraste adaptable, tipografía pública >= --font-micro, Hero sin capa ambiental ni restos heredados y contratos protegidos)."
  );
}
