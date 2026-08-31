import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const accountDir = path.join(root, "src", "app", "cuenta");

const paths = {
  dashboard: path.join(accountDir, "AccountDashboardClient.tsx"),
  dashboardCss: path.join(accountDir, "account-dashboard.module.css"),
  access: path.join(accountDir, "AccountAccessClient.tsx"),
  accessCss: path.join(accountDir, "account.module.css"),
  page: path.join(accountDir, "page.tsx"),
  header: path.join(root, "src", "components", "layout", "HeaderClient.tsx"),
  siteBrand: path.join(root, "src", "components", "layout", "SiteBrand.tsx"),
};

const legacyPaths = [
  "AccountPersonalizationClient.tsx",
  "AccountProfileClient.tsx",
  "account-personalization.module.css",
  "account-dashboard-polish.module.css",
].map((file) => path.join(accountDir, file));

const errors = [];

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push(`Falta ${path.relative(root, file)}.`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function cssClasses(source) {
  return new Set(
    [...source.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(
      (match) => match[1]
    )
  );
}

function moduleClasses(source) {
  return new Set(
    [...source.matchAll(/\bstyles\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(
      (match) => match[1]
    )
  );
}

function compareClasses(label, cssSource, jsxSources) {
  const defined = cssClasses(cssSource);
  const used = new Set(
    jsxSources.flatMap((source) => [...moduleClasses(source)])
  );

  const orphan = [...defined].filter((name) => !used.has(name)).sort();
  const missing = [...used].filter((name) => !defined.has(name)).sort();

  if (orphan.length) {
    errors.push(`${label}: clases CSS huérfanas: ${orphan.join(", ")}.`);
  }
  if (missing.length) {
    errors.push(`${label}: clases usadas sin CSS: ${missing.join(", ")}.`);
  }
}

for (const legacyPath of legacyPaths) {
  if (fs.existsSync(legacyPath)) {
    errors.push(
      `Debe eliminarse el legado ${path.relative(root, legacyPath)}.`
    );
  }
}

const dashboard = read(paths.dashboard);
const dashboardCss = read(paths.dashboardCss);
const access = read(paths.access);
const accessCss = read(paths.accessCss);
const page = read(paths.page);
const header = read(paths.header);
const siteBrand = read(paths.siteBrand);

compareClasses("Dashboard de cuenta", dashboardCss, [dashboard]);
compareClasses("Acceso de cuenta", accessCss, [access, page]);

const forbiddenDashboardCss = [
  [!/!important/.test(dashboardCss), "!important"],
  [!/:global\(/.test(dashboardCss), ":global(...)"],
  [!/visibility\s*:\s*hidden/i.test(dashboardCss), "visibility: hidden"],
  [!/dashboardChrome|brandOverlay|brandMark/.test(dashboardCss), "clases de parche/overlay"],
];

for (const [ok, label] of forbiddenDashboardCss) {
  if (!ok) errors.push(`Dashboard de cuenta: no se permite ${label}.`);
}

for (const match of dashboardCss.matchAll(/font-size\s*:\s*([0-9.]+)px/gi)) {
  const value = Number(match[1]);
  if (Number.isFinite(value) && value < 12) {
    errors.push(`Dashboard de cuenta: font-size ${value}px es menor al mínimo de 12px.`);
  }
}

for (const match of dashboardCss.matchAll(/font-size\s*:\s*([0-9.]+)rem/gi)) {
  const value = Number(match[1]);
  if (Number.isFinite(value) && value < 0.75) {
    errors.push(`Dashboard de cuenta: font-size ${value}rem es menor al mínimo de 0.75rem.`);
  }
}

if (/account\.module\.css/.test(dashboard)) {
  errors.push("AccountDashboardClient no debe depender del CSS del acceso.");
}
if (/Header\.module\.css/.test(dashboard)) {
  errors.push("AccountDashboardClient no debe importar directamente el CSS del Header.");
}
if (!/SiteBrand/.test(dashboard) || !/SiteBrand/.test(header)) {
  errors.push("Header y dashboard deben compartir SiteBrand como única marca visual.");
}
if (!/Header\.module\.css/.test(siteBrand)) {
  errors.push("SiteBrand debe reutilizar la identidad visual canónica del Header.");
}
if (/polishStyles|headerStyles|dashboardChrome|brandOverlay/.test(page)) {
  errors.push("page.tsx conserva una capa visual de parche del dashboard.");
}
if (/AccountProfileClient|AccountPersonalizationClient/.test(page)) {
  errors.push("page.tsx conserva un componente puente o dashboard legado.");
}
if (!/AccountDashboardClient/.test(page)) {
  errors.push("page.tsx debe montar AccountDashboardClient directamente.");
}
if (/recommendationRail|overflow-x\s*:\s*auto[^}]*recommend/i.test(dashboardCss)) {
  errors.push("El resumen de recomendaciones no debe depender de un carril horizontal con scrollbar.");
}

if (errors.length) {
  console.error("\nEstructura del dashboard de cuenta: ERROR\n");
  for (const error of errors) console.error(`- ${error}`);
  console.error("\nElimina capas, CSS huérfano o dependencias cruzadas antes de integrar.\n");
  process.exit(1);
}

console.log(
  `Dashboard de cuenta: OK (${cssClasses(dashboardCss).size} clases de dashboard y ${cssClasses(accessCss).size} clases de acceso, sin overlays, !important, microtexto ni CSS huérfano).`
);
