import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PROVIDER_VERSION = "1.3.2";
const PROVIDER_IMAGE = `brainicism/bgutil-ytdlp-pot-provider:${PROVIDER_VERSION}`;
const PROVIDER_CONTAINER = "deuna-youtube-pot-provider";
const PROVIDER_URL = "http://127.0.0.1:4416";
const PLUGIN_URL = `https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${PROVIDER_VERSION}/bgutil-ytdlp-pot-provider.zip`;
const PLUGIN_SHA256 = "d51cf1c54e487137df749bd8778cceaa62304e6c5054c955b95f028f93ad6d57";
const ROOT = path.resolve(".deuna-local-tools", "youtube-pot");
const PLUGIN_DIRECTORY = path.join(ROOT, "yt-dlp-plugins");
const PLUGIN_FILE = path.join(PLUGIN_DIRECTORY, "bgutil-ytdlp-pot-provider.zip");
const TEMP_PLUGIN_FILE = `${PLUGIN_FILE}.tmp`;
const MAX_PLUGIN_BYTES = 256 * 1024;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function runDocker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: allowFailure ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    if (allowFailure) return result;
    throw new Error("Docker no está disponible. Instala/inicia Docker y vuelve a ejecutar este comando.");
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(`Docker terminó con código ${result.status ?? "desconocido"}.`);
  }
  return result;
}

async function installVerifiedPlugin() {
  await mkdir(PLUGIN_DIRECTORY, { recursive: true });

  if (existsSync(PLUGIN_FILE)) {
    const installed = await readFile(PLUGIN_FILE);
    if (installed.length <= MAX_PLUGIN_BYTES && sha256(installed) === PLUGIN_SHA256) {
      return false;
    }
  }

  const response = await fetch(PLUGIN_URL, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "DeUnaGames-YouTubePOT-Setup/1.0" },
  });
  if (!response.ok) throw new Error(`No se pudo descargar el plugin oficial (${response.status}).`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length <= 0 || buffer.length > MAX_PLUGIN_BYTES) {
    throw new Error("El plugin descargado tiene un tamaño inesperado.");
  }
  const digest = sha256(buffer);
  if (digest !== PLUGIN_SHA256) {
    throw new Error(`El SHA-256 del plugin no coincide. Esperado ${PLUGIN_SHA256}; recibido ${digest}.`);
  }

  await rm(TEMP_PLUGIN_FILE, { force: true });
  await writeFile(TEMP_PLUGIN_FILE, buffer, { mode: 0o600 });
  await rename(TEMP_PLUGIN_FILE, PLUGIN_FILE);
  return true;
}

function ensureDockerProvider() {
  const version = runDocker(["version", "--format", "{{.Server.Version}}"], { allowFailure: true });
  if (version.error || version.status !== 0 || !version.stdout.trim()) {
    throw new Error("Docker Engine no está disponible. Abre Docker Desktop/Engine y vuelve a ejecutar npm run media:youtube:setup.");
  }

  const existing = runDocker(["inspect", "--format", "{{.Config.Image}}", PROVIDER_CONTAINER], { allowFailure: true });
  if (existing.status === 0) {
    const currentImage = existing.stdout.trim();
    if (currentImage !== PROVIDER_IMAGE) {
      runDocker(["rm", "-f", PROVIDER_CONTAINER]);
    } else {
      const running = runDocker(["inspect", "--format", "{{.State.Running}}", PROVIDER_CONTAINER], { allowFailure: true });
      if (running.status === 0 && running.stdout.trim() === "true") return;
      runDocker(["start", PROVIDER_CONTAINER]);
      return;
    }
  }

  const image = runDocker(["image", "inspect", PROVIDER_IMAGE], { allowFailure: true });
  if (image.status !== 0) runDocker(["pull", PROVIDER_IMAGE]);

  runDocker([
    "run",
    "--name", PROVIDER_CONTAINER,
    "--restart", "unless-stopped",
    "-d",
    "--init",
    "-p", "127.0.0.1:4416:4416",
    PROVIDER_IMAGE,
  ]);
}

async function waitForProvider() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${PROVIDER_URL}/`, {
        signal: AbortSignal.timeout(1_500),
        headers: { "User-Agent": "DeUnaGames-YouTubePOT-Health/1.0" },
      });
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

try {
  console.log("\nDeUna Games - configuración YouTube Proof-of-Origin\n");
  const downloaded = await installVerifiedPlugin();
  console.log(downloaded ? `Plugin bgutil ${PROVIDER_VERSION}: descargado y SHA-256 verificado.` : `Plugin bgutil ${PROVIDER_VERSION}: ya estaba instalado y verificado.`);

  ensureDockerProvider();
  if (!(await waitForProvider())) {
    throw new Error(`El proveedor ${PROVIDER_IMAGE} no respondió en ${PROVIDER_URL}. Revisa: docker logs ${PROVIDER_CONTAINER}`);
  }

  console.log(`Proveedor PO Token ${PROVIDER_VERSION}: listo en ${PROVIDER_URL} (sólo loopback).`);
  console.log(`Plugin yt-dlp: ${PLUGIN_FILE}`);
  console.log("Listo. npm run mobile:secure lo detectará automáticamente y habilitará mweb sólo como último fallback de YouTube.\n");
} catch (error) {
  await rm(TEMP_PLUGIN_FILE, { force: true }).catch(() => {});
  console.error("\nNo se pudo configurar el PO Token Provider de YouTube.\n");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
