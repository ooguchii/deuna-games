import {
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const scanRoots = [
  path.join(root, "src", "components", "admin"),
  path.join(root, "src", "app", "admin", "(protected)"),
];
const failures = [];

const legacyBrandColors = [
  "#ff9bb3",
  "#e8adb9",
  "#ffd4de",
  "#ffb2c4",
  "#e9b5c1",
  "#e3a4b3",
  "#fff0f4",
  "#e5a4b4",
  "#ffd1dc",
  "#e8a8b8",
  "#d99bad",
  "#e1a4b4",
  "#ff789e",
];

async function collectCssModules(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectCssModules(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".module.css")) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(filePath) {
  return path
    .relative(root, filePath)
    .split(path.sep)
    .join("/");
}

const files = (
  await Promise.all(scanRoots.map(collectCssModules))
).flat();

for (const filePath of files) {
  const css = await readFile(filePath, "utf8");
  const file = relative(filePath);
  const tinyPixelSizes = [
    ...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px\s*;/gi),
  ]
    .map((match) => Number(match[1]))
    .filter((size) => size < 11);

  if (tinyPixelSizes.length > 0) {
    failures.push(
      `${file}: tipografía menor a 11px (${tinyPixelSizes.join(", ")}).`
    );
  }

  const normalized = css.toLowerCase();
  const legacyHits = legacyBrandColors.filter((color) =>
    normalized.includes(color)
  );

  if (legacyHits.length > 0) {
    failures.push(
      `${file}: conserva acentos históricos de identidad (${legacyHits.join(", ")}); usa tokens de marca o un color semántico explícito.`
    );
  }
}

if (failures.length > 0) {
  console.error("\nUI administrativa: REGRESIÓN CSS\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `UI administrativa: OK (${files.length} módulos CSS revisados recursivamente; escala mínima y marca dinámica protegidas).`
  );
}
