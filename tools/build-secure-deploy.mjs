import {
  spawnSync,
} from "node:child_process";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);
const root = path.resolve(
  toolsDirectory,
  ".."
);
const deployRoot = path.join(
  root,
  "deploy"
);

const stageBase =
  process.platform === "win32"
    ? path.resolve(
        `${process.env.SystemDrive || "C:"}${path.sep}`,
        "DeUnaSecureBuild"
      )
    : path.join(
        os.tmpdir(),
        "deuna-secure-build"
      );

const stageRoot = path.join(
  stageBase,
  "app"
);

const requiredStageItems = [
  "src",
  "public",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "next-env.d.ts",
  "tools/smoke-test.mjs",
];

const secretPatterns = [
  {
    name: "clave privada",
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "AWS access key",
    pattern:
      /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "GitHub token",
    pattern:
      /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: "Google API key",
    pattern:
      /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: "DB URL con password",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@/,
  },
];

const privacyPatterns = [
  {
    name: "referencia geográfica explícita",
    pattern:
      /\bArgentina\b|Buenos[_\s]Aires|America\/Argentina/i,
  },
  {
    name: "locale regional",
    pattern:
      /\bes[-_]AR\b/i,
  },
  {
    name: "timestamp con offset geográfico",
    pattern:
      /T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?[+-]\d{2}:\d{2}\b/,
  },
  {
    name: "ruta personal de Windows",
    pattern:
      /[A-Za-z]:\\Users\\[^\\\s]+/,
  },
  {
    name: "ruta personal de macOS",
    pattern:
      /\/Users\/[^/\s]+/,
  },
  {
    name: "correo personal de proveedor público",
    pattern:
      /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.[A-Z]{2,}/i,
  },
];

const reservedProductionHostnames =
  new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "example.com",
    "example.net",
    "example.org",
  ]);

const reservedHostnameSuffixes = [
  ".localhost",
  ".invalid",
  ".test",
  ".example",
];

