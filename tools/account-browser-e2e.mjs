import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  randomBytes,
} from "node:crypto";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  authenticateAccount,
  registerAccount,
} from "../src/lib/accounts/service.ts";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ?? "https://127.0.0.1:3443"
).replace(/\/$/, "");
const parsedBaseUrl = new URL(baseUrl);
const outputRoot = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
);
const outputDir = path.join(outputRoot, "account-e2e");

if (
  parsedBaseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(parsedBaseUrl.hostname)
) {
  throw new Error(
    "El E2E de Cuenta sólo puede ejecutarse contra el runtime HTTPS local aislado."
  );
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(
      "sh",
      ["-lc", `command -v ${JSON.stringify(candidate)}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const resolved = result.stdout.trim();
    if (result.status === 0 && resolved) return resolved;
  }

  throw new Error(
    "El E2E de Cuenta necesita Chrome/Chromium disponible en PATH."
  );
}

async function waitForDebugger(profileDir) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const raw = await import("node:fs/promises")
        .then(({ readFile }) => readFile(activePortPath, "utf8"));
      const port = Number.parseInt(raw.split(/\r?\n/, 1)[0] ?? "", 10);
      if (!Number.isFinite(port)) throw new Error("Puerto DevTools inválido.");
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) => target.type === "page" && target.webSocketDebuggerUrl
        );
        if (page) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(
    `Chrome no expuso DevTools a tiempo.${lastError instanceof Error ? ` ${lastError.message}` : ""}`
  );
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(
      () => reject(new Error("Timeout conectando con Chrome DevTools.")),
      10_000
    );
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("No se pudo abrir Chrome DevTools."));
    }, { once: true });
  });
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      const listeners = this.listeners.get(message.method);
      if (!listeners) return;
      for (const listener of [...listeners]) listener(message.params ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime.evaluate falló."
      );
    }
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function navigate(cdp, pathname) {
  const url = new URL(pathname, baseUrl);
  if (url.origin !== parsedBaseUrl.origin) {
    throw new Error(`Navegación fuera del origen visual: ${url.origin}.`);
  }
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout cargando ${url.pathname}.`)),
      20_000
    );
    cdp.on("Page.loadEventFired", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const navigation = await cdp.send("Page.navigate", { url: url.href });
  if (navigation.errorText) {
    throw new Error(`No se pudo navegar a ${url.href}: ${navigation.errorText}`);
  }
  await loaded;
  await settle(cdp);
}

async function settle(cdp) {
  await cdp.evaluate(`
    (async () => {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
    })()
  `);
  await delay(120);
}

async function waitFor(cdp, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await cdp.evaluate(expression);
    if (lastValue) return lastValue;
    await delay(120);
  }
  throw new Error(`${label} no se cumplió a tiempo (último valor: ${JSON.stringify(lastValue)}).`);
}

