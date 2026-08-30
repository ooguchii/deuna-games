import {
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const scanRoots = [
  path.join(root, "src", "app"),
  path.join(root, "src", "components"),
];
const extensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
]);
const failures = [];

function relative(filePath) {
  return path
    .relative(root, filePath)
    .split(path.sep)
    .join("/");
}

function isExcluded(filePath) {
  const name = relative(filePath);

  return (
    name.startsWith("src/app/admin/") ||
    name.startsWith("src/app/api/admin/") ||
    name.startsWith("src/components/admin/")
  );
}

async function collectFiles(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      extensions.has(path.extname(entry.name)) &&
      !isExcluded(fullPath)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const scanRoot of scanRoots) {
  const files = await collectFiles(scanRoot);

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const name = relative(filePath);

    if (content.includes("DeUna Games")) {
      failures.push(
        `${name}: contiene la marca pública escrita de forma fija.`
      );
    }

    if (
      /\bsiteConfig\b/.test(content) &&
      content.includes('from "@/lib/site"')
    ) {
      failures.push(
        `${name}: consume siteConfig fuente directamente; usa getPublicSiteConfig para identidad pública.`
      );
    }
  }
}

if (failures.length > 0) {
  console.error("\nIdentidad pública: BLOQUEADA\n");
  failures.forEach((failure) =>
    console.error(`- ${failure}`)
  );
  process.exitCode = 1;
} else {
  console.log(
    "Identidad pública: OK (sin marca fija ni consumo directo de siteConfig fuente en la UI pública)."
  );
}
