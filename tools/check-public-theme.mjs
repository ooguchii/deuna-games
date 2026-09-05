import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

const read = async (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");

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
 * El Hero ya no debe crear una segunda escena ambiental a partir de la imagen
 * activa. El fondo configurado de la página es la única capa exterior detrás
 * del carrusel; así el Hero no puede oscurecer ni invadir la sección siguiente.
 */
for (const marker of [
  "ambientBackdrop",
  "ambientFrame",
  "ambientImage",
  "ambientShade",
]) {
  requireExcludes(
    hero,
    marker,
    `HeroSection: reapareció la capa ambiental eliminada (${marker}).`
  );
  requireExcludes(
    heroComponent,
    marker,
    `HeroSection.tsx: reapareció la capa ambiental eliminada (${marker}).`
  );
}
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
    "Tema público: OK (marca/fondo dinámicos, contraste adaptable, Hero sin ambiente exterior y contratos heredados protegidos)."
  );
}
