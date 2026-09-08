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
  deleteAccount,
  registerAccount,
} from "../src/lib/accounts/service.ts";

import { resolveAccountSession } from "../src/lib/accounts/session-store.ts";

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

async function searchHardware(cdp, field, query, expectedLabel, prefix = "account") {
  await cdp.evaluate(`document.getElementById(${JSON.stringify(`${prefix}-${field}`)}).click()`);
  await waitFor(cdp, `Boolean(document.querySelector('input[role="combobox"]'))`, "Buscador de hardware");
  await setInput(cdp, 'input[role="combobox"]', query);
  await settle(cdp);
  const selected = await cdp.evaluate(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((entry) => entry.textContent.trim() === ${JSON.stringify(expectedLabel)});
    if (!option) return false;
    option.click();
    return true;
  })()`);
  if (!selected) throw new Error(`El buscador no encontró ${expectedLabel}.`);
  await settle(cdp);
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

async function uploadAvatarFixture(cdp) {
  const selected = await cdp.evaluate(`
    (async () => {
      const input = document.querySelector("#account-avatar-input");
      if (!(input instanceof HTMLInputElement)) return false;

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 96;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return false;

      context.fillStyle = "#101820";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f5b942";
      context.fillRect(12, 12, 54, 72);
      context.fillStyle = "#7b61ff";
      context.fillRect(70, 20, 46, 58);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!(blob instanceof Blob) || blob.size <= 0) return false;

      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], "avatar-fixture.png", {
        type: "image/png",
      }));
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "files"
      )?.set;
      if (!setter) return false;
      setter.call(input, transfer.files);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);

  if (!selected) {
    throw new Error("No se pudo cargar el fixture efímero de avatar.");
  }
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

  // Opt-in sólo para la CA de desarrollo del origen loopback validado arriba.
  if (process.env.DEUNA_VISUAL_ALLOW_LOCAL_CERT === "true") {
    await cdp.send("Security.setIgnoreCertificateErrors", { ignore: true });
  }

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
  if (!registrationClosed && process.env.DEUNA_VISUAL_EXPECT_REGISTRATION_CLOSED !== "false") {
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
  await waitFor(cdp, `document.querySelector('form[aria-label="Configurar Mi PC"] button[type="submit"]').disabled`, "No guardar un perfil incompleto");
  await cdp.evaluate(`document.getElementById("account-cpu").click()`);
  await setInput(cdp, 'input[role="combobox"]', "zzzz-no-existe");
  await waitFor(cdp, `document.body.innerText.includes("No encontramos coincidencias")`, "Búsqueda sin resultados");
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(cdp, `document.activeElement?.id === "account-cpu"`, "Escape devuelve el foco al selector");
  const cpu = { value: "ryzen-5-5600g", label: "AMD Ryzen 5 5600G" };
  const gpu = { value: "radeon-vega-7", label: "AMD Radeon Vega 7" };
  await searchHardware(cdp, "cpu", "5600g", cpu.label);
  await searchHardware(cdp, "gpu", "vega 7", gpu.label);
  await searchHardware(cdp, "ram", "16", "16 GB");
  await selectValue(cdp, 'select[name="memoryMode"]', "dual");
  await submit(cdp, 'form[aria-label="Configurar Mi PC"]');
  await waitFor(cdp, `document.body.innerText.includes("PC guardada. DeUna ya puede usarla")`, "Persistencia de Mi PC");
  await waitFor(cdp, `document.querySelector('form[aria-label="Configurar Mi PC"] button[type="submit"]').disabled`, "Guardado actualizado");
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 1024, 900], ["mobile", 390, 844]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    await settle(cdp);
    await screenshot(cdp, `02-pc-${name}`);
    await cdp.evaluate(`document.getElementById("account-cpu").click()`);
    await setInput(cdp, 'input[role="combobox"]', "5600");
    await settle(cdp);
    await screenshot(cdp, `02-pc-${name}-search`);
    const fits = await cdp.evaluate(`document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('[role="listbox"]')).every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; })`);
    if (!fits) throw new Error(`El buscador desborda en ${name}.`);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await searchHardware(cdp, "ram", "32", "32 GB");
  await cdp.evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === "Cancelar cambios").click()`);
  await waitFor(cdp, `document.querySelector('input[name="ramGb"]').value === "16"`, "Cancelar restaura la RAM guardada");

  // El configurador público debe leer la cuenta y guardar cambios en la misma cuenta.
  await navigate(cdp, "/requisitos");
  await waitFor(cdp, `Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === "Configurar perfil")`, "Configurador público disponible");
  await cdp.evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === "Configurar perfil").click()`);
  await waitFor(cdp, `document.querySelector('#manual-cpu') && document.querySelector('input[name="ramGb"]').value === "16"`, "El configurador público reutiliza Mi PC");
  await searchHardware(cdp, "ram", "32", "32 GB", "manual");
  await cdp.evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes("Guardar y recalcular")).click()`);
  await waitFor(cdp, `!document.querySelector('#manual-cpu')`, "Guardado público confirmado");
  await navigate(cdp, "/cuenta?vista=pc");
  await waitFor(cdp, `document.querySelector('input[name="ramGb"]')?.value === "32"`, "La cuenta refleja el guardado público");
  await searchHardware(cdp, "ram", "16", "16 GB");
  await submit(cdp, 'form[aria-label="Configurar Mi PC"]');
  await waitFor(cdp, `document.body.innerText.includes("PC guardada. DeUna ya puede usarla")`, "Restauración de la RAM de prueba");

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

  const publicFavoriteSelector = `[data-game-favorite="${game.value}"]`;
  await navigate(cdp, "/requisitos");
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).some((button) => button.getAttribute("aria-pressed") === "true")`,
    "Favorito autenticado visible en Por requisitos"
  );
  const favoriteTarget = await cdp.evaluate(`
    (() => {
      const button = document.querySelector(${JSON.stringify(publicFavoriteSelector)});
      if (!(button instanceof HTMLButtonElement)) return null;
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })()
  `);
  if (
    !favoriteTarget ||
    favoriteTarget.width < 44 ||
    favoriteTarget.height < 44
  ) {
    throw new Error(
      `El favorito de Por requisitos no conserva 44px efectivos: ${JSON.stringify(favoriteTarget)}.`
    );
  }
  const unfavoriteClicked = await cdp.evaluate(`
    (() => {
      const button = document.querySelector(${JSON.stringify(publicFavoriteSelector)});
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!unfavoriteClicked) {
    throw new Error("No se pudo quitar el favorito desde Por requisitos.");
  }
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).every((button) => button.getAttribute("aria-pressed") === "false")`,
    "Favorito compartido desactivado en todas las copias"
  );
  await navigate(cdp, "/requisitos");
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).every((button) => button.getAttribute("aria-pressed") === "false")`,
    "Favorito desactivado persistido tras recarga"
  );

  await navigate(cdp, "/cuenta?vista=games");
  const preservedPreference = await waitFor(
    cdp,
    `(() => {
      const link = Array.from(document.querySelectorAll('a[href^="/juegos/"]')).find((entry) => entry.getAttribute("href") === ${JSON.stringify(`/juegos/${game.value}`)});
      const row = link?.closest("article");
      if (!row) return false;
      const state = row.querySelector('select[aria-label^="Estado de "]');
      const favoriteButton = Array.from(row.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "Agregar favorito");
      const followButton = Array.from(row.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "Dejar de seguir actualizaciones");
      return state?.value === "playing" &&
        favoriteButton?.getAttribute("aria-pressed") === "false" &&
        followButton?.getAttribute("aria-pressed") === "true";
    })()`,
    "Biblioteca y seguimiento preservados al quitar favorito"
  );
  if (!preservedPreference) {
    throw new Error("Quitar favorito alteró biblioteca o seguimiento.");
  }

  await navigate(cdp, "/requisitos");
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).some((button) => button.getAttribute("aria-pressed") === "false")`,
    "Favorito disponible para reactivar"
  );
  const refavoriteClicked = await cdp.evaluate(`
    (() => {
      const button = document.querySelector(${JSON.stringify(publicFavoriteSelector)});
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!refavoriteClicked) {
    throw new Error("No se pudo reactivar el favorito desde Por requisitos.");
  }
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).every((button) => button.getAttribute("aria-pressed") === "true")`,
    "Favorito compartido reactivado"
  );
  await navigate(cdp, "/requisitos");
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll(${JSON.stringify(publicFavoriteSelector)})).every((button) => button.getAttribute("aria-pressed") === "true")`,
    "Favorito reactivado persistido tras recarga"
  );
  await screenshot(cdp, "03-favorito-requisitos");

  await navigate(cdp, "/cuenta?vista=profile");
  await waitFor(cdp, `Boolean(document.querySelector("#account-avatar-input"))`, "Editor de avatar privado");
  const emptyAvatarStatus = await cdp.evaluate(`
    (async () => {
      const response = await fetch("/api/account/avatar", {
        cache: "no-store",
        credentials: "same-origin",
      });
      return response.status;
    })()
  `);
  if (emptyAvatarStatus !== 204) {
    throw new Error(
      `Una cuenta sin avatar debe responder 204, recibió ${emptyAvatarStatus}.`
    );
  }

  await uploadAvatarFixture(cdp);
  await waitFor(
    cdp,
    `document.body.innerText.includes("Foto de perfil actualizada.")`,
    "Guardado del avatar privado"
  );
  const storedAvatar = await cdp.evaluate(`
    (async () => {
      const response = await fetch("/api/account/avatar", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const blob = await response.blob();
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        size: blob.size,
      };
    })()
  `);
  if (
    storedAvatar?.status !== 200 ||
    storedAvatar.type !== "image/webp" ||
    storedAvatar.size <= 20 ||
    storedAvatar.size > 512 * 1024
  ) {
    throw new Error(
      `El avatar persistido no conserva el contrato WebP privado: ${JSON.stringify(storedAvatar)}.`
    );
  }
  await screenshot(cdp, "04-avatar-activo-cuenta");

  await navigate(cdp, "/");
  await waitFor(
    cdp,
    `Boolean(document.querySelector('button[aria-label^="Menú de Mi DeUna de "] span[style*="background-image"]'))`,
    "Avatar privado visible en Header público"
  );
  await screenshot(cdp, "04-avatar-header-public");

  await navigate(cdp, "/cuenta?vista=profile");
  await waitFor(cdp, `Boolean(document.querySelector("#account-avatar-input"))`, "Regreso al editor de avatar privado");
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

  await navigate(cdp, "/");
  await waitFor(
    cdp,
    `Boolean(document.querySelector('button[aria-label^="Menú de Mi DeUna de "] span[style*="background-image"]'))`,
    "Avatar persistido en Header público tras navegación completa"
  );
  await screenshot(cdp, "04-avatar-persistido-public");

  await navigate(cdp, "/cuenta?vista=profile");
  await waitFor(
    cdp,
    `Array.from(document.querySelectorAll("button")).some((entry) => entry.textContent?.trim() === "Quitar foto")`,
    "Avatar privado disponible para eliminar"
  );
  const removeAvatarClicked = await cdp.evaluate(`
    (() => {
      const button = Array.from(document.querySelectorAll("button")).find((entry) => entry.textContent?.trim() === "Quitar foto");
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!removeAvatarClicked) {
    throw new Error("No se pudo iniciar la eliminación del avatar.");
  }
  await waitFor(
    cdp,
    `document.body.innerText.includes("Foto de perfil eliminada.")`,
    "Eliminación del avatar privado"
  );
  const avatarStatusAfterDelete = await cdp.evaluate(`
    (async () => {
      const response = await fetch("/api/account/avatar", {
        cache: "no-store",
        credentials: "same-origin",
      });
      return response.status;
    })()
  `);
  if (avatarStatusAfterDelete !== 204) {
    throw new Error(
      `Quitar avatar debe restaurar 204, recibió ${avatarStatusAfterDelete}.`
    );
  }

  await navigate(cdp, "/");
  await waitFor(
    cdp,
    `Boolean(document.querySelector('button[aria-label^="Menú de Mi DeUna de "]')) && !Boolean(document.querySelector('button[aria-label^="Menú de Mi DeUna de "] span[style*="background-image"]'))`,
    "Fallback del Header público restaurado tras eliminar avatar"
  );
  await screenshot(cdp, "04-avatar-eliminado-public");

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
    document.querySelector('input[name="cpuId"]')?.value === ${JSON.stringify(cpu.value)} &&
    document.querySelector('input[name="gpuId"]')?.value === ${JSON.stringify(gpu.value)} &&
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
      registrationClosed,
      hardwarePersistence: true,
      hardwareSearchAndCancellation: true,
      bidirectionalHardwarePersistence: true,
      hardwareResponsiveViewports: [1440, 1024, 390],
      gamePreferencePersistence: true,
      publicFavoritePersistence: true,
      favoritePreservesLibraryAndFollowing: true,
      favoriteTouchTargetMinimum: 44,
      profilePersistence: true,
      avatarEmptyStatus: 204,
      avatarLifecycle: true,
      avatarHeaderSync: true,
      avatarHeaderPublicBoundary: true,
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
    "Cuenta browser E2E: OK (login real, Mi PC, favoritos públicos, avatar privado/Header público, Mis juegos, perfil, ficha pública y eliminación de la cuenta temporal en PostgreSQL)."
  );
} catch (error) {
  if (browserError.trim()) {
    console.error("Chrome stderr (Cuenta):\n", browserError.trim());
  }
  throw error;
} finally {
  const remainingSession = await resolveAccountSession(registration.token);
  if (remainingSession) await deleteAccount(remainingSession.userId, password);
  cdp?.close();
  browser.kill("SIGTERM");
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}