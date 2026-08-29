import {
  execFileSync,
  spawnSync,
} from "node:child_process";
import {
  access,
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
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
const publicRoot = path.join(
  root,
  "public"
);

const skipNpmAudit =
  process.argv.includes(
    "--skip-npm-audit"
  );

const errors = [];
const warnings = [];

const forbiddenPublicExtensions =
  new Set([
    ".md",
    ".txt",
    ".log",
    ".map",
    ".ps1",
    ".key",
    ".pem",
    ".p12",
    ".pfx",
    ".backup",
    ".dump",
  ]);

const textExtensions =
  new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
    ".scss",
    ".html",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".toml",
    ".xml",
  ]);

const imageExtensions =
  new Set([
    ".webp",
    ".jpg",
    ".jpeg",
    ".png",
  ]);

const criticalPatterns = [
  {
    name: "ruta personal de Windows",
    pattern:
      /[A-Za-z]:\\Users\\[^\\\r\n]+/,
  },
  {
    name: "ruta personal de macOS",
    pattern:
      /\/Users\/[^/\r\n]+\//,
  },
  {
    name: "ruta personal Linux",
    pattern:
      /\/home\/[^/\r\n]+\//,
  },
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
    name:
      "URL de base de datos con password",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@/,
  },
];

const genericSecretPattern =
  /\b(password|passwd|secret|api[_-]?key|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*["'][^"']{8,}["']/i;

const emailPattern =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

function relative(file) {
  return path
    .relative(root, file)
    .split(path.sep)
    .join("/");
}

async function exists(file) {
  try {
    await access(file);
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

function readGitLines(args) {
  try {
    const output = execFileSync(
      "git",
      args,
      {
        cwd: root,
        encoding: "utf8",
        stdio: [
          "ignore",
          "pipe",
          "ignore",
        ],
      }
    ).trim();

    return output
      ? output.split(/\r?\n/)
      : [];
  } catch {
    return [];
  }
}

function addTrackedFileChecks(
  trackedFiles
) {
  for (const tracked of trackedFiles) {
    const normalized =
      tracked.replaceAll("\\", "/");

    if (
      /(^|\/)\.env($|\.)/.test(
        normalized
      ) &&
      normalized !== ".env.example"
    ) {
      errors.push(
        `Archivo .env trackeado por Git: ${tracked}`
      );
    }

    if (
      /(^|\/)(PROJECT_CONTEXT|PROJECT_REVIEW|PROJECT_AUDIT|PROJECT_COLOR_AUDIT|PROJECT_VISUAL_AUDIT|DEBUG_REPORT).*\.md$/.test(
        normalized
      )
    ) {
      errors.push(
        `Reporte local trackeado por Git: ${tracked}`
      );
    }

    if (
      /(^|\/)(DEUNA_ANALISIS_COMPLETO|legacy-archive|theme-recovery-backup-[^/]*|payload)(\/|$)/.test(
        normalized
      )
    ) {
      errors.push(
        `Snapshot, backup o payload local trackeado por Git: ${tracked}`
      );
    }

    if (
      normalized ===
      "src/theme/palette.ts"
    ) {
      errors.push(
        `Theme System V1 no debe volver al código activo: ${tracked}`
      );
    }

    if (
      /(^|\/)(APLICAR-|REPARAR-|RECUPERAR-|LIMPIEZA-SEGURA-|PREPARAR-DEUNA-|FIX-|FORZAR-|LIMPIAR-).*\.ps1$/.test(
        normalized
      )
    ) {
      errors.push(
        `Instalador o reparador temporal trackeado por Git: ${tracked}`
      );
    }

    if (
      /(^|\/)\.(idea|vscode)\//.test(
        normalized
      )
    ) {
      warnings.push(
        `Configuración de IDE trackeada: ${tracked}`
      );
    }

    if (
      /\.(pem|key|p12|pfx|kdbx|crt|cer)$/i.test(
        normalized
      )
    ) {
      errors.push(
        `Archivo criptográfico/credencial trackeado: ${tracked}`
      );
    }

    if (
      /(?:\.backup|\.dump|\.sql\.gz)$/i.test(
        normalized
      ) ||
      /(^|\/)pg_dump[^/]*$/i.test(normalized)
    ) {
      errors.push(
        `Copia de PostgreSQL trackeada por Git: ${tracked}`
      );
    }
  }
}

async function scanPublicLeaks(
  publicFiles
) {
  for (const file of publicFiles) {
    const extension =
      path.extname(file).toLowerCase();
    const name = path.basename(file);

    if (
      forbiddenPublicExtensions.has(
        extension
      ) ||
      name.startsWith(".env")
    ) {
      errors.push(
        `Archivo que no debe estar en public/: ${relative(file)}`
      );
    }
  }
}

async function scanTextFiles(
  publicFiles
) {
  const sourceFiles = await walk(
    path.join(root, "src")
  );

  const candidates = [
    ...sourceFiles,
    ...publicFiles,
  ].filter((file) =>
    textExtensions.has(
      path.extname(file).toLowerCase()
    )
  );

  for (const name of [
    "next.config.ts",
    "package.json",
    ".env.example",
  ]) {
    const file = path.join(
      root,
      name
    );

    if (await exists(file)) {
      candidates.push(file);
    }
  }

  for (const file of candidates) {
    try {
      const info = await stat(file);

      if (
        info.size >
        5 * 1024 * 1024
      ) {
        continue;
      }

      const content = await readFile(
        file,
        "utf8"
      );
      const fileName = relative(file);

      for (const entry of criticalPatterns) {
        if (
          entry.pattern.test(content)
        ) {
          errors.push(
            `${entry.name} detectado en ${fileName}`
          );
        }
      }

      if (
        genericSecretPattern.test(
          content
        )
      ) {
        errors.push(
          `Posible secreto hardcodeado en ${fileName}`
        );
      }

      if (emailPattern.test(content)) {
        warnings.push(
          `Dirección de email encontrada en ${fileName}. Confirmá que sea pública/intencional.`
        );
      }
    } catch {
      warnings.push(
        `No se pudo analizar ${relative(file)}`
      );
    }
  }
}

async function scanImages(
  publicFiles
) {
  for (const file of publicFiles) {
    const extension =
      path.extname(file).toLowerCase();

    if (
      !imageExtensions.has(extension)
    ) {
      continue;
    }

    try {
      const info = await stat(file);

      if (
        info.size >
        25 * 1024 * 1024
      ) {
        continue;
      }

      const bytes = await readFile(file);
      const ascii =
        bytes.toString("latin1");
      const fileName = relative(file);

      if (
        /[A-Za-z]:\\Users\\/.test(
          ascii
        ) ||
        /\/Users\//.test(ascii) ||
        /\/home\//.test(ascii)
      ) {
        errors.push(
          `Ruta local embebida dentro de imagen: ${fileName}`
        );
      }

      if (
        /EXIF/i.test(ascii) ||
        /xmpmeta/i.test(ascii)
      ) {
        warnings.push(
          `La imagen podría contener EXIF/XMP: ${fileName}`
        );
      }
    } catch {
      warnings.push(
        `No se pudo inspeccionar binario: ${relative(file)}`
      );
    }
  }
}

function checkGitIdentity() {
  const name = readGitLines([
    "config",
    "user.name",
  ])[0];
  const email = readGitLines([
    "config",
    "user.email",
  ])[0];

  if (name || email) {
    warnings.push(
      "Git tiene identidad configurada. Si el repositorio se hace público, revisa autor/email del historial antes de publicarlo."
    );
  }
}

function runNpmAudit() {
  if (skipNpmAudit) {
    return;
  }

  console.log(
    "Ejecutando npm audit de dependencias de producción..."
  );

  const result = spawnSync(
    process.platform === "win32"
      ? "npm.cmd"
      : "npm",
    [
      "audit",
      "--omit=dev",
      "--audit-level=high",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
      shell:
        process.platform ===
        "win32",
    }
  );

  if (result.error) {
    errors.push(
      "No se pudo ejecutar npm audit."
    );
    return;
  }

  if (result.status !== 0) {
    errors.push(
      "npm audit detectó vulnerabilidades HIGH/CRITICAL o no pudo completar correctamente."
    );
  }
}

console.log("");
console.log(
  "=============================================="
);
console.log(
  " DeUna Games - auditoría de seguridad"
);
console.log(
  "=============================================="
);
console.log("");

const publicFiles = await walk(
  publicRoot
);

await scanPublicLeaks(publicFiles);

const trackedFiles = readGitLines([
  "ls-files",
]);

if (trackedFiles.length === 0) {
  warnings.push(
    "No se pudo consultar git ls-files o el repositorio no tiene archivos trackeados."
  );
} else {
  addTrackedFileChecks(
    trackedFiles
  );
}

await scanTextFiles(publicFiles);
await scanImages(publicFiles);
checkGitIdentity();
runNpmAudit();

console.log("");

for (const warning of warnings) {
  console.warn(
    `[AVISO] ${warning}`
  );
}

for (const error of errors) {
  console.error(
    `[ERROR] ${error}`
  );
}

console.log("");

if (errors.length > 0) {
  console.error(
    "AUDITORÍA: NO APROBADA"
  );
  console.error(
    "Corrige los ERROR antes de publicar."
  );
  process.exit(1);
}

console.log(
  "AUDITORÍA: APROBADA"
);
console.log(
  "No se encontraron bloqueadores en el código público."
);
