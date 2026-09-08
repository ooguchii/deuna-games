import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { randomBytes } from "node:crypto";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  deleteAccount,
  registerAccount,
} from "../src/lib/accounts/service.ts";
import {
  resolveAccountSession,
} from "../src/lib/accounts/session-store.ts";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ?? "https://127.0.0.1:3443"
).replace(/\/$/, "");
const parsedBaseUrl = new URL(baseUrl);
const outputRoot = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
);
const outputDir = path.join(outputRoot, "account-header-menu-e2e");

if (
  parsedBaseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(parsedBaseUrl.hostname)
) {
  throw new Error(
    "El E2E del menú de cuenta sólo puede ejecutarse contra el runtime HTTPS local aislado."
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
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    const resolved = result.stdout.trim();
    if (result.status === 0 && resolved) return resolved;
  }

  throw new Error(
    "El E2E del menú de cuenta necesita Chrome/Chromium disponible en PATH."
  );
}

async function waitForDebugger(profileDir) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(activePortPath, "utf8");
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

    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve(socket);
      },
      { once: true }
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("No se pudo abrir Chrome DevTools."));
      },
      { once: true }
    );
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

async function waitFor(cdp, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;

  while (Date.now() < deadline) {
    lastValue = await cdp.evaluate(expression);
    if (lastValue) return lastValue;
    await delay(120);
  }

  throw new Error(
    `${label} no se cumplió a tiempo (último valor: ${JSON.stringify(lastValue)}).`
  );
}

