import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const CERT_DIRECTORY = path.resolve(
  ".deuna-local-certs"
);
const CA_KEY = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan-ca.key"
);
const CA_CERT = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan-ca.pem"
);
const CA_CERT_DER = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan-ca.cer"
);
const SERVER_KEY = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan.key"
);
const SERVER_CERT = path.join(
  CERT_DIRECTORY,
  "deuna-games-lan.pem"
);

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

function runOpenSsl(args, options = {}) {
  const result = spawnSync(
    "openssl",
    args,
    {
      stdio: options.capture
        ? ["ignore", "pipe", "pipe"]
        : "inherit",
      encoding: "utf8",
    }
  );

  if (result.error) {
    throw new Error(
      "No se encontró OpenSSL. Ejecuta este comando desde Ubuntu/WSL donde preparaste DeUna Games."
    );
  }

  if (result.status !== 0) {
    const detail = options.capture
      ? result.stderr?.trim()
      : "";
    throw new Error(
      detail ||
        "OpenSSL no pudo completar la preparación HTTPS."
    );
  }

  return options.capture
    ? result.stdout.trim()
    : "";
}

let lanHost;

try {
  lanHost = resolveLanHost();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo detectar la red local."
  );
  process.exit(1);
}

if (!lanHost) {
  console.error(
    "No encontré una IPv4 privada utilizable."
  );
  console.error(
    "Puedes indicarla con DEUNA_LAN_HOST=192.168.x.x npm run mobile:secure:setup"
  );
  process.exit(1);
}

mkdirSync(CERT_DIRECTORY, {
  recursive: true,
  mode: 0o700,
});

const hasCaKey = existsSync(CA_KEY);
const hasCaCert = existsSync(CA_CERT);

if (hasCaKey !== hasCaCert) {
  console.error(
    "La autoridad certificadora local está incompleta. No la regeneré automáticamente para evitar cambiar una CA que quizá ya confiaste en otra PC."
  );
  console.error(
    `Revisa manualmente: ${CERT_DIRECTORY}`
  );
  process.exit(1);
}

try {
  if (!hasCaKey) {
    console.log(
      "\nCreando una autoridad certificadora privada para DeUna Games..."
    );

    runOpenSsl([
      "genrsa",
      "-out",
      CA_KEY,
      "3072",
    ]);
    chmodSync(CA_KEY, 0o600);

    runOpenSsl([
      "req",
      "-x509",
      "-new",
      "-sha256",
      "-days",
      "3650",
      "-key",
      CA_KEY,
      "-out",
      CA_CERT,
      "-subj",
      "/CN=DeUna Games LAN Development CA/O=DeUna Games Local Development",
      "-addext",
      "basicConstraints=critical,CA:TRUE,pathlen:0",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
      "-addext",
      "subjectKeyIdentifier=hash",
    ]);
  } else {
    console.log(
      "\nReutilizando la autoridad certificadora local existente."
    );
  }

  runOpenSsl([
    "x509",
    "-in",
    CA_CERT,
    "-outform",
    "DER",
    "-out",
    CA_CERT_DER,
  ]);

  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), "deuna-lan-cert-")
  );
  const configPath = path.join(
    temporaryDirectory,
    "openssl.cnf"
  );
  const requestPath = path.join(
    temporaryDirectory,
    "server.csr"
  );
  const serialPath = path.join(
    temporaryDirectory,
    "ca.srl"
  );

  try {
    writeFileSync(
      configPath,
      `[req]\n` +
        `prompt = no\n` +
        `distinguished_name = dn\n` +
        `req_extensions = v3_req\n\n` +
        `[dn]\n` +
        `CN = DeUna Games LAN\n` +
        `O = DeUna Games Local Development\n\n` +
        `[v3_req]\n` +
        `basicConstraints = critical,CA:FALSE\n` +
        `keyUsage = critical,digitalSignature,keyEncipherment\n` +
        `extendedKeyUsage = serverAuth\n` +
        `subjectAltName = @alt_names\n\n` +
        `[alt_names]\n` +
        `DNS.1 = localhost\n` +
        `IP.1 = 127.0.0.1\n` +
        `IP.2 = ${lanHost}\n`,
      {
        encoding: "utf8",
        mode: 0o600,
      }
    );

    runOpenSsl([
      "genrsa",
      "-out",
      SERVER_KEY,
      "2048",
    ]);
    chmodSync(SERVER_KEY, 0o600);

    runOpenSsl([
      "req",
      "-new",
      "-sha256",
      "-key",
      SERVER_KEY,
      "-out",
      requestPath,
      "-config",
      configPath,
    ]);

    runOpenSsl([
      "x509",
      "-req",
      "-sha256",
      "-days",
      "397",
      "-in",
      requestPath,
      "-CA",
      CA_CERT,
      "-CAkey",
      CA_KEY,
      "-CAserial",
      serialPath,
      "-CAcreateserial",
      "-out",
      SERVER_CERT,
      "-extfile",
      configPath,
      "-extensions",
      "v3_req",
    ]);
  } finally {
    rmSync(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }

  chmodSync(CA_KEY, 0o600);
  chmodSync(SERVER_KEY, 0o600);
  chmodSync(CA_CERT, 0o644);
  chmodSync(CA_CERT_DER, 0o644);
  chmodSync(SERVER_CERT, 0o644);

  const serverText = runOpenSsl(
    [
      "x509",
      "-in",
      SERVER_CERT,
      "-noout",
      "-ext",
      "subjectAltName",
    ],
    { capture: true }
  );

  if (
    !serverText.includes(
      `IP Address:${lanHost}`
    )
  ) {
    throw new Error(
      "El certificado generado no contiene la IPv4 LAN esperada."
    );
  }

  const fingerprint = runOpenSsl(
    [
      "x509",
      "-in",
      CA_CERT,
      "-noout",
      "-fingerprint",
      "-sha256",
    ],
    { capture: true }
  );

  console.log(
    "\nDeUna Games - HTTPS LAN preparado\n"
  );
  console.log(`IPv4 LAN: ${lanHost}`);
  console.log(
    `CA pública para instalar en la otra PC: ${CA_CERT_DER}`
  );
  console.log(
    `Certificado del servidor: ${SERVER_CERT}`
  );
  console.log(`Huella de la CA: ${fingerprint}`);
  console.log(
    "\nIMPORTANTE: copia únicamente deuna-games-lan-ca.cer a los equipos que controlas."
  );
  console.log(
    "No copies ni compartas deuna-games-lan-ca.key ni deuna-games-lan.key."
  );
  console.log(
    "Después de confiar la CA en la otra PC, inicia el sitio con: npm run mobile:secure\n"
  );
} catch (error) {
  console.error(
    "\nNo se pudo preparar HTTPS LAN."
  );
  console.error(
    error instanceof Error
      ? error.message
      : "Error desconocido."
  );
  process.exit(1);
}
