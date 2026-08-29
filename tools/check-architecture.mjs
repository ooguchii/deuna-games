import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
const appEntryNames = new Set(["page", "layout", "template", "loading", "error", "global-error", "not-found", "default", "route", "manifest", "robots", "sitemap", "opengraph-image", "twitter-image"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function isSourceFile(file) {
  return sourceExtensions.includes(path.extname(file));
}

function isAppEntry(file) {
  const relativeToApp = path.relative(path.join(sourceRoot, "app"), file);
  if (relativeToApp.startsWith("..") || path.isAbsolute(relativeToApp)) return false;
  return appEntryNames.has(path.basename(file, path.extname(file)));
}

function collectSpecifiers(source) {
  const values = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      values.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values;
}

function resolveInternalImport(fromFile, specifier, sourceFileSet) {
  let basePath;
  if (specifier.startsWith("@/")) basePath = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) basePath = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [basePath];
  for (const extension of sourceExtensions) candidates.push(`${basePath}${extension}`);
  for (const extension of sourceExtensions) candidates.push(path.join(basePath, `index${extension}`));
  return candidates.find((candidate) => sourceFileSet.has(candidate)) ?? null;
}

const allFiles = await walk(sourceRoot);
const sourceFiles = allFiles.filter(isSourceFile).filter((file) => !file.endsWith(".d.ts"));
const sourceFileSet = new Set(sourceFiles);
const graph = new Map();
const issues = [];

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const dependencies = new Set();

  for (const specifier of collectSpecifiers(source)) {
    const resolved = resolveInternalImport(file, specifier, sourceFileSet);
    if (resolved) dependencies.add(resolved);
    else if ((specifier.startsWith("@/") || specifier.startsWith(".")) && !/\.(?:css|scss|sass|less|json|svg|png|jpe?g|webp|avif|gif)$/i.test(specifier)) {
      issues.push(`${relative(file)}: import interno no resoluble "${specifier}"`);
    }
  }

  graph.set(file, dependencies);
}

const roots = sourceFiles.filter(isAppEntry);
const reachable = new Set();
const pending = [...roots];
while (pending.length) {
  const current = pending.pop();
  if (!current || reachable.has(current)) continue;
  reachable.add(current);
  for (const dependency of graph.get(current) ?? []) if (!reachable.has(dependency)) pending.push(dependency);
}

for (const file of sourceFiles) if (!reachable.has(file)) issues.push(`${relative(file)}: archivo de código no alcanzable desde ninguna entrada de App Router`);

if (issues.length) {
  console.error("\nArquitectura de código: ERROR\n");
  for (const issue of issues) console.error(`- ${issue}`);
  console.error("\nEliminá código huérfano o conectalo explícitamente antes de integrar.\n");
  process.exit(1);
}

console.log(`Arquitectura: OK (${sourceFiles.length} archivos de código, ${roots.length} entradas App Router, 0 huérfanos).`);
