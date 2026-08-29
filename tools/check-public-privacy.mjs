import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const roots = [
  path.join(root, "src"),
  path.join(root, "public"),
  path.join(root, "ops"),
  path.join(root, "tools"),
];

const rootFiles = [
  "README.md",
  ".env.example",
  "next.config.ts",
].map((file) => path.join(root, file));

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const forbidden = [
  {
    label: "referencia geográfica explícita",
    pattern: /\bArgentina\b|Buenos[_\s]Aires|America\/Argentina/giu,
  },
  {
    label: "locale regional",
    pattern: /\bes[-_]AR\b/giu,
  },
  {
    label: "timestamp con offset geográfico",
    pattern:
      /T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?[+-]\d{2}:\d{2}\b/g,
  },
  {
    label: "publishedAt sin UTC explícito",
    pattern:
      /\bpublishedAt\s*:\s*["']\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?["']/g,
  },
  {
    label: "ruta personal de Windows",
    pattern: /[A-Za-z]:\\Users\\[^\\\s]+/g,
  },
  {
    label: "ruta personal de macOS",
    pattern: /\/Users\/[^/\s]+/g,
  },
  {
    label: "correo personal de proveedor público",
    pattern:
      /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.[A-Z]{2,}/giu,
  },
  {
    label: "coordenadas o ubicación estructurada",
    pattern:
      /\b(?:addressLocality|addressRegion|postalCode|latitude|longitude)\b/g,
  },
  {
    label: "servicio de tracking externo",
    pattern:
      /(?:google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|hotjar\.com|posthog\.com|segment\.io)/giu,
  },
];

const regionalCopyPatterns = [
  {
    label: "voseo o imperativo regional en contenido público",
    pattern:
      /(?<![\p{L}\p{N}_])(?:vos|encontrá|consultá|explorá|seguí|compará|combiná|usá|usás|elegí|buscá|buscás|descubrí|accedé|revisá|mirá|probá|conocé|aprendé|volvé|hacé|andá|vení|poné|sacá|dejá|agregá|quitá|cambiá|configurá|ejecutá|corregí|retirá|eliminá|subí|bajá|abrí|cerrá|guardá|conectá|desactivá|comprobá|mantenete|detenelo|arrancalo|podés|tenés|querés|sabés|sos|decís|venís|hacés)(?![\p{L}\p{N}_])/giu,
  },
];

async function walk(directory) {
  let entries;

  try {
    entries = await readdir(directory, {
      withFileTypes: true,
    });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (
      entry.isFile() &&
      textExtensions.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function lineForOffset(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

const files = [
  ...(await Promise.all(roots.map(walk))).flat(),
  ...rootFiles,
];

const uniqueFiles = [...new Set(files)];
const issues = [];
const regionalCopyExemptions = new Set([
  "tools/check-public-privacy.mjs",
]);

for (const file of uniqueFiles) {
  let content;

  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }

  const fileRelative = relative(file);

  for (const rule of forbidden) {
    if (fileRelative.startsWith("tools/")) {
      continue;
    }

    rule.pattern.lastIndex = 0;

    for (const match of content.matchAll(rule.pattern)) {
      issues.push(
        `${fileRelative}:${lineForOffset(content, match.index ?? 0)} — ${rule.label}: ${JSON.stringify(match[0])}`
      );
    }
  }

  if (!regionalCopyExemptions.has(fileRelative)) {
    for (const rule of regionalCopyPatterns) {
      rule.pattern.lastIndex = 0;

      for (const match of content.matchAll(rule.pattern)) {
        issues.push(
          `${fileRelative}:${lineForOffset(content, match.index ?? 0)} — ${rule.label}: ${JSON.stringify(match[0])}`
        );
      }
    }
  }
}

if (issues.length > 0) {
  console.error("\nPrivacidad pública: ERROR\n");

  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  console.error(
    "\nRetira referencias geográficas, regionalismos identificables, rutas personales, correos personales, timestamps ambiguos o tracking antes de integrar.\n"
  );

  process.exit(1);
}

console.log(
  `Privacidad pública: OK (${uniqueFiles.length} archivos revisados; sin ubicación explícita, regionalismos identificables, rutas personales ni tracking conocido).`
);
