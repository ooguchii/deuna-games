import { spawn, spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (
  process.env.DEUNA_VISUAL_BASE_URL ?? "https://127.0.0.1:3443"
).replace(/\/$/, "");
const outputRoot = path.resolve(
  process.env.DEUNA_VISUAL_OUTPUT_DIR ?? "artifacts/visual-smoke"
);
const fixturePath = path.join(outputRoot, "card-video-fixture.json");
const screenshotPath = path.join(
  outputRoot,
  "card-video-active-desktop.png"
);

function assertVisualCiOnly() {
  if (
    process.env.DEUNA_CARD_VIDEO_VISUAL_FIXTURE !== "1" ||
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true"
  ) {
    throw new Error(
      "Card video browser smoke sólo puede ejecutarse con el fixture visual aislado de GitHub Actions."
    );
  }
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

  throw new Error("Card video browser smoke necesita Chrome/Chromium.");
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

  waitFor(method, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout esperando ${method}.`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (params) => {
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

function cardLookup(slug) {
  return `
    (() => {
      const link = document.querySelector('a[href="/juegos/${slug}"]');
      return link instanceof Element ? link.closest("article") : null;
    })()
  `;
}

async function waitFor(cdp, expression, description, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;

  while (Date.now() < deadline) {
    lastValue = await cdp.evaluate(expression);
    if (lastValue) return lastValue;
    await delay(100);
  }

  throw new Error(
    `${description}. Último estado: ${JSON.stringify(lastValue)}.`
  );
}

function playingVideoExpression(lookup) {
  return `(() => {
    const card = ${lookup};
    const video = card?.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) return false;
    if (
      video.paused ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return false;
    }
    return {
      src: new URL(video.currentSrc || video.src, location.href).pathname,
      autoplay: video.autoplay,
      muted: video.muted,
      loop: video.loop,
      playsInline: video.playsInline,
      readyState: video.readyState,
      paused: video.paused,
      currentTime: video.currentTime,
      hidden: document.hidden,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  })()`;
}

async function main() {
  assertVisualCiOnly();
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  if (!fixture.slug || !fixture.clip) {
    throw new Error("El descriptor del fixture Card video es inválido.");
  }

  const profileDir = await mkdtemp(
    path.join(os.tmpdir(), "deuna-card-video-chrome-")
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
      mobile: false,
      screenWidth: 1440,
      screenHeight: 1000,
    });
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "no-preference" },
      ],
    });

    await navigate(cdp, `${baseUrl}/juegos`);
    const lookup = cardLookup(fixture.slug);

    await waitFor(
      cdp,
      `(() => {
        const card = ${lookup};
        if (
          !(card instanceof HTMLElement) ||
          document.readyState !== "complete"
        ) {
          return false;
        }
        card.scrollIntoView({ block: "center", inline: "nearest" });
        return Object.keys(card).some((key) =>
          key.startsWith("__reactProps$") ||
          key.startsWith("__reactFiber$")
        );
      })()`,
      "No se hidrató la Card publicada del fixture"
    );
    await delay(300);

    const asset = await cdp.evaluate(`
      fetch(${JSON.stringify(fixture.clip)}, { cache: "no-store" })
        .then(async (response) => ({
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type"),
          bytes: (await response.arrayBuffer()).byteLength,
        }))
    `);
    if (
      !asset?.ok ||
      asset.status !== 200 ||
      asset.bytes < 128 ||
      !String(asset.contentType ?? "")
        .toLowerCase()
        .includes("video/webm")
    ) {
      throw new Error(
        `El WebM aislado no se sirvió correctamente: ${JSON.stringify(asset)}.`
      );
    }

    const visibleState = await waitFor(
      cdp,
      playingVideoExpression(lookup),
      "La Card publicada no llegó a reproducir el video continuo"
    );
    if (
      visibleState.src !== fixture.clip ||
      !visibleState.autoplay ||
      !visibleState.muted ||
      !visibleState.loop ||
      !visibleState.playsInline ||
      visibleState.paused ||
      visibleState.readyState < 2 ||
      visibleState.hidden ||
      visibleState.reduced
    ) {
      throw new Error(
        `El estado visible del video no respeta el contrato: ${JSON.stringify(visibleState)}.`
      );
    }

    const capture = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    await writeFile(
      screenshotPath,
      Buffer.from(capture.data, "base64")
    );

    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    await waitFor(
      cdp,
      `(() => {
        const card = ${lookup};
        return Boolean(
          card &&
          matchMedia("(prefers-reduced-motion: reduce)").matches &&
          !card.querySelector("video")
        );
      })()`,
      "Reduced-motion no desmontó el video de Card"
    );

    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "no-preference" },
      ],
    });
    const resumedState = await waitFor(
      cdp,
      playingVideoExpression(lookup),
      "Al restaurar movimiento el video de Card no volvió a reproducirse"
    );
    if (
      resumedState.src !== fixture.clip ||
      resumedState.paused ||
      resumedState.readyState < 2 ||
      resumedState.reduced
    ) {
      throw new Error(
        `El video no reanudó correctamente tras reduced-motion: ${JSON.stringify(resumedState)}.`
      );
    }

    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    await delay(150);
    const hiddenState = await cdp.evaluate(`(() => {
      const card = ${lookup};
      return {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        hasVideo: Boolean(card?.querySelector("video")),
      };
    })()`);
    if (
      !hiddenState?.hidden ||
      hiddenState.visibilityState !== "hidden" ||
      hiddenState.hasVideo
    ) {
      throw new Error(
        `La pestaña oculta no desmontó el video de Card: ${JSON.stringify(hiddenState)}.`
      );
    }

    console.log(
      "Card video browser smoke: OK " +
        `(slug=${fixture.slug}, bytes=${asset.bytes}, ` +
        `readyState=${visibleState.readyState}, visible=reproduciendo, ` +
        "reduced-motion=sin video, restored=reproduciendo, hidden=sin video)."
    );
  } catch (error) {
    if (browserError.trim()) {
      console.error("\nChrome stderr:\n", browserError.trim());
    }
    throw error;
  } finally {
    cdp?.close();
    browser.kill("SIGTERM");
    await delay(100);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();