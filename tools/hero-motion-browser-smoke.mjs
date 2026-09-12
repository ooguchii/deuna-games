import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
const outputDir = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
);
const adminUsername = process.env.DEUNA_VISUAL_ADMIN_USERNAME?.trim();
const adminPassword = process.env.DEUNA_VISUAL_ADMIN_PASSWORD;
const viewport = { width: 1440, height: 1000 };

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
    "Hero motion runtime smoke necesita Chrome/Chromium disponible en PATH."
  );
}

async function waitForDebugger(profileDir, browser) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 30_000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(
        `Chrome terminó antes de exponer DevTools (exit ${browser.exitCode}).`
      );
    }

    try {
      const raw = await readFile(activePortPath, "utf8");
      const port = Number.parseInt(raw.split(/\r?\n/, 1)[0] ?? "", 10);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error("Puerto DevTools inválido.");
      }
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) =>
            target.type === "page" && target.webSocketDebuggerUrl
        );
        if (page) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(
    `Chrome no expuso DevTools a tiempo.${
      lastError instanceof Error ? ` ${lastError.message}` : ""
    }`
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
        reject(new Error("No se pudo abrir el WebSocket de Chrome DevTools."));
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
          pending.reject(
            new Error(`${pending.method}: ${message.error.message}`)
          );
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
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(method);
    };
  }

  waitFor(method, predicate = () => true, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout esperando ${method}.`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (params) => {
        if (!predicate(params)) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(params);
      });
    });
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

async function navigate(cdp, url) {
  const loaded = cdp.waitFor("Page.loadEventFired");
  const navigation = await cdp.send("Page.navigate", { url });
  if (navigation.errorText) {
    throw new Error(`No se pudo navegar a ${url}: ${navigation.errorText}`);
  }
  await loaded;
}

async function waitUntil(cdp, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cdp.evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timeout esperando ${label}.`);
}

async function setViewport(cdp) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });
}

async function loginAdmin(cdp) {
  if (!adminUsername || !adminPassword) {
    throw new Error(
      "Faltan DEUNA_VISUAL_ADMIN_USERNAME/DEUNA_VISUAL_ADMIN_PASSWORD."
    );
  }
  await navigate(cdp, `${baseUrl}/admin/login`);
  await waitUntil(
    cdp,
    'document.querySelector("#admin-username")',
    "formulario de login Admin"
  );
  const prepared = await cdp.evaluate(`
    (() => {
      const username = document.querySelector("#admin-username");
      const password = document.querySelector("#admin-password");
      const form = document.querySelector('form[action="/api/admin/auth/login"]');
      if (!(username instanceof HTMLInputElement) ||
          !(password instanceof HTMLInputElement) ||
          !(form instanceof HTMLFormElement)) return false;
      username.value = ${JSON.stringify(adminUsername)};
      password.value = ${JSON.stringify(adminPassword)};
      username.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()
  `);
  if (!prepared) {
    throw new Error("No se pudo preparar el login real del Admin.");
  }

  const loaded = cdp.waitFor("Page.loadEventFired");
  await cdp.evaluate(`
    document.querySelector('form[action="/api/admin/auth/login"]')?.requestSubmit()
  `);
  await loaded;
  await delay(200);
  const pathname = await cdp.evaluate("location.pathname");
  if (pathname === "/admin/login") {
    throw new Error("El login visual del Admin fue rechazado.");
  }
}

