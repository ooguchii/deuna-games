import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);

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

    if (
      entry.isFile() &&
      sourceExtensions.has(path.extname(entry.name))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function lineOf(source, position) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function literalText(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  return null;
}

function inspectAst(file, content, issues) {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") || file.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  function report(node, message) {
    issues.push({
      file: relative(file),
      line: lineOf(source, node.getStart(source)),
      message,
    });
  }

  function visit(node) {
    if (node.kind === ts.SyntaxKind.DebuggerStatement) {
      report(node, "debugger no debe quedar en código de producción");
    }

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      report(node, "evitá tipos any explícitos en src/");
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "console" &&
      ["log", "debug", "trace"].includes(node.expression.name.text)
    ) {
      report(
        node,
        `console.${node.expression.name.text} parece un log de depuración`
      );
    }

    if (ts.isJsxAttribute(node) && node.name.text === "href") {
      let value = null;

      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        value = node.initializer.text;
      } else if (
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        value = literalText(node.initializer.expression);
      }

      if (value === "#") {
        report(node, 'href="#" es un enlace placeholder');
      }

      if (
        typeof value === "string" &&
        /^javascript:/i.test(value.trim())
      ) {
        report(node, "javascript: no es un destino permitido");
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

const files = await walk(sourceRoot);
const issues = [];

const forbiddenTextPatterns = [
  {
    regex: /@ts-(?:ignore|nocheck)\b/g,
    message: "supresión TypeScript encontrada",
  },
  {
    regex: /eslint-disable(?:-next-line|-line)?\b/g,
    message: "supresión ESLint encontrada",
  },
  {
    regex: /\b(?:TODO|FIXME|HACK)\b/g,
    message: "marcador de trabajo pendiente encontrado",
  },
];

for (const file of files) {
  const content = await readFile(file, "utf8");
  inspectAst(file, content, issues);

  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    for (const entry of forbiddenTextPatterns) {
      entry.regex.lastIndex = 0;

      if (entry.regex.test(line)) {
        issues.push({
          file: relative(file),
          line: index + 1,
          message: entry.message,
        });
      }
    }
  }
}

if (issues.length > 0) {
  console.error("\nHigiene de código fuente: ERROR\n");

  for (const issue of issues) {
    console.error(
      `- ${issue.file}:${issue.line} — ${issue.message}`
    );
  }

  console.error(
    "\nRetira restos de depuración, placeholders o supresiones antes de integrar.\n"
  );
  process.exit(1);
}

console.log(
  `Source hygiene: OK (${files.length} archivos fuente revisados).`
);