function fail(message) {
  console.error("");
  console.error(
    `[ERROR] ${message}`
  );
  process.exit(1);
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  if (!(await exists(directory))) {
    return [];
  }

  const entries = await readdir(
    directory,
    {
      withFileTypes: true,
    }
  );

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await walk(fullPath))
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function runNpm(
  args,
  cwd = root
) {
  const result = spawnSync(
    "npm",
    args,
    {
      cwd,
      env: process.env,
      stdio: "inherit",
      shell:
        process.platform ===
        "win32",
    }
  );

  if (result.error) {
    fail(
      `No se pudo ejecutar npm ${args.join(" ")}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    fail(
      `npm ${args.join(" ")} falló con código ${result.status}.`
    );
  }
}

function isReservedProductionHostname(
  hostname
) {
  if (
    reservedProductionHostnames.has(
      hostname
    )
  ) {
    return true;
  }

  return reservedHostnameSuffixes.some(
    (suffix) =>
      hostname.endsWith(suffix)
  );
}

function validateProductionSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!raw) {
    fail(
      "NEXT_PUBLIC_SITE_URL es obligatorio para build:secure. Configurá el dominio HTTPS real antes de generar un deploy."
    );
  }

  let url;

  try {
    url = new URL(raw);
  } catch {
    fail(
      "NEXT_PUBLIC_SITE_URL debe ser una URL absoluta válida."
    );
  }

  if (url.protocol !== "https:") {
    fail(
      "NEXT_PUBLIC_SITE_URL debe usar HTTPS para un deploy de producción."
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" &&
      url.pathname !== "")
  ) {
    fail(
      "NEXT_PUBLIC_SITE_URL debe contener sólo el origen HTTPS, sin credenciales, ruta, query ni fragmento."
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    isReservedProductionHostname(
      hostname
    )
  ) {
    fail(
      "NEXT_PUBLIC_SITE_URL debe apuntar al dominio público real, no a localhost, loopback ni dominios reservados de ejemplo/prueba."
    );
  }

  return url.origin;
}

async function copyStageItem(
  relativePath
) {
  const source = path.join(
    root,
    relativePath
  );
  const destination = path.join(
    stageRoot,
    relativePath
  );

  if (!(await exists(source))) {
    fail(
      `Falta archivo/carpeta requerido: ${relativePath}`
    );
  }

  await mkdir(
    path.dirname(destination),
    {
      recursive: true,
    }
  );

  await cp(
    source,
    destination,
    {
      recursive: true,
      force: true,
    }
  );
}

async function assembleDeploy() {
  const standalone = path.join(
    stageRoot,
    ".next",
    "standalone"
  );
  const staticRoot = path.join(
    stageRoot,
    ".next",
    "static"
  );
  const publicDirectory = path.join(
    stageRoot,
    "public"
  );

  if (!(await exists(standalone))) {
    fail(
      "No se generó .next/standalone. Revisá output: 'standalone' en next.config.ts."
    );
  }

  await rm(
    deployRoot,
    {
      recursive: true,
      force: true,
    }
  );
  await mkdir(
    deployRoot,
    {
      recursive: true,
    }
  );

  await cp(
    standalone,
    deployRoot,
    {
      recursive: true,
      force: true,
    }
  );

  if (await exists(staticRoot)) {
    await cp(
      staticRoot,
      path.join(
        deployRoot,
        ".next",
        "static"
      ),
      {
        recursive: true,
        force: true,
      }
    );
  }

  if (await exists(publicDirectory)) {
    await cp(
      publicDirectory,
      path.join(
        deployRoot,
        "public"
      ),
      {
        recursive: true,
        force: true,
      }
    );
  }
}

async function auditDeploy() {
  const files = await walk(
    deployRoot
  );

  const forbiddenNames = [
    /^\.env(?:\.|$)/i,
    /^PROJECT_CONTEXT/i,
    /^PROJECT_REVIEW/i,
    /^DEBUG_REPORT/i,
  ];

  const forbiddenExtensions =
    new Set([
      ".map",
      ".pem",
      ".key",
      ".p12",
      ".pfx",
      ".kdbx",
    ]);

  const exactSensitiveValues = [
    root,
    process.env.USERPROFILE,
    process.env.HOME,
  ].filter(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  const textExtensions =
    new Set([
      ".js",
      ".json",
      ".html",
      ".css",
      ".xml",
    ]);

  for (const file of files) {
    const name = path.basename(file);
    const extension =
      path.extname(file).toLowerCase();

    if (
      forbiddenNames.some(
        (pattern) =>
          pattern.test(name)
      ) ||
      forbiddenExtensions.has(
        extension
      )
    ) {
      fail(
        `Archivo prohibido detectado en deploy/: ${path.relative(deployRoot, file)}`
      );
    }

    const info = await stat(file);

    if (
      info.size >
      12 * 1024 * 1024 ||
      !textExtensions.has(
        extension
      )
    ) {
      continue;
    }

    const content = await readFile(
      file,
      "utf8"
    );

    for (const sensitiveValue of exactSensitiveValues) {
      if (
        content
          .toLowerCase()
          .includes(
            sensitiveValue.toLowerCase()
          )
      ) {
        fail(
          `Dato local real detectado en deploy/: ${path.relative(deployRoot, file)}`
        );
      }
    }

    for (const entry of secretPatterns) {
      if (
        entry.pattern.test(content)
      ) {
        fail(
          `${entry.name} detectado en deploy/: ${path.relative(deployRoot, file)}`
        );
      }
    }

    for (const entry of privacyPatterns) {
      if (
        entry.pattern.test(content)
      ) {
        fail(
          `${entry.name} detectada en deploy/: ${path.relative(deployRoot, file)}`
        );
      }
    }
  }
}

console.log("");
console.log(
  "================================================"
);
console.log(
  " DeUna Games - build seguro y reproducible"
);
console.log(
  "================================================"
);
console.log("");

const productionOrigin =
  validateProductionSiteUrl();

console.log(
  `[OK] URL pública: ${productionOrigin}`
);

console.log(
  "1/8 Limpiando artefactos anteriores..."
);
await rm(
  deployRoot,
  {
    recursive: true,
    force: true,
  }
);
await rm(
  stageBase,
  {
    recursive: true,
    force: true,
  }
);

console.log(
  "2/8 Ejecutando auditoría de seguridad..."
);
runNpm([
  "run",
  "security:scan",
]);

console.log(
  "3/8 Ejecutando controles de calidad y privacidad previos..."
);
for (const script of [
  "lint",
  "typecheck",
  "check:source",
  "check:encoding",
  "check:privacy",
  "check:data",
  "check:assets",
  "check:routes",
  "check:css-vars",
  "check:css-modules",
]) {
  runNpm([
    "run",
    script,
  ]);
}

console.log(
  `4/8 Creando staging neutral en ${stageRoot}...`
);
await mkdir(
  stageRoot,
  {
    recursive: true,
  }
);

for (const item of requiredStageItems) {
  await copyStageItem(item);
}

console.log(
  "5/8 Instalando dependencias reproducibles..."
);
runNpm(
  [
    "ci",
    "--no-audit",
    "--no-fund",
  ],
  stageRoot
);

console.log(
  "6/8 Generando y probando build de producción..."
);
runNpm(
  [
    "run",
    "build",
  ],
  stageRoot
);
runNpm(
  [
    "run",
    "smoke",
  ],
  stageRoot
);

console.log(
  "7/8 Ensamblando y auditando artefacto mínimo..."
);
await assembleDeploy();
await auditDeploy();

console.log(
  "8/8 Limpiando staging temporal..."
);
await rm(
  stageBase,
  {
    recursive: true,
    force: true,
  }
);

console.log("");
console.log(
  "=============================================="
);
console.log(
  " BUILD SEGURO APROBADO"
);
console.log(
  "=============================================="
);
console.log("");
console.log(
  `Artefacto final: ${deployRoot}`
);
console.log(
  "Subí únicamente el contenido de deploy/."
);