async function capture(cdp, filePath) {
  const image = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(image.data, "base64"));
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(
    path.join(os.tmpdir(), "deuna-hero-motion-chrome-")
  );
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
      `--window-size=${viewport.width},${viewport.height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  browser.stderr.resume();

  let cdp = null;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks: {},
    runtimeIssues: [],
  };

  try {
    const target = await waitForDebugger(profileDir, browser);
    cdp = new CdpSession(await openWebSocket(target.webSocketDebuggerUrl));
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Network.enable"),
    ]);
    await setViewport(cdp);

    cdp.on("Runtime.exceptionThrown", (event) => {
      report.runtimeIssues.push(
        event.exceptionDetails?.exception?.description ??
          event.exceptionDetails?.text ??
          "Excepción JavaScript sin detalle."
      );
    });
    cdp.on("Runtime.consoleAPICalled", (event) => {
      if (event.type !== "error") return;
      report.runtimeIssues.push(
        event.args
          ?.map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ") ?? "console.error sin detalle."
      );
    });

    await loginAdmin(cdp);
    await navigate(cdp, `${baseUrl}/admin/portada?seccion=hero`);
    await waitUntil(
      cdp,
      `document.querySelector('iframe[title^="Hero real"]')?.contentDocument?.querySelector('[data-motion-engine]')`,
      "preview real del Hero"
    );

    const initial = await cdp.evaluate(`
      (() => {
        const frame = document.querySelector('iframe[title^="Hero real"]');
        const preview = frame?.contentDocument;
        const root = preview?.querySelector('[data-motion-engine]');
        const main = preview?.querySelector('[data-position="main"]');
        const input = document.querySelector('form[action="/api/admin/content/home/hero"] input[name="heroJson"]');
        const revision = document.querySelector('form[action="/api/admin/content/home/hero"] input[name="expectedRevision"]');
        let storedEngine = null;
        if (input instanceof HTMLInputElement) {
          storedEngine = JSON.parse(input.value)?.presentation?.motionEngine ?? null;
        }
        return {
          previewEngine: root?.getAttribute("data-motion-engine") ?? null,
          mainLabel: main?.getAttribute("aria-label") ?? null,
          storedEngine,
          expectedRevision: revision instanceof HTMLInputElement ? revision.value : null,
        };
      })()
    `);
    report.checks.initial = initial;
    requireCheck(
      initial.previewEngine === "legacy",
      `El preview inicial debía ser legacy y fue ${initial.previewEngine}.`
    );
    requireCheck(
      initial.storedEngine === "legacy",
      `El borrador fixture debía conservar legacy y fue ${initial.storedEngine}.`
    );

    const previewClicked = await cdp.evaluate(`
      (() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.includes("Probar funcionamiento")
        );
        if (!(button instanceof HTMLButtonElement)) return false;
        button.click();
        return true;
      })()
    `);
    requireCheck(
      previewClicked,
      "No se encontró «Probar funcionamiento» en el editor Hero."
    );

    await waitUntil(
      cdp,
      `document.querySelector('iframe[title^="Hero real"]')?.contentDocument?.querySelector('[data-motion-engine="physical"]')`,
      "simulación física V2"
    );
    await delay(350);

    const simulated = await cdp.evaluate(`
      (() => {
        const frame = document.querySelector('iframe[title^="Hero real"]');
        const preview = frame?.contentDocument;
        const root = preview?.querySelector('[data-motion-engine="physical"]');
        const main = preview?.querySelector('[data-position="main"]');
        const input = document.querySelector('form[action="/api/admin/content/home/hero"] input[name="heroJson"]');
        const revision = document.querySelector('form[action="/api/admin/content/home/hero"] input[name="expectedRevision"]');
        const bodyText = document.body?.innerText ?? "";
        let storedEngine = null;
        if (input instanceof HTMLInputElement) {
          storedEngine = JSON.parse(input.value)?.presentation?.motionEngine ?? null;
        }
        const cards = Array.from(preview?.querySelectorAll('[data-position]') ?? []);
        if (frame?.contentWindow) {
          frame.contentWindow.__deunaHeroMotionNodes = cards.map((node) => ({
            node,
            position: node.getAttribute("data-position"),
          }));
        }
        return {
          previewEngine: root?.getAttribute("data-motion-engine") ?? null,
          mainLabel: main?.getAttribute("aria-label") ?? null,
          motionDirection: root?.getAttribute("data-motion-direction") ?? null,
          motionSequence: root?.getAttribute("data-motion-sequence") ?? null,
          storedEngine,
          expectedRevision: revision instanceof HTMLInputElement ? revision.value : null,
          simulationNotice: bodyText.includes("Simulación V2 activa sólo en esta prueba"),
          cardCount: cards.length,
        };
      })()
    `);
    report.checks.simulated = simulated;
    requireCheck(
      simulated.previewEngine === "physical",
      "«Probar funcionamiento» no activó V2 en el renderer real."
    );
    requireCheck(
      simulated.storedEngine === "legacy",
      "La simulación V2 contaminó el payload guardable del borrador."
    );
    requireCheck(
      simulated.expectedRevision === initial.expectedRevision,
      "La simulación V2 alteró la revisión editorial."
    );
    requireCheck(
      simulated.simulationNotice,
      "Falta el estado explícito de simulación V2 no guardada."
    );
    requireCheck(
      simulated.motionSequence !== null,
      "La prueba V2 no disparó una transición física inicial."
    );
    requireCheck(
      simulated.mainLabel !== initial.mainLabel,
      "La prueba V2 no avanzó el juego principal."
    );
    requireCheck(
      simulated.cardCount >= 2,
      "No hay suficientes tarjetas visibles para comprobar identidad física."
    );

    const replayClicked = await cdp.evaluate(`
      (() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.includes("Repetir transición ahora")
        );
        if (!(button instanceof HTMLButtonElement)) return false;
        button.click();
        return true;
      })()
    `);
    requireCheck(
      replayClicked,
      "No se encontró «Repetir transición ahora» durante la prueba V2."
    );
    await delay(250);

    const replay = await cdp.evaluate(`
      (() => {
        const frame = document.querySelector('iframe[title^="Hero real"]');
        const preview = frame?.contentDocument;
        const root = preview?.querySelector('[data-motion-engine="physical"]');
        const after = Array.from(preview?.querySelectorAll('[data-position]') ?? []);
        const before = frame?.contentWindow?.__deunaHeroMotionNodes ?? [];
        const retained = before.filter(({ node }) => after.includes(node));
        const moved = retained.filter(
          ({ node, position }) => node.getAttribute("data-position") !== position
        );
        const main = preview?.querySelector('[data-position="main"]');
        const input = document.querySelector('form[action="/api/admin/content/home/hero"] input[name="heroJson"]');
        let storedEngine = null;
        if (input instanceof HTMLInputElement) {
          storedEngine = JSON.parse(input.value)?.presentation?.motionEngine ?? null;
        }
        return {
          mainLabel: main?.getAttribute("aria-label") ?? null,
          motionSequence: root?.getAttribute("data-motion-sequence") ?? null,
          retainedNodes: retained.length,
          movedNodes: moved.length,
          storedEngine,
        };
      })()
    `);
    report.checks.replay = replay;
    requireCheck(
      replay.motionSequence &&
        replay.motionSequence !== simulated.motionSequence,
      "La repetición no alternó la secuencia del motor físico."
    );
    requireCheck(
      replay.mainLabel !== simulated.mainLabel,
      "La repetición V2 no cambió el juego principal."
    );
    requireCheck(
      replay.retainedNodes >= 2,
      `V2 no preservó suficientes nodos React entre slots (${replay.retainedNodes}).`
    );
    requireCheck(
      replay.movedNodes >= 1,
      "Ningún nodo estable cambió de posición durante la transición V2."
    );
    requireCheck(
      replay.storedEngine === "legacy",
      "Repetir la transición modificó el borrador persistible."
    );

    await capture(
      cdp,
      path.join(outputDir, "hero-motion-runtime-physical-desktop.png")
    );

    await navigate(cdp, `${baseUrl}/`);
    await waitUntil(
      cdp,
      `document.querySelector('[data-motion-engine]')`,
      "Hero público tras simulación V2"
    );
    const publicState = await cdp.evaluate(`
      (() => {
        const root = document.querySelector('[data-motion-engine]');
        return {
          engine: root?.getAttribute("data-motion-engine") ?? null,
          url: location.href,
        };
      })()
    `);
    report.checks.publicAfterSimulation = publicState;
    requireCheck(
      publicState.engine === "legacy",
      `La Home pública cambió sin publicar: motor ${publicState.engine}.`
    );
    requireCheck(
      report.runtimeIssues.length === 0,
      `Errores runtime durante la prueba V2: ${report.runtimeIssues.join(" | ")}`
    );

    await writeFile(
      path.join(outputDir, "hero-motion-runtime.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    console.log(
      `[hero-motion-runtime] OK: legacy → simulación physical → replay con ${replay.retainedNodes} nodos retenidos/${replay.movedNodes} movidos → Home pública legacy.`
    );
  } catch (error) {
    report.error =
      error instanceof Error ? error.stack ?? error.message : String(error);
    await writeFile(
      path.join(outputDir, "hero-motion-runtime.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    ).catch(() => {});
    throw error;
  } finally {
    cdp?.close();
    browser.kill("SIGTERM");
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
