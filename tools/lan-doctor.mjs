import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import process from "node:process";

const port = Number(process.env.PORT || 3000);
const virtualInterfacePattern =
  /(?:vEthernet|WSL|Docker|Hyper-V|VirtualBox|VMware|Tailscale|ZeroTier|Hamachi|Loopback|Npcap|Bluetooth)/i;

function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

function isApipa(address) {
  return address.startsWith("169.254.");
}

function getNodeInterfaces() {
  const results = [];

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;

      results.push({
        name,
        index: null,
        address: entry.address,
        prefixLength: entry.cidr?.includes("/")
          ? Number(entry.cidr.split("/")[1])
          : null,
        gateway: null,
        category: null,
      });
    }
  }

  return results;
}

function getWindowsInterfaces() {
  if (process.platform !== "win32") return [];

  const script = String.raw`
$items = Get-NetIPConfiguration | Where-Object {
  $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address
} | ForEach-Object {
  $profile = Get-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue | Select-Object -First 1
  $ipv4 = $_.IPv4Address | Select-Object -First 1
  $gateway = $_.IPv4DefaultGateway | Select-Object -First 1
  [PSCustomObject]@{
    name = $_.InterfaceAlias
    index = $_.InterfaceIndex
    address = $ipv4.IPAddress
    prefixLength = $ipv4.PrefixLength
    gateway = if ($gateway) { $gateway.NextHop } else { $null }
    category = if ($profile) { [string]$profile.NetworkCategory } else { $null }
  }
}
@($items) | ConvertTo-Json -Compress
`;

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    }
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function mergeInterfaces(primary, fallback) {
  const byAddress = new Map();

  for (const item of fallback) {
    byAddress.set(item.address, item);
  }

  for (const item of primary) {
    byAddress.set(item.address, {
      ...(byAddress.get(item.address) ?? {}),
      ...item,
    });
  }

  return [...byAddress.values()];
}

function scoreInterface(item) {
  let score = 0;

  if (isPrivateIpv4(item.address)) score += 50;
  if (item.gateway) score += 35;
  if (item.category === "Private") score += 20;
  if (item.category === "Public") score -= 5;
  if (!virtualInterfacePattern.test(item.name)) score += 15;
  if (virtualInterfacePattern.test(item.name)) score -= 100;
  if (isApipa(item.address)) score -= 100;

  return score;
}

function checkTcp(host, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const interfaces = mergeInterfaces(
  getWindowsInterfaces(),
  getNodeInterfaces()
)
  .filter((item) => item.address)
  .sort((a, b) => scoreInterface(b) - scoreInterface(a));

const candidates = interfaces.filter(
  (item) =>
    isPrivateIpv4(item.address) &&
    !virtualInterfacePattern.test(item.name) &&
    !isApipa(item.address)
);

const recommended = candidates[0] ?? interfaces[0] ?? null;
const localhostListening = await checkTcp("127.0.0.1");
const lanListening = recommended
  ? await checkTcp(recommended.address)
  : false;

console.log("\nDeUna Games - diagnóstico de red local\n");
console.log(`Puerto: ${port}`);
console.log("Binding esperado: 0.0.0.0 (todas las interfaces)\n");

if (!recommended) {
  console.log("No encontré una IPv4 utilizable.");
  console.log("Conectá la PC por Wi-Fi/Ethernet y ejecutá nuevamente npm.cmd run lan:doctor.\n");
  process.exit(0);
}

console.log("Conexión recomendada:");
console.log(`- Adaptador: ${recommended.name}`);
console.log(`- IPv4: ${recommended.address}${recommended.prefixLength ? `/${recommended.prefixLength}` : ""}`);
console.log(`- Gateway: ${recommended.gateway ?? "no detectado"}`);
console.log(`- Perfil de Windows: ${recommended.category ?? "no detectado"}`);
console.log(`- URL para OTRA PC: http://${recommended.address}:${port}\n`);

console.log("Estado del servidor:");
console.log(`- localhost:${port}: ${localhostListening ? "RESPONDE" : "NO RESPONDE"}`);
console.log(`- ${recommended.address}:${port}: ${lanListening ? "RESPONDE" : "NO RESPONDE"}\n`);

if (!localhostListening) {
  console.log("El servidor no parece estar iniciado. En otra PowerShell ejecutá:");
  console.log("  npm.cmd run lan\n");
} else if (!lanListening) {
  console.log("El servidor responde sólo localmente o el firewall está interfiriendo.");
  console.log("Confirmá que lo arrancaste con npm.cmd run lan.\n");
}

if (recommended.category === "Public") {
  console.log("ATENCIÓN: esta conexión está marcada como PÚBLICA en Windows.");
  console.log("Para una red doméstica confiable conviene usar perfil Private.");
  if (recommended.index) {
    console.log("PowerShell como administrador:");
    console.log(`  Set-NetConnectionProfile -InterfaceIndex ${recommended.index} -NetworkCategory Private\n`);
  }
}

if (candidates.length > 1) {
  console.log("Otras IPv4 privadas detectadas:");
  for (const item of candidates.slice(1)) {
    console.log(`- ${item.name}: ${item.address}${item.gateway ? ` (gateway ${item.gateway})` : ""}`);
  }
  console.log("");
}

console.log("Prueba desde la OTRA computadora:");
console.log(`  Test-NetConnection ${recommended.address} -Port ${port}`);
console.log("Debe mostrar: TcpTestSucceeded : True\n");

console.log("Si usás un repetidor/AP cableado:");
console.log("- Lo ideal es que esté en modo Access Point/Bridge, no Router/NAT.");
console.log("- La otra PC debería recibir una IP de la misma LAN y normalmente el mismo gateway.");
console.log("- Desactivá Guest Wi-Fi, AP Isolation o Client Isolation si están habilitados.");
console.log("- No abras el puerto 3000 hacia Internet; esta configuración es sólo para tu LAN.\n");

console.log("Detección de hardware por HTTP LAN:");
console.log("- La web y WebGL pueden funcionar por http://IP:3000.");
console.log("- WebGPU y User-Agent Client Hints requieren un contexto seguro en navegadores compatibles.");
console.log("- Por eso la detección automática puede ser menos completa por HTTP LAN que en localhost/HTTPS.");
console.log("- El perfil manual sigue funcionando y el sitio no debe romperse por esa limitación.\n");
