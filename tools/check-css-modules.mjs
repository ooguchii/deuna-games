import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");

async function walk(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function parseCssClasses(content) {
  const cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/url\([^)]*\)/g, "")
    .replace(/:global\([^)]*\)/g, "");
  const classes = new Set();
  const pattern = /\.([_a-zA-Z][_a-zA-Z0-9-]*)/g;

  for (const match of cleaned.matchAll(pattern)) {
    classes.add(match[1]);
  }

  return classes;
}

function resolveCssModule(filePath, specifier) {
  if (specifier.startsWith("@/")) {
    return path.resolve(sourceRoot, specifier.slice(2));
  }

  return path.resolve(path.dirname(filePath), specifier);
}

function importInfo(source, filePath) {
  const imports = [];

  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.endsWith(".module.css") ||
      !statement.importClause?.name
    ) {
      continue;
    }

    imports.push({
      identifier: statement.importClause.name.text,
      cssFile: resolveCssModule(
        filePath,
        statement.moduleSpecifier.text
      ),
    });
  }

  return imports;
}

function collectUsage(source, identifier) {
  const used = new Set();
  let dynamic = false;

  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === identifier
    ) {
      used.add(node.name.text);
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === identifier
    ) {
      const argument = node.argumentExpression;

      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        used.add(argument.text);
      } else {
        dynamic = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return { used, dynamic };
}

const allFiles = await walk(sourceRoot);
const sourceFiles = allFiles.filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));
const cssModuleFiles = allFiles.filter((file) => file.endsWith(".module.css"));
const cssModuleSet = new Set(cssModuleFiles);
const cssCache = new Map();
const moduleUsage = new Map();
const issues = [];
let checkedImports = 0;

async function classesFor(cssFile) {
  if (!cssCache.has(cssFile)) {
    const content = await readFile(cssFile, "utf8");
    cssCache.set(cssFile, parseCssClasses(content));
  }

  return cssCache.get(cssFile);
}

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") || file.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  for (const entry of importInfo(source, file)) {
    checkedImports += 1;

    if (!cssModuleSet.has(entry.cssFile)) {
      issues.push(
        `${relative(file)}: importa CSS Module inexistente ${relative(entry.cssFile)}`
      );
      continue;
    }

    const defined = await classesFor(entry.cssFile);
    const usage = collectUsage(source, entry.identifier);

    for (const className of usage.used) {
      if (!defined.has(className)) {
        issues.push(
          `${relative(file)}: usa ${entry.identifier}.${className}, pero no existe en ${relative(entry.cssFile)}`
        );
      }
    }

    const aggregate = moduleUsage.get(entry.cssFile) ?? {
      used: new Set(),
      dynamic: false,
      importers: new Set(),
    };

    for (const className of usage.used) {
      aggregate.used.add(className);
    }

    aggregate.dynamic ||= usage.dynamic;
    aggregate.importers.add(relative(file));
    moduleUsage.set(entry.cssFile, aggregate);
  }
}

let dynamicModules = 0;

for (const cssFile of cssModuleFiles) {
  const aggregate = moduleUsage.get(cssFile);

  if (!aggregate) {
    issues.push(
      `${relative(cssFile)}: CSS Module sin importador en src/`
    );
    continue;
  }

  if (aggregate.dynamic) {
    dynamicModules += 1;
    continue;
  }

  const defined = await classesFor(cssFile);

  for (const className of defined) {
    if (!aggregate.used.has(className)) {
      issues.push(
        `${relative(cssFile)}: .${className} está declarada pero no se usa en sus importadores`
      );
    }
  }
}

if (issues.length > 0) {
  console.error("\nIntegridad de CSS Modules: ERROR\n");

  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  console.error(
    "\nCorregí clases inexistentes o CSS huérfano antes de integrar.\n"
  );
  process.exit(1);
}

console.log(
  `CSS Modules: OK (${cssModuleFiles.length} módulos, ${checkedImports} imports; ${dynamicModules} módulos con acceso dinámico).`
);
