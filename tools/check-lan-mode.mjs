import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile("package.json", "utf8")
);
const launcher = await readFile(
  "tools/run-lan.mjs",
  "utf8"
);
const nextConfig = await readFile(
  "next.config.ts",
  "utf8"
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  packageJson.scripts?.lan ===
    "node ./tools/run-lan.mjs",
  "npm run lan debe usar el launcher LAN dedicado."
);
assert(
  packageJson.scripts?.mobile ===
    "npm run lan",
  "npm run mobile debe delegar en el modo LAN seguro."
);

for (const required of [
  "DEUNA_LAN_HOST",
  "DEUNA_LAN_ORIGIN",
  "NEXT_PUBLIC_SITE_URL",
  '"--hostname"',
  '"0.0.0.0"',
]) {
  assert(
    launcher.includes(required),
    `El launcher LAN perdió una garantía requerida: ${required}`
  );
}

assert(
  launcher.includes("isPrivateIpv4"),
  "El launcher LAN debe limitar el host detectado a una IPv4 privada."
);
assert(
  !launcher.includes("DEUNA_ADMIN_ORIGIN:"),
  "El modo LAN no debe ampliar ni sobrescribir DEUNA_ADMIN_ORIGIN."
);
assert(
  nextConfig.includes("allowedDevOrigins"),
  "Next debe declarar allowedDevOrigins para el host LAN confiable."
);
assert(
  nextConfig.includes("DEUNA_LAN_HOST"),
  "allowedDevOrigins debe derivarse del host LAN detectado en runtime."
);
assert(
  nextConfig.includes("isPrivateIpv4(lanHost)"),
  "Next sólo debe aceptar el origen de desarrollo si es una IPv4 privada."
);

console.log(
  "LAN mode invariants: OK (launcher dedicado, origen público LAN, allowedDevOrigins privado y admin origin intacto)."
);