async function setInput(cdp, selector, value) {
  const ok = await cdp.evaluate(`
    (() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
        return false;
      }
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`No se encontró el campo ${selector}.`);
}

async function selectFirstRealOption(cdp, selector) {
  const value = await cdp.evaluate(`
    (() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      if (!(select instanceof HTMLSelectElement)) return null;
      const option = Array.from(select.options).find((entry) =>
        !entry.disabled && entry.value.trim()
      );
      if (!option) return null;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      setter?.call(select, option.value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return { value: option.value, label: option.textContent?.trim() ?? option.value };
    })()
  `);
  if (!value) throw new Error(`No hay opción seleccionable en ${selector}.`);
  return value;
}

async function selectValue(cdp, selector, value) {
  const ok = await cdp.evaluate(`
    (() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      if (!(select instanceof HTMLSelectElement)) return false;
      if (!Array.from(select.options).some((option) => option.value === ${JSON.stringify(value)})) {
        return false;
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      setter?.call(select, ${JSON.stringify(value)});
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`No se pudo seleccionar ${value} en ${selector}.`);
}

async function check(cdp, selector) {
  const ok = await cdp.evaluate(`
    (() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return false;
      if (!input.checked) input.click();
      return input.checked;
    })()
  `);
  if (!ok) throw new Error(`No se pudo activar ${selector}.`);
}

async function submit(cdp, selector) {
  const ok = await cdp.evaluate(`
    (() => {
      const form = document.querySelector(${JSON.stringify(selector)});
      if (!(form instanceof HTMLFormElement)) return false;
      form.requestSubmit();
      return true;
    })()
  `);
  if (!ok) throw new Error(`No se encontró el formulario ${selector}.`);
}

async function openAccountView(cdp, label, expectedView, expectedHeading) {
  const clicked = await cdp.evaluate(`
    (() => {
      const button = Array.from(
        document.querySelectorAll('nav[aria-label="Secciones de Mi DeUna"] button')
      ).find((entry) => entry.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(label)}));
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!clicked) throw new Error(`No se encontró la vista de Cuenta ${label}.`);
  await waitFor(
    cdp,
    `location.search.includes(${JSON.stringify(`vista=${expectedView}`)}) && document.querySelector("h1")?.textContent?.includes(${JSON.stringify(expectedHeading)})`,
    `Vista ${label}`
  );
  await settle(cdp);
}

async function screenshot(cdp, name) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const width = Math.max(390, Math.min(1440, Math.ceil(size.width)));
  const height = Math.min(18_000, Math.max(900, Math.ceil(size.height)));
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  await writeFile(
    path.join(outputDir, `${name}.png`),
    Buffer.from(shot.data, "base64")
  );
}

const suffix = `${Date.now().toString(36)}${process.pid.toString(36)}`.slice(-14);
const username = `visual_${suffix}`.slice(0, 40);
const password = `Qa!${randomBytes(18).toString("base64url")}9`;
const displayName = `Cuenta visual ${suffix}`;

const registration = await registerAccount({
  username,
  password,
});
if (!registration.created) {
  throw new Error("No se pudo provisionar la cuenta efímera del E2E.");
}

await mkdir(outputDir, { recursive: true });
const profileDir = await mkdtemp(path.join(os.tmpdir(), "deuna-account-e2e-"));
const browser = spawn(
  findChrome(),
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profileDir}`,
    "--window-size=1280,1000",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);
let browserError = "";
browser.stderr.setEncoding("utf8");
browser.stderr.on("data", (chunk) => {
  browserError += chunk;
  if (browserError.length > 16_000) browserError = browserError.slice(-16_000);
});

let cdp;
const runtimeFailures = [];

try {
  const target = await waitForDebugger(profileDir);
  cdp = new CdpSession(await openWebSocket(target.webSocketDebuggerUrl));
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("Network.enable"),
    cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 1000,
    }),
  ]);

  cdp.on("Runtime.exceptionThrown", (event) => {
    runtimeFailures.push(
      event.exceptionDetails?.exception?.description ??
      event.exceptionDetails?.text ??
      "Excepción JavaScript sin detalle."
    );
  });
  cdp.on("Runtime.consoleAPICalled", (event) => {
    if (event.type !== "error") return;
    runtimeFailures.push(
      event.args?.map((argument) =>
        argument.value ?? argument.description ?? argument.type
      ).join(" ") ?? "console.error sin detalle."
    );
  });
  cdp.on("Network.responseReceived", (event) => {
    const status = event.response?.status ?? 0;
    const url = event.response?.url;
    if (status < 400 || !url) return;
    try {
      if (new URL(url).origin !== parsedBaseUrl.origin) return;
    } catch {
      return;
    }
    runtimeFailures.push(`${status} ${url}`);
  });

  await navigate(cdp, "/cuenta");
  const registrationClosed = await cdp.evaluate(`
    document.body.innerText.includes("La creación de nuevas cuentas está cerrada") &&
    !Array.from(document.querySelectorAll('[role="tab"]')).some((tab) =>
      tab.textContent?.trim() === "Crear cuenta"
    )
  `);
  if (!registrationClosed) {
    throw new Error(
      "El runtime visual dejó de representar correctamente el registro público cerrado."
    );
  }

  await setInput(cdp, "#account-login-username", username);
  await setInput(cdp, "#account-login-password", password);
  await submit(cdp, "#account-panel-login");
  await waitFor(
    cdp,
    `document.querySelector("h1")?.textContent?.includes("¡Bienvenido") && Boolean(document.querySelector('nav[aria-label="Secciones de Mi DeUna"]'))`,
    "Login real de Cuenta"
  );
  await screenshot(cdp, "01-overview");

  await openAccountView(cdp, "Mi PC", "pc", "Mi PC");
  const cpu = await selectFirstRealOption(cdp, 'select[name="cpuId"]');
  const gpu = await selectFirstRealOption(cdp, 'select[name="gpuId"]');
  await setInput(cdp, 'input[name="ramGb"]', "16");
  await selectValue(cdp, 'select[name="memoryMode"]', "dual");
  await submit(cdp, 'form:has(select[name="cpuId"]):has(select[name="gpuId"])');
  await waitFor(
    cdp,
    `document.body.innerText.includes("PC guardada. DeUna ya puede usarla")`,
    "Persistencia de Mi PC"
  );
  await screenshot(cdp, "02-pc-guardada");

  await openAccountView(cdp, "Mis juegos", "games", "Mis juegos");
  const game = await selectFirstRealOption(cdp, 'select[name="gameSlug"]');
  await selectValue(cdp, 'select[name="libraryState"]', "playing");
  await check(cdp, 'input[name="favorite"]');
  await check(cdp, 'input[name="followUpdates"]');
  await submit(cdp, 'form:has(select[name="gameSlug"]):has(select[name="libraryState"])');
  await waitFor(
    cdp,
    `document.body.innerText.includes("Juego agregado a Mi DeUna") || Array.from(document.querySelectorAll("a")).some((a) => a.getAttribute("href") === ${JSON.stringify(`/juegos/${"${game.value}"}`)})`,
    "Persistencia de Mis juegos"
  ).catch(async () => {
    const persisted = await cdp.evaluate(`
      Array.from(document.querySelectorAll("a")).some((a) =>
        a.getAttribute("href") === "/juegos/" + ${JSON.stringify(game.value)}
      )
    `);
    if (!persisted) throw new Error("El juego agregado no apareció en la biblioteca.");
  });
  await screenshot(cdp, "03-mis-juegos");

  await openAccountView(cdp, "Perfil privado", "profile", "Perfil privado");
  await setInput(cdp, "#dashboard-display-name", displayName);
  await setInput(
    cdp,
    "#dashboard-bio",
    "Fixture efímero de validación browser. No contiene datos personales reales."
  );
  await submit(cdp, 'form:has(#dashboard-display-name):has(#dashboard-bio)');
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Guardado"))`,
    "Guardado de perfil privado"
  );

  await navigate(cdp, "/cuenta?vista=profile");
  const profilePersisted = await cdp.evaluate(`
    document.querySelector("#dashboard-display-name")?.value === ${JSON.stringify(displayName)} &&
    document.querySelector("#dashboard-bio")?.value.includes("Fixture efímero")
  `);
  if (!profilePersisted) {
    throw new Error("El perfil privado no sobrevivió a una navegación completa.");
  }
  await screenshot(cdp, "04-perfil-persistido");

  await navigate(cdp, `/juegos/${encodeURIComponent(game.value)}`);
  const publicAccountState = await cdp.evaluate(`
    document.body.innerText.includes("MI DEUNA") &&
    document.body.innerText.includes("Favorito") &&
    !document.body.innerText.includes("Entrar para participar")
  `);
  if (!publicAccountState) {
    throw new Error(
      "La ficha pública no reutilizó la preferencia autenticada guardada en Mi DeUna."
    );
  }

  await navigate(cdp, "/cuenta?vista=pc");
  const hardwarePersisted = await cdp.evaluate(`
    document.querySelector('select[name="cpuId"]')?.value === ${JSON.stringify(cpu.value)} &&
    document.querySelector('select[name="gpuId"]')?.value === ${JSON.stringify(gpu.value)} &&
    document.querySelector('input[name="ramGb"]')?.value === "16" &&
    document.querySelector('select[name="memoryMode"]')?.value === "dual"
  `);
  if (!hardwarePersisted) {
    throw new Error("Mi PC no sobrevivió a una navegación completa.");
  }

  await openAccountView(cdp, "Configuración", "settings", "Configuración");
  await setInput(cdp, "#dashboard-delete-password", password);
  await submit(cdp, 'form:has(#dashboard-delete-password)');
  await waitFor(
    cdp,
    `location.pathname === "/cuenta" && !Boolean(document.querySelector('nav[aria-label="Secciones de Mi DeUna"]'))`,
    "Eliminación de la cuenta efímera",
    15_000
  );

  const authenticationAfterDeletion = await authenticateAccount(username, password);
  if (authenticationAfterDeletion.authenticated) {
    throw new Error(
      "La cuenta eliminada todavía pudo autenticarse contra la autoridad server-side."
    );
  }

  if (runtimeFailures.length) {
    throw new Error(
      `El E2E de Cuenta observó errores de runtime/red: ${runtimeFailures.join(" | ")}`
    );
  }

  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      login: true,
      registrationClosed: true,
      hardwarePersistence: true,
      gamePreferencePersistence: true,
      profilePersistence: true,
      publicAccountBoundary: true,
      deletion: true,
      reauthenticationAfterDeletion: false,
      fixture: {
        cpu: cpu.label,
        gpu: gpu.label,
        game: game.label,
      },
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(
    "Cuenta browser E2E: OK (login real, Mi PC, Mis juegos, perfil, ficha pública y eliminación sobre PostgreSQL efímera)."
  );
} catch (error) {
  if (browserError.trim()) {
    console.error("Chrome stderr (Cuenta):\n", browserError.trim());
  }
  throw error;
} finally {
  cdp?.close();
  browser.kill("SIGTERM");
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
