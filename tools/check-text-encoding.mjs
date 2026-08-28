import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = [
  path.join(root, "src"),
  path.join(root, "ops"),
];
const rootFiles = [
  path.join(root, "README.md"),
  path.join(root, ".env.example"),
];
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".md",
  ".yml",
  ".yaml",
  ".json",
  ".txt",
  ".example",
]);
const suspicious = /(?:Ã|Â|â[€-™]|ðŸ|�)/;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (
      entry.isFile() &&
      textExtensions.has(path.extname(entry.name))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const files = [];

for (const directory of roots) {
  files.push(...(await walk(directory)));
}

files.push(...rootFiles);

const issues = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (suspicious.test(line)) {
      issues.push({
        file: relative(file),
        line: index + 1,
        preview: line.trim().slice(0, 140),
      });
    }
  }
}

if (issues.length > 0) {
  console.error("\nEncoding de texto: ERROR\n");

  for (const issue of issues) {
    console.error(
      `- ${issue.file}:${issue.line} — ${issue.preview}`
    );
  }

  console.error(
    "\nSe detectaron secuencias compatibles con mojibake o caracteres de reemplazo. Normalizá el texto a UTF-8 antes de integrar.\n"
  );
  process.exit(1);
}

console.log(
  `Encoding: OK (${files.length} archivos de texto revisados en UTF-8).`
);