async function setInput(cdp, selector, value) {
  const ok = await cdp.evaluate(`
    (() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);

  if (!ok) throw new Error(`No se encontró el campo ${selector}.`);
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

async function screenshot(cdp, name) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });

  await writeFile(
    path.join(outputDir, `${name}.png`),
    Buffer.from(shot.data, "base64")
  );
}

const suffix = `${Date.now().toString(36)}${process.pid.toString(36)}`.slice(-14);
const username = `menu_${suffix}`.slice(0, 40);
const password = `Qa!${randomBytes(18).toString("base64url")}9`;
const registration = await registerAccount({ username, password });

if (!registration.created) {
  throw new Error("No se pudo provisionar la cuenta efímera del menú de Header.");
}

const accountSession = await resolveAccountSession(registration.token);
if (!accountSession) {
  throw new Error("La cuenta efímera del menú no expuso una sesión válida.");
}

await mkdir(outputDir, { recursive: true });
const profileDir = await mkdtemp(path.join(os.tmpdir(), "deuna-header-menu-e2e-"));
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
const expectedHrefs = [
  "/cuenta",
  "/cuenta?vista=rewards",
  "/cuenta?vista=games",
  "/cuenta?vista=pc",
  "/cuenta?vista=alerts",
  "/cuenta?vista=discover",
  "/cuenta?vista=profile",
  "/cuenta?vista=settings",
];

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
      event.args?.map((argument) => argument.value ?? argument.description ?? argument.type).join(" ") ??
        "console.error sin detalle."
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

  await navigate(cdp, "/");
  const guestAudit = await cdp.evaluate(`
    (() => {
      const signIn = document.querySelector('a[href="/cuenta?modo=entrar"]');
      const rect = signIn?.getBoundingClientRect();
      return {
        signIn: Boolean(signIn),
        signInTarget: Boolean(rect && rect.height >= 44),
        bell: Boolean(document.querySelector('button[aria-controls="header-notifications"]')),
        account: Boolean(document.querySelector('button[aria-controls="header-account-menu"]')),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()
  `);
  if (
    !guestAudit?.signIn ||
    !guestAudit.signInTarget ||
    guestAudit.bell ||
    guestAudit.account ||
    guestAudit.horizontalOverflow
  ) {
    throw new Error(`El Header invitado no cumple el contrato: ${JSON.stringify(guestAudit)}.`);
  }
  await screenshot(cdp, "01-guest-desktop");

  await navigate(cdp, "/cuenta?modo=entrar");
  await setInput(cdp, "#account-login-username", username);
  await setInput(cdp, "#account-login-password", password);
  await submit(cdp, "#account-panel-login");
  await waitFor(
    cdp,
    `location.pathname === "/cuenta" &&
      Boolean(document.querySelector('nav[aria-label="Secciones de Mi DeUna"]')) &&
      !document.querySelector("#account-panel-login")`,
    "Login de la cuenta efímera"
  );

  await navigate(cdp, "/");
  await waitFor(
    cdp,
    `Boolean(document.querySelector('button[aria-controls="header-account-menu"]')) &&
      Boolean(document.querySelector('button[aria-controls="header-notifications"]')) &&
      !document.querySelector('a[href="/cuenta?modo=entrar"]')`,
    "Estado autenticado del Header"
  );

  const opened = await cdp.evaluate(`
    (() => {
      const button = document.querySelector('button[aria-controls="header-account-menu"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!opened) throw new Error("No se pudo abrir el menú de Mi DeUna.");

  await waitFor(
    cdp,
    `Boolean(document.querySelector("#header-account-menu")) &&
      document.querySelector("#header-account-menu")?.innerText.includes(${JSON.stringify(username)})`,
    "Identidad y menú de Mi DeUna"
  );
  await waitFor(
    cdp,
    `document.querySelector("#header-account-menu")?.contains(document.activeElement)`,
    "Foco dentro del menú de Mi DeUna"
  );

  const desktopAudit = await cdp.evaluate(`
    (() => {
      const dialog = document.querySelector("#header-account-menu");
      if (!(dialog instanceof HTMLElement)) return null;
      const rect = dialog.getBoundingClientRect();
      const hrefs = Array.from(dialog.querySelectorAll("nav a[href]")).map((entry) =>
        entry.getAttribute("href")
      );
      const actions = Array.from(dialog.querySelectorAll("a[href], button:not([disabled])"));
      return {
        insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        hrefs,
        actionTargets: actions.every((entry) => entry.getBoundingClientRect().height >= 44),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()
  `);
  if (
    !desktopAudit?.insideViewport ||
    !desktopAudit.actionTargets ||
    desktopAudit.horizontalOverflow ||
    JSON.stringify(desktopAudit.hrefs) !== JSON.stringify(expectedHrefs)
  ) {
    throw new Error(`El menú desktop no cumple el contrato: ${JSON.stringify(desktopAudit)}.`);
  }
  await screenshot(cdp, "02-account-menu-desktop");

  await cdp.evaluate(`document.querySelector('button[aria-controls="header-notifications"]')?.click()`);
  await waitFor(
    cdp,
    `Boolean(document.querySelector("#header-notifications")) && !document.querySelector("#header-account-menu")`,
    "Avisos y cuenta son excluyentes"
  );
  await cdp.evaluate(`document.querySelector('button[aria-controls="header-notifications"]')?.click()`);
  await cdp.evaluate(`document.querySelector('button[aria-controls="header-account-menu"]')?.click()`);
  await waitFor(cdp, `Boolean(document.querySelector("#header-account-menu"))`, "Reapertura del menú de cuenta");

  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await waitFor(
    cdp,
    `!document.querySelector("#header-account-menu") &&
      document.activeElement?.getAttribute("aria-controls") === "header-account-menu"`,
    "Escape devuelve el foco al avatar"
  );

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await navigate(cdp, "/");
  await cdp.evaluate(`document.querySelector('button[aria-controls="header-account-menu"]')?.click()`);
  await waitFor(
    cdp,
    `document.querySelector("#mobile-navigation")?.getAttribute("aria-hidden") === "false" &&
      !document.querySelector("#header-account-menu") &&
      document.querySelectorAll('#mobile-navigation a[data-account-shortcut="true"]').length === 8`,
    "Avatar reutiliza el panel mobile con ocho accesos"
  );
  await waitFor(
    cdp,
    `document.activeElement?.matches('[data-account-shortcut="true"]')`,
    "El avatar mobile lleva el foco a los accesos de cuenta"
  );

  const mobileAudit = await cdp.evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll('#mobile-navigation a[data-account-shortcut="true"]'));
      const hrefs = links.map((entry) => entry.getAttribute("href"));
      return {
        hrefs,
        targets: links.every((entry) => entry.getBoundingClientRect().height >= 44),
        guestAction: Boolean(document.querySelector('#mobile-navigation a[href="/cuenta?modo=entrar"]')),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()
  `);
  if (
    !mobileAudit?.targets ||
    mobileAudit.guestAction ||
    mobileAudit.horizontalOverflow ||
    JSON.stringify(mobileAudit.hrefs) !== JSON.stringify(expectedHrefs)
  ) {
    throw new Error(`El menú mobile no cumple el contrato: ${JSON.stringify(mobileAudit)}.`);
  }
  await screenshot(cdp, "03-account-menu-mobile");

  const loggedOut = await cdp.evaluate(`
    (() => {
      const button = Array.from(document.querySelectorAll("#mobile-navigation button")).find((entry) =>
        entry.textContent?.includes("Cerrar sesión")
      );
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()
  `);
  if (!loggedOut) throw new Error("No apareció Cerrar sesión en el panel mobile.");

  await waitFor(
    cdp,
    `location.pathname === "/" &&
      Boolean(document.querySelector('a[href="/cuenta?modo=entrar"]')) &&
      !document.querySelector('button[aria-controls="header-account-menu"]') &&
      !document.querySelector('button[aria-controls="header-notifications"]')`,
    "Logout restaura el Header invitado"
  );

  if (runtimeFailures.length > 0) {
    throw new Error(
      `El flujo del menú de cuenta registró problemas de runtime: ${runtimeFailures.join(" | ")}`
    );
  }

  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        guestState: true,
        authenticatedMenu: true,
        mutuallyExclusivePopovers: true,
        keyboardFocus: true,
        mobileAccountEntry: true,
        logout: true,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(
    "Menú de cuenta browser E2E: OK (invitado, login, 8 accesos, popovers excluyentes, foco/Escape, mobile y logout)."
  );
} catch (error) {
  if (browserError.trim()) {
    console.error("Chrome stderr (menú de cuenta):\n", browserError.trim());
  }
  throw error;
} finally {
  await deleteAccount(accountSession.userId, password).catch(() => false);
  cdp?.close();
  browser.kill("SIGTERM");
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
