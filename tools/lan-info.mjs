import os from "node:os";

const port = Number(process.env.PORT || 3000);
const interfaces = os.networkInterfaces();
const addresses = [];

for (const [name, entries] of Object.entries(interfaces)) {
  for (const entry of entries ?? []) {
    if (entry.family !== "IPv4" || entry.internal) continue;

    addresses.push({
      name,
      address: entry.address,
    });
  }
}

console.log("\nDeUna Games - diagnóstico LAN\n");
console.log(`Puerto esperado: ${port}`);
console.log("Servidor LAN: 0.0.0.0");

if (!addresses.length) {
  console.log("\nNo se encontró una IPv4 de red local utilizable.");
  console.log("Revisa que Wi-Fi/Ethernet esté conectado y que el adaptador tenga IPv4.");
  process.exit(0);
}

console.log("\nDirecciones candidatas para abrir desde OTRO dispositivo:\n");

for (const item of addresses) {
  console.log(`- ${item.name}: http://${item.address}:${port}`);
}

console.log("\nImportante:");
console.log("- En la otra PC o celular NO uses localhost ni 127.0.0.1.");
console.log("- Ambos equipos deben estar en la misma LAN y sin aislamiento de clientes/guest Wi-Fi.");
console.log("- Windows Firewall debe permitir conexiones TCP entrantes al puerto 3000 en redes privadas.");
console.log("- Una URL http://IP-LAN no es un contexto seguro del navegador.");
console.log("  La web puede abrir, pero WebGPU y otras APIs de detección avanzada pueden quedar limitadas.");
console.log("- Para detección completa fuera de localhost se necesita HTTPS confiable.\n");
