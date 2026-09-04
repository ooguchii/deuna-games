import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");

async function walk(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, extensions)));
      continue;
    }
    if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templateVariablePattern(template) {
  const parts = template.split(/\$\{[^}]+\}/g).map(escapeRegExp);
  return new RegExp(`^${parts.join("[a-zA-Z0-9_-]+")}$`);
}

const cssFiles = await walk(sourceRoot, [".css"]);
const scriptFiles = await walk(sourceRoot, [".ts", ".tsx", ".js", ".jsx"]);

const definitions = new Map();
const runtimeDefinitions = new Map();
const runtimeDefinitionPatterns = [];
const usages = [];
const selfReferences = [];

function registerDefinition(map, variable, file) {
  if (!map.has(variable)) map.set(variable, []);
  map.get(variable).push(relative(file));
}

for (const file of cssFiles) {
  const content = await readFile(file, "utf8");
  const declarationPattern = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g;

  for (const match of content.matchAll(declarationPattern)) {
    const [, variable, value] = match;
    registerDefinition(definitions, variable, file);

    const selfPattern = new RegExp(`var\\(\\s*${escapeRegExp(variable)}(?:\\s*[,\\)])`);
    if (selfPattern.test(value)) {
      selfReferences.push({ file: relative(file), variable });
    }
  }

  const usagePattern = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
  for (const match of content.matchAll(usagePattern)) {
    usages.push({ file: relative(file), variable: match[1] });
  }
}

for (const file of scriptFiles) {
  const content = await readFile(file, "utf8");

  // React permite inyectar custom properties mediante style={{ "--token": value }}.
  // También cubre tipos CSSProperties extendidos que documentan esos tokens.
  const runtimePropertyPattern = /["'](--[a-zA-Z0-9_-]+)["']\s*:/g;
  for (const match of content.matchAll(runtimePropertyPattern)) {
    registerDefinition(runtimeDefinitions, match[1], file);
  }

  // Los renderers pueden construir familias finitas de custom properties dentro
  // de bucles tipados, por ejemplo variables[`--hero-${device}-gap`] = value.
  // Sólo aceptamos templates que comienzan por -- y que son claves asignadas;
  // una mención suelta a un nombre dinámico no cuenta como definición.
  const runtimeTemplateAssignmentPattern = /\[\s*`(--[^`]+\$\{[^`]+)`\s*\]\s*=/g;
  for (const match of content.matchAll(runtimeTemplateAssignmentPattern)) {
    runtimeDefinitionPatterns.push({
      file: relative(file),
      template: match[1],
      pattern: templateVariablePattern(match[1]),
    });
  }
}

function hasRuntimeTemplateDefinition(variable) {
  return runtimeDefinitionPatterns.some(({ pattern }) => pattern.test(variable));
}

const undefinedUsages = [];
const seenUndefined = new Set();

for (const usage of usages) {
  if (
    definitions.has(usage.variable) ||
    runtimeDefinitions.has(usage.variable) ||
    hasRuntimeTemplateDefinition(usage.variable)
  ) {
    continue;
  }

  const key = `${usage.file}:${usage.variable}`;
  if (!seenUndefined.has(key)) {
    seenUndefined.add(key);
    undefinedUsages.push(usage);
  }
}

if (selfReferences.length > 0) {
  console.error("\nVariables CSS autorreferenciadas:\n");
  for (const item of selfReferences) {
    console.error(`- ${item.variable}  <-  ${item.file}`);
  }
}

if (undefinedUsages.length > 0) {
  console.error("\nVariables CSS usadas pero no definidas:\n");
  for (const item of undefinedUsages) {
    console.error(`- ${item.variable}  <-  ${item.file}`);
  }
}

if (selfReferences.length > 0 || undefinedUsages.length > 0) {
  console.error("\nCorregí las variables CSS antes de integrar el cambio.\n");
  process.exit(1);
}

console.log(
  `CSS vars: OK (${cssFiles.length} CSS, ${definitions.size} variables CSS, ${runtimeDefinitions.size} variables runtime, ${runtimeDefinitionPatterns.length} familias runtime).`
);
