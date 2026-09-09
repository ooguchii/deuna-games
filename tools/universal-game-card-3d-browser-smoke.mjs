import { spawn, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
const outputRoot = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
);
const screenshotPath = path.join(
  outputRoot,
  "card-3d-active-desktop.png"
);

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
    "Universal Game Card 3D browser smoke necesita Chrome/Chromium disponible."
  );
}

async function waitForDebugger(profileDir) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(activePortPath, "utf8");
      const port = Number.parseInt(raw.split(/\r?\n/, 1)[0] ?? "", 10);
      if (!Number.isFinite(port)) {
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
    const timeout = setTimeout(() => {
      reject(new Error("Timeout conectando con Chrome DevTools."));
    }, 10_000);

    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve(socket);
      },
      { once: true }
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
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
          pending.reject(
            new Error(`${pending.method}: ${message.error.message}`)
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
      if (listeners.size === 0) this.listeners.delete(method);
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
  const loaded = cdp.waitFor("Page.loadEventFired", () => true, 20_000);
  const navigation = await cdp.send("Page.navigate", { url });
  if (navigation.errorText) {
    throw new Error(`No se pudo navegar a ${url}: ${navigation.errorText}`);
  }
  await loaded;
}

async function waitForUniversalCard(cdp) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const state = await cdp.evaluate(`
      (() => {
        const card = Array.from(document.querySelectorAll("article"))
          .find((element) =>
            element instanceof HTMLElement &&
            element.style.getPropertyValue("--tilt-x") !== "" &&
            element.querySelector('a[href^="/juegos/"]')
          );
        if (!(card instanceof HTMLElement)) return null;
        card.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      })()
    `);
    if (state) {
      await delay(120);
      return;
    }
    await delay(100);
  }

  throw new Error(
    "No se encontró una UniversalGameCard hidratada en /juegos."
  );
}

