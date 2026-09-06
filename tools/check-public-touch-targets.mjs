import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import {
  setTimeout as delay,
} from "node:timers/promises";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const minimumTouchTarget = 44;
const measurementTolerance = 0.25;
const mobileViewport = {
  width: 390,
  height: 844,
};

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
    "El check de touch targets necesita Chrome/Chromium disponible en PATH."
  );
}

async function waitForDebugger(profileDir) {
  const activePortPath = path.join(
    profileDir,
    "DevToolsActivePort"
  );
  const deadline = Date.now() + 15_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const activePort = await readFile(
        activePortPath,
        "utf8"
      );
      const port = Number.parseInt(
        activePort.split(/\r?\n/, 1)[0] ?? "",
        10
      );
      if (!Number.isFinite(port)) {
        throw new Error(
          "DevToolsActivePort no contiene un puerto válido."
        );
      }

      const response = await fetch(
        `http://127.0.0.1:${port}/json/list`
      );
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) =>
            target.type === "page" &&
            target.webSocketDebuggerUrl
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
      lastError instanceof Error
        ? ` ${lastError.message}`
        : ""
    }`
  );
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(
      () => reject(
        new Error(
          "Timeout conectando con Chrome DevTools."
        )
      ),
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
        reject(
          new Error(
            "No se pudo abrir el WebSocket de Chrome DevTools."
          )
        );
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
            new Error(
              `${pending.method}: ${message.error.message}`
            )
          );
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }

      if (!message.method) return;
      const listeners = this.listeners.get(message.method);
      if (!listeners) return;
      for (const listener of [...listeners]) {
        listener(message.params ?? {});
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        method,
        resolve,
        reject,
      });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
        })
      );
    });
  }

  on(method, listener) {
    const listeners =
      this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(method);
      }
    };
  }

  waitFor(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(
          new Error(`Timeout esperando ${method}.`)
        );
      }, timeoutMs);
      const unsubscribe = this.on(
        method,
        (params) => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(params);
        }
      );
    });
  }

  async evaluate(expression) {
    const result = await this.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }
    );

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
  const navigation = await cdp.send(
    "Page.navigate",
    { url }
  );

  if (navigation.errorText) {
    throw new Error(
      `No se pudo navegar a ${url}: ${navigation.errorText}`
    );
  }

  await loaded;
}

async function waitForApplication(cdp) {
  await cdp.evaluate(`
    (async () => {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) =>
            setTimeout(resolve, 5000)
          ),
        ]);
      }

      const step = Math.max(
        240,
        Math.floor(window.innerHeight * 0.8)
      );
      const maximum = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );

      for (let y = 0; y < maximum; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) =>
          setTimeout(resolve, 25)
        );
      }
      window.scrollTo(0, 0);

      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );
    })()
  `);

  await delay(180);
}

async function auditHome(cdp) {
  return cdp.evaluate(`
    (() => {
      const minimum = ${minimumTouchTarget};
      const tolerance = ${measurementTolerance};
      const selector =
        "a[href],button,input,select,textarea,summary";

      function isVisible(element) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          style.pointerEvents !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      }

      function pseudoBox(element, pseudo) {
        const style = getComputedStyle(element, pseudo);
        const content = style.content;
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.pointerEvents === "none" ||
          content === "none" ||
          content === "normal"
        ) {
          return null;
        }

        const width = Number.parseFloat(style.width);
        const height = Number.parseFloat(style.height);
        if (
          !Number.isFinite(width) ||
          !Number.isFinite(height) ||
          width <= 0 ||
          height <= 0
        ) {
          return null;
        }

        return { width, height };
      }

      function renderedScale(element, rect) {
        const layoutWidth = element.offsetWidth;
        const layoutHeight = element.offsetHeight;
        return {
          x:
            layoutWidth > 0
              ? rect.width / layoutWidth
              : 1,
          y:
            layoutHeight > 0
              ? rect.height / layoutHeight
              : 1,
        };
      }

      const controls = Array.from(
        document.querySelectorAll(selector)
      ).filter((element) => {
        if (
          element instanceof HTMLButtonElement &&
          element.disabled
        ) {
          return false;
        }
        if (
          element instanceof HTMLInputElement &&
          element.disabled
        ) {
          return false;
        }
        if (
          element instanceof HTMLSelectElement &&
          element.disabled
        ) {
          return false;
        }
        if (
          element instanceof HTMLTextAreaElement &&
          element.disabled
        ) {
          return false;
        }
        return isVisible(element);
      });

      const measured = controls.map((element) => {
        const rect = element.getBoundingClientRect();
        const scale = renderedScale(element, rect);
        const before = pseudoBox(element, "::before");
        const after = pseudoBox(element, "::after");
        const pseudoWidth = Math.max(
          before ? before.width * scale.x : 0,
          after ? after.width * scale.x : 0
        );
        const pseudoHeight = Math.max(
          before ? before.height * scale.y : 0,
          after ? after.height * scale.y : 0
        );
        const effectiveWidth = Math.max(
          rect.width,
          pseudoWidth
        );
        const effectiveHeight = Math.max(
          rect.height,
          pseudoHeight
        );

        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? "")
            .trim()
            .replace(/\\s+/g, " ")
            .slice(0, 100),
          ariaLabel:
            element.getAttribute("aria-label") ?? "",
          visualWidth: rect.width,
          visualHeight: rect.height,
          effectiveWidth,
          effectiveHeight,
          before,
          after,
        };
      });

      const failures = measured.filter(
        (target) =>
          target.effectiveWidth < minimum - tolerance ||
          target.effectiveHeight < minimum - tolerance
      );

      return {
        url: location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        total: measured.length,
        failures,
      };
    })()
  `);
}

async function main() {
  const profileDir = await mkdtemp(
    path.join(
      os.tmpdir(),
      "deuna-public-touch-chrome-"
    )
  );
  const chrome = findChrome();
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`,
      `--window-size=${mobileViewport.width},${mobileViewport.height}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    }
  );
  let browserError = "";
  let cdp = null;

  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    browserError += chunk;
    if (browserError.length > 20_000) {
      browserError = browserError.slice(-20_000);
    }
  });

  try {
    const target = await waitForDebugger(profileDir);
    const socket = await openWebSocket(
      target.webSocketDebuggerUrl
    );
    cdp = new CdpSession(socket);

    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
    ]);

    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: mobileViewport.width,
        height: mobileViewport.height,
        deviceScaleFactor: 1,
        mobile: true,
        screenWidth: mobileViewport.width,
        screenHeight: mobileViewport.height,
        screenOrientation: {
          type: "portraitPrimary",
          angle: 0,
        },
      }
    );

    await navigate(cdp, `${baseUrl}/`);
    await waitForApplication(cdp);
    const audit = await auditHome(cdp);

    if (
      audit.viewport.width !== mobileViewport.width
    ) {
      throw new Error(
        `Viewport inesperado: ${audit.viewport.width}px. Se esperaban ${mobileViewport.width}px.`
      );
    }

    if (audit.failures.length > 0) {
      console.error(
        "\nTargets táctiles de Home pública: REGRESIÓN\n"
      );
      for (const target of audit.failures) {
        const label =
          target.ariaLabel || target.text || "sin etiqueta";
        console.error(
          `- ${target.tag} ${JSON.stringify(label)}: ` +
          `visual ${target.visualWidth.toFixed(2)}x${target.visualHeight.toFixed(2)}px; ` +
          `efectivo ${target.effectiveWidth.toFixed(2)}x${target.effectiveHeight.toFixed(2)}px.`
        );
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      `Targets táctiles de Home pública: OK (${audit.total} controles visibles en ${mobileViewport.width}x${mobileViewport.height}; área efectiva mínima >= ${minimumTouchTarget}px).`
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.stack ?? error.message
        : String(error)
    );
    if (browserError.trim()) {
      console.error(
        "\nChrome stderr:\n",
        browserError.trim()
      );
    }
    process.exitCode = 1;
  } finally {
    cdp?.close();
    browser.kill("SIGTERM");
    await rm(profileDir, {
      recursive: true,
      force: true,
    }).catch(() => {});
  }
}

await main();
