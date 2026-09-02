import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";

const CERT_DIRECTORY = path.resolve(
  ".deuna-local-certs"
);
const CA_CERT = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan-ca.pem"
);
const SERVER_KEY = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan.key"
);
const SERVER_CERT = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan.pem"
);
const YOUTUBE_POT_ROOT = path.resolve(".deuna-local-tools", "youtube-pot");
const YOUTUBE_POT_PLUGIN_DIRECTORY = path.join(YOUTUBE_POT_ROOT, "yt-dlp-plugins");
const YOUTUBE_POT_PLUGIN_FILE = path.join(YOUTUBE_POT_PLUGIN_DIRECTORY, "bgutil-ytdlp-pot-provider.zip");
const YOUTUBE_POT_PROVIDER_URL = "http://127.0.0.1:4416";
const YOUTUBE_POT_CONTAINER = "deuna-youtube-pot-provider";

const virtualInterfacePattern =
  /(?:vEthernet|WSL|Docker|Hyper-V|VirtualBox|VMware|Tailscale|ZeroTier|Hamachi|Loopback|Npcap|Bluetooth)/i;

function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);

  if (
    octets.length !== 4 ||
    octets.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255
    )
  ) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (
    octets[0] === 192 &&
    octets[1] === 168
  ) {
    return true;
  }

  return (
    octets[0] === 172 &&
    octets[1] >= 16 &&
    octets[1] <= 31
  );
}

function readWindowsLanIp() {
  const script = String.raw`
$items = Get-NetIPConfiguration | Where-Object {
  $_.NetAdapter.Status -eq 'Up' -and
  $_.IPv4Address -and
  $_.IPv4DefaultGateway -and
  $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Hyper-V|VirtualBox|VMware|Tailscale|ZeroTier|Hamachi|Loopback|Npcap|Bluetooth'
} | ForEach-Object {
  $ipv4 = $_.IPv4Address | Select-Object -First 1
  if ($ipv4) { $ipv4.IPAddress }
}
$items | Select-Object -First 1
`;

  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 6000,
    }
  );

  if (result.error || result.status !== 0) {
    return null;
  }

  const address = result.stdout
    .trim()
    .split(/\s+/)[0];

  return address && isPrivateIpv4(address)
    ? address
    : null;
}

function readNodeLanIp() {
  const candidates = [];

  for (const [name, entries] of Object.entries(
    os.networkInterfaces()
  )) {
    for (const entry of entries ?? []) {
      if (
        entry.family !== "IPv4" ||
        entry.internal ||
        !isPrivateIpv4(entry.address)
      ) {
        continue;
      }

      candidates.push({
        name,
        address: entry.address,
        virtual: virtualInterfacePattern.test(name),
      });
    }
  }

  candidates.sort((a, b) =>
    Number(a.virtual) - Number(b.virtual)
  );

  return candidates[0]?.address ?? null;
}

function resolveLanHost() {
  const configured =
    process.env.DEUNA_LAN_HOST?.trim();

  if (configured) {
    if (!isPrivateIpv4(configured)) {
      throw new Error(
        "DEUNA_LAN_HOST debe ser una IPv4 privada de la red local."
      );
    }

    return configured;
  }

  return readWindowsLanIp() ?? readNodeLanIp();
}

function resolvePort() {
  const value = Number(process.env.PORT ?? "3000");

  if (
    !Number.isInteger(value) ||
    value < 1024 ||
    value > 65535
  ) {
    throw new Error(
      "PORT debe ser un puerto TCP válido entre 1024 y 65535."
    );
  }

  return value;
}

function certificateSupportsHost(host) {
  const result = spawnSync(
    "openssl",
    [
      "x509",
      "-in",
      SERVER_CERT,
      "-noout",
      "-ext",
      "subjectAltName",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (result.error || result.status !== 0) {
    return false;
  }

  return result.stdout.includes(
    `IP Address:${host}`
  );
}

async function youtubePotProviderReady() {
  try {
    const response = await fetch(`${YOUTUBE_POT_PROVIDER_URL}/`, {
      signal: AbortSignal.timeout(1_500),
      headers: { "User-Agent": "DeUnaGames-YouTubePOT-Health/1.0" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveYoutubePotProvider() {
  if (!existsSync(YOUTUBE_POT_PLUGIN_FILE)) return false;
  if (await youtubePotProviderReady()) return true;

  const start = spawnSync("docker", ["start", YOUTUBE_POT_CONTAINER], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 8_000,
  });
  if (start.error || start.status !== 0) return false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (await youtubePotProviderReady()) return true;
  }
  return false;
}

let lanHost;
let port;

try {
  lanHost = resolveLanHost();
  port = resolvePort();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo preparar HTTPS LAN."
  );
  process.exit(1);
}

if (!lanHost) {
  console.error(
    "No encontré una IPv4 privada utilizable para HTTPS LAN."
  );
  process.exit(1);
}

for (const file of [
  CA_CERT,
  SERVER_KEY,
  SERVER_CERT,
]) {
  if (!existsSync(file)) {
    console.error(
      "Faltan los certificados HTTPS LAN."
    );
    console.error(
      "Ejecuta primero: npm run mobile:secure:setup"
    );
    process.exit(1);
  }
}

if (!certificateSupportsHost(lanHost)) {
  console.error(
    `El certificado actual no contiene la IP ${lanHost}.`
  );
  console.error(
    "La IP de tu red pudo haber cambiado. Ejecuta nuevamente: npm run mobile:secure:setup"
  );
  process.exit(1);
}

const origin = `https://${lanHost}:${port}`;
const youtubePotReady = await resolveYoutubePotProvider();

console.log("\nDeUna Games - modo LAN HTTPS\n");
console.log(`Sitio seguro: ${origin}`);
console.log(`Admin LAN seguro: ${origin}/admin`);
console.log(
  "PostgreSQL continúa sólo en localhost; no se publica en la red."
);
if (youtubePotReady) {
  console.log("YouTube Proof-of-Origin: PO Token Provider local listo (mweb queda disponible como último fallback)." );
} else {
  console.log("YouTube Proof-of-Origin: no configurado. Para Shorts/SABR protegidos ejecuta: npm run media:youtube:setup");
}
console.log(
  "La otra PC debe confiar la CA local generada por mobile:secure:setup para obtener un contexto HTTPS válido.\n"
);

const child = spawn(
  process.execPath,
  [
    "./tools/run-next.mjs",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    String(port),
    "--experimental-https",
    "--experimental-https-key",
    SERVER_KEY,
    "--experimental-https-cert",
    SERVER_CERT,
    "--experimental-https-ca",
    CA_CERT,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DEUNA_LAN_MODE: "1",
      DEUNA_LAN_SECURE_MODE: "1",
      DEUNA_LAN_HOST: lanHost,
      DEUNA_LAN_ORIGIN: origin,
      NEXT_PUBLIC_SITE_URL: origin,
      DEUNA_ADMIN_ENABLED: "true",
      DEUNA_ADMIN_ORIGIN: origin,
      NEXT_TELEMETRY_DISABLED: "1",
      ...(youtubePotReady ? {
        DEUNA_YTDLP_PLUGIN_DIR: YOUTUBE_POT_PLUGIN_DIRECTORY,
        DEUNA_YTDLP_POT_PROVIDER_URL: YOUTUBE_POT_PROVIDER_URL,
      } : {}),
    },
  }
);

child.once("error", () => {
  console.error(
    "No se pudo iniciar Next.js en modo HTTPS LAN."
  );
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
