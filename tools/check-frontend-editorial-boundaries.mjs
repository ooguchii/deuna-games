import {
  readFile,
  readdir,
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

async function joinSources(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const names = await readdir(directory);
  const files = names.filter((name) => name.endsWith(".tsx"));
  const contents = await Promise.all(
    files.map((name) => readFile(path.join(directory, name), "utf8"))
  );
  return contents.join("\n");
}

const [
  rootLayout,
  manifest,
  openGraphImage,
  socialImage,
  homePage,
  homeConfig,
  publicHomeReader,
  homeComponents,
  gamesPage,
  updatesPage,
  requirementsPage,
  publicPagesConfig,
  publicPagesReader,
  footer,
] = await Promise.all([
  source("src/app/layout.tsx"),
  source("src/app/manifest.ts"),
  source("src/app/opengraph-image.tsx"),
  source("src/lib/social-image.tsx"),
  source("src/app/page.tsx"),
  source("src/data/home-config.ts"),
  source("src/lib/home/public-home-config.ts"),
  joinSources("src/components/home"),
  source("src/app/juegos/page.tsx"),
  source("src/app/actualizaciones/page.tsx"),
  source("src/app/requisitos/page.tsx"),
  source("src/data/public-pages-config.ts"),
  source("src/lib/site/public-pages-config.ts"),
  source("src/components/layout/Footer.tsx"),
]);

assert(
  homePage.includes("getPublicHomeConfig") &&
    homePage.includes("homeConfig.sections.map(renderSection)") &&
    homePage.includes("const copy = homeConfig.copy") &&
    homeConfig.includes("sections:") &&
    homeConfig.includes("copy:"),
  "Inicio debe resolver orden, visibilidad y copy desde una sola configuración editorial publicada."
);

assert(
  publicHomeReader.includes('item_type = \'home_config\'') &&
    publicHomeReader.includes("published_payload") &&
    publicHomeReader.includes("public_visible = true") &&
    publicHomeReader.includes("cache(") &&
    !publicHomeReader.includes("draft_payload"),
  "La configuración pública de Inicio debe ser cacheada y leer sólo el snapshot publicado visible."
);

for (const phrase of [
  "COMPATIBILIDAD DE JUEGOS",
  "Ver todas las actualizaciones",
  "RECOMENDADOS PARA EQUIPOS",
  "Una selección de juegos que creemos que vale la pena conocer.",
  "Versiones identificadas",
]) {
  assert(
    homeConfig.includes(phrase) && !homeComponents.includes(phrase),
    `El copy editorial de Inicio debe vivir en home-config y no quedar fijo en componentes: ${phrase}`
  );
}

assert(
  rootLayout.includes("getPublicHomeConfig") &&
    rootLayout.includes("homeConfig.copy.hero.accessibleTitle") &&
    homePage.includes("homeConfig.copy.hero.accessibleTitle") &&
    !rootLayout.includes("Encuentra juegos para tu PC") &&
    !homePage.includes("Encuentra juegos para tu PC"),
  "La metadata de Inicio debe reutilizar el título accesible publicado en Portada, sin mantener un segundo copy SEO fijo."
);

assert(
  manifest.includes("getPublicSiteConfig") &&
    manifest.includes("name: config.name") &&
    manifest.includes("short_name: config.shortName") &&
    manifest.includes("description: config.description") &&
    manifest.includes("theme_color: config.themeColor"),
  "El manifest debe reutilizar la identidad pública publicada en vez de duplicar marca o descripción."
);

assert(
  openGraphImage.includes("getPublicHomeConfig") &&
    openGraphImage.includes("homeConfig.copy.hero.accessibleTitle") &&
    openGraphImage.includes("headline:") &&
    socialImage.includes("headline: string") &&
    socialImage.includes("identity.headline") &&
    !socialImage.includes("Encuentra juegos para&nbsp;") &&
    !socialImage.includes(">tu PC<"),
  "La imagen social debe reutilizar el titular publicado de Portada y no conservar un copy promocional paralelo."
);

for (const [name, content] of [
  ["Juegos", gamesPage],
  ["Actualizaciones", updatesPage],
  ["¿Qué puedo jugar?", requirementsPage],
]) {
  assert(
    content.includes("getPublicPagesConfig") &&
      !content.includes("sourcePublicPagesConfig"),
    `${name} debe consumir la configuración editorial publicada y no la fuente directamente.`
  );
}

assert(
  publicPagesConfig.includes("games:") &&
    publicPagesConfig.includes("updates:") &&
    publicPagesConfig.includes("finder:") &&
    publicPagesReader.includes("published_payload") &&
    publicPagesReader.includes("public_visible = true") &&
    publicPagesReader.includes("cache(") &&
    !publicPagesReader.includes("draft_payload"),
  "Las superficies públicas deben compartir una configuración estructurada, cacheada y basada sólo en snapshots publicados."
);

for (const phrase of [
  "Explora nuestro catálogo, filtra por clasificación",
  "Sigue las nuevas versiones de los juegos disponibles.",
  "Detectamos lo que el navegador permite",
]) {
  assert(
    publicPagesConfig.includes(phrase) &&
      !gamesPage.includes(phrase) &&
      !updatesPage.includes(phrase) &&
      !requirementsPage.includes(phrase),
    `El copy editorial de páginas públicas no debe duplicarse dentro de sus componentes: ${phrase}`
  );
}

assert(
  footer.includes("getPublicSiteConfig") &&
    footer.includes("config.description") &&
    footer.includes("config.footerTagline") &&
    !footer.includes("Hecho para encontrar tu próximo juego."),
  "El Footer debe reutilizar identidad y lema publicados en vez de mantener copy de marca fijo."
);

if (failures.length > 0) {
  console.error("\nFronteras editoriales del frontend: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Fronteras editoriales del frontend: OK (contenido administrable centralizado; UI técnica y comportamiento permanecen en código)."
  );
}