async function readCardState(cdp) {
  return cdp.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll("article"))
        .find((element) =>
          element instanceof HTMLElement &&
          element.style.getPropertyValue("--tilt-x") !== "" &&
          element.querySelector('a[href^="/juegos/"]')
        );
      if (!(card instanceof HTMLElement)) return null;
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        offsetWidth: card.offsetWidth,
        offsetHeight: card.offsetHeight,
        active: card.getAttribute("data-tilt-active"),
        tiltX: card.style.getPropertyValue("--tilt-x"),
        tiltY: card.style.getPropertyValue("--tilt-y"),
        pointerX: card.style.getPropertyValue("--pointer-x"),
        pointerY: card.style.getPropertyValue("--pointer-y"),
        transform: getComputedStyle(card).transform,
      };
    })()
  `);
}

async function moveMouse(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    buttons: 0,
    pointerType: "mouse",
  });
}

async function captureActiveScreenshot(cdp) {
  await mkdir(outputRoot, { recursive: true });
  const capture = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await writeFile(
    screenshotPath,
    Buffer.from(capture.data, "base64")
  );
}

async function main() {
  const profileDir = await mkdtemp(
    path.join(os.tmpdir(), "deuna-card-3d-chrome-")
  );
  const browser = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--ignore-certificate-errors",
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,1000",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  let cdp = null;
  let browserError = "";
  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    browserError += chunk;
    if (browserError.length > 20_000) {
      browserError = browserError.slice(-20_000);
    }
  });

  try {
    const target = await waitForDebugger(profileDir);
    cdp = new CdpSession(
      await openWebSocket(target.webSocketDebuggerUrl)
    );
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Network.enable"),
    ]);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: 1440,
      screenHeight: 1000,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });

    await navigate(cdp, `${baseUrl}/juegos`);
    await waitForUniversalCard(cdp);

    await cdp.evaluate(`
      (() => {
        window.__deunaCard3dPointerType = null;
        document.addEventListener(
          "pointermove",
          (event) => {
            window.__deunaCard3dPointerType = event.pointerType;
          },
          { capture: true }
        );
      })()
    `);

    const mediaState = await cdp.evaluate(`({
      primaryFineHover: matchMedia("(hover: hover) and (pointer: fine)").matches,
      primaryCoarse: matchMedia("(pointer: coarse)").matches,
      anyFineHover: matchMedia("(any-hover: hover) and (any-pointer: fine)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    })`);

    if (mediaState.primaryFineHover) {
      throw new Error(
        "La prueba no reprodujo el contrato híbrido: el puntero primario siguió anunciándose fine+hover."
      );
    }

    const initial = await readCardState(cdp);
    if (!initial) {
      throw new Error("No se pudo leer el estado inicial de la Card.");
    }

    await moveMouse(cdp, 1, 1);
    await moveMouse(
      cdp,
      initial.left + initial.width * 0.78,
      initial.top + initial.height * 0.28
    );
    await delay(160);

    const active = await readCardState(cdp);
    const actualPointerType = await cdp.evaluate(
      "window.__deunaCard3dPointerType"
    );
    if (!active) {
      throw new Error("No se pudo leer la Card después del mouse.");
    }

    const tiltChanged =
      active.tiltX !== "0deg" || active.tiltY !== "0deg";
    if (
      actualPointerType !== "mouse" ||
      active.active !== "true" ||
      !tiltChanged ||
      active.transform === "none"
    ) {
      throw new Error(
        `Mouse híbrido no activó tilt real: pointer=${actualPointerType}, ` +
          `active=${active.active}, x=${active.tiltX}, y=${active.tiltY}, ` +
          `transform=${active.transform}.`
      );
    }

    if (
      active.offsetWidth !== initial.offsetWidth ||
      active.offsetHeight !== initial.offsetHeight
    ) {
      throw new Error(
        `El tilt alteró layout: ${initial.offsetWidth}x${initial.offsetHeight} -> ` +
          `${active.offsetWidth}x${active.offsetHeight}.`
      );
    }

    await captureActiveScreenshot(cdp);

    await moveMouse(cdp, 1, 1);
    await delay(160);
    const reset = await readCardState(cdp);
    if (
      !reset ||
      reset.active !== null ||
      reset.tiltX !== "0deg" ||
      reset.tiltY !== "0deg"
    ) {
      throw new Error(
        `La Card no volvió a reposo: active=${reset?.active}, ` +
          `x=${reset?.tiltX}, y=${reset?.tiltY}.`
      );
    }

    const touchX = reset.left + reset.width * 0.55;
    const touchY = reset.top + reset.height * 0.55;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: touchX, y: touchY, radiusX: 1, radiusY: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: touchX + 24,
        y: touchY + 12,
        radiusX: 1,
        radiusY: 1,
      }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await delay(120);

    const afterTouch = await readCardState(cdp);
    if (
      !afterTouch ||
      afterTouch.active !== null ||
      afterTouch.tiltX !== "0deg" ||
      afterTouch.tiltY !== "0deg"
    ) {
      throw new Error(
        `Touch activó movimiento 3D: active=${afterTouch?.active}, ` +
          `x=${afterTouch?.tiltX}, y=${afterTouch?.tiltY}.`
      );
    }

    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    await moveMouse(
      cdp,
      afterTouch.left + afterTouch.width * 0.72,
      afterTouch.top + afterTouch.height * 0.34
    );
    await delay(120);

    const reduced = await readCardState(cdp);
    const reducedMedia = await cdp.evaluate(
      'matchMedia("(prefers-reduced-motion: reduce)").matches'
    );
    if (
      !reducedMedia ||
      !reduced ||
      reduced.active !== null ||
      reduced.tiltX !== "0deg" ||
      reduced.tiltY !== "0deg"
    ) {
      throw new Error(
        `Reduced-motion no bloqueó el tilt: media=${reducedMedia}, ` +
          `active=${reduced?.active}, x=${reduced?.tiltX}, y=${reduced?.tiltY}.`
      );
    }

    console.log(
      "Universal Game Card 3D browser smoke: OK " +
        `(primaryFineHover=${mediaState.primaryFineHover}, ` +
        `primaryCoarse=${mediaState.primaryCoarse}, ` +
        `pointer=${actualPointerType}, x=${active.tiltX}, y=${active.tiltY}, ` +
        `layout=${active.offsetWidth}x${active.offsetHeight}, ` +
        "touch=sin tilt, reduced-motion=sin tilt)."
    );
  } catch (error) {
    if (browserError.trim()) {
      console.error("\nChrome stderr:\n", browserError.trim());
    }
    throw error;
  } finally {
    cdp?.close();
    browser.kill("SIGTERM");
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
