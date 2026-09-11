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
  "card-hover-low-resolution.png"
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
    "Game Card hover low-resolution smoke necesita Chrome/Chromium disponible."
  );
}

async function waitForDebugger(profileDir) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(activePortPath, "utf8");
      const port = Number.parseInt(raw.split(/\r?\n/, 1)[0] ?? "", 10);
      if (!Number.isFinite(port)) throw new Error("Puerto DevTools inválido.");

      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) => target.type === "page" && target.webSocketDebuggerUrl
        );
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome puede tardar unos milisegundos en publicar DevToolsActivePort.
    }

    await delay(100);
  }

  throw new Error("Chrome no expuso DevTools a tiempo.");
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

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      } else {
        pending.resolve(message.result ?? {});
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
  const navigation = await cdp.send("Page.navigate", { url });
  if (navigation.errorText) {
    throw new Error(`No se pudo navegar a ${url}: ${navigation.errorText}`);
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if ((await cdp.evaluate("document.readyState")) === "complete") {
      await delay(500);
      return;
    }
    await delay(100);
  }

  throw new Error(`La página no terminó de cargar: ${url}.`);
}

async function waitForCard(cdp, selector) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const ready = await cdp.evaluate(`
      (() => {
        const card = document.querySelector(${JSON.stringify(selector)});
        if (!(card instanceof HTMLElement)) return false;
        const hydrated = Object.keys(card).some((key) =>
          key.startsWith("__reactProps$") || key.startsWith("__reactFiber$")
        );
        if (!hydrated) return false;
        card.scrollIntoView({ block: "center", inline: "center" });
        return true;
      })()
    `);
    if (ready) {
      await delay(250);
      return;
    }
    await delay(100);
  }

  throw new Error(`No apareció una Card hidratada para ${selector}.`);
}

async function cardProbe(cdp, selector) {
  return cdp.evaluate(`
    (() => {
      const card = document.querySelector(${JSON.stringify(selector)});
      if (!(card instanceof HTMLElement)) return null;
      const slot = card.closest('[data-game-card-slot="true"]');
      const detail = card.querySelector('[data-card-face="detail"]');
      const content = card.querySelector('[data-card-detail-content="true"]');
      const description = card.querySelector('[data-card-description="true"]');
      const title = card.querySelector('[data-card-title-row="true"] h3');
      if (
        !(slot instanceof HTMLElement) ||
        !(detail instanceof HTMLElement) ||
        !(content instanceof HTMLElement) ||
        !(title instanceof HTMLElement)
      ) return null;

      const cardRect = card.getBoundingClientRect();
      const detailRect = detail.getBoundingClientRect();
      const detailCenter = document.elementFromPoint(
        detailRect.left + detailRect.width / 2,
        detailRect.top + detailRect.height / 2
      );
      const contentStyle = getComputedStyle(content);
      const descriptionStyle = description instanceof HTMLElement
        ? getComputedStyle(description)
        : null;
      const titleStyle = getComputedStyle(title);

      return {
        expanded: card.getAttribute("data-card-expanded"),
        scale: Number(card.getAttribute("data-card-expansion-scale")),
        position: getComputedStyle(card).position,
        slotWidth: slot.offsetWidth,
        slotHeight: slot.offsetHeight,
        cardOffsetWidth: card.offsetWidth,
        cardOffsetHeight: card.offsetHeight,
        cardRect: {
          left: cardRect.left,
          top: cardRect.top,
          width: cardRect.width,
          height: cardRect.height,
        },
        detailRect: {
          left: detailRect.left,
          top: detailRect.top,
          right: detailRect.right,
          bottom: detailRect.bottom,
          width: detailRect.width,
          height: detailRect.height,
        },
        detailHitInside: detailCenter instanceof Element && card.contains(detailCenter),
        contentOverflowY: contentStyle.overflowY,
        contentClientHeight: content.clientHeight,
        contentScrollHeight: content.scrollHeight,
        hasDescription: description instanceof HTMLElement,
        descriptionDisplay: descriptionStyle?.display ?? null,
        descriptionClamp: descriptionStyle?.webkitLineClamp ?? null,
        titleClamp: titleStyle.webkitLineClamp,
        pageOverflowX:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewport: {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
        },
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

async function activateCard(cdp, selector) {
  const initial = await cardProbe(cdp, selector);
  if (!initial) throw new Error(`No se pudo medir ${selector}.`);

  const x = initial.cardRect.left + initial.cardRect.width / 2;
  const y = initial.cardRect.top + initial.cardRect.height / 2;
  await moveMouse(cdp, 1, 1);
  await moveMouse(cdp, x, y);
  await delay(300);

  return { initial, active: await cardProbe(cdp, selector) };
}

function assertExpanded({ initial, active }, label) {
  if (!active) throw new Error(`${label}: la Card desapareció tras hover.`);
  if (active.expanded !== "true" || active.position !== "fixed") {
    throw new Error(`${label}: no activó expansión fixed: ${JSON.stringify(active)}.`);
  }
  if (active.scale < 1.35 || active.scale > 1.46) {
    throw new Error(`${label}: escala fuera del contrato 1.35..1.46: ${active.scale}.`);
  }
  if (
    active.slotWidth !== initial.slotWidth ||
    active.slotHeight !== initial.slotHeight ||
    active.cardOffsetWidth !== initial.cardOffsetWidth ||
    active.cardOffsetHeight !== initial.cardOffsetHeight
  ) {
    throw new Error(
      `${label}: la expansión alteró el layout base: ` +
        `${initial.slotWidth}x${initial.slotHeight} -> ` +
        `${active.slotWidth}x${active.slotHeight}; article ` +
        `${initial.cardOffsetWidth}x${initial.cardOffsetHeight} -> ` +
        `${active.cardOffsetWidth}x${active.cardOffsetHeight}.`
    );
  }
  if (active.detailRect.width < initial.slotWidth * 1.35) {
    throw new Error(`${label}: el detalle no creció de forma sustancial: ${JSON.stringify(active)}.`);
  }
  if (
    active.detailRect.left < -1 ||
    active.detailRect.top < -1 ||
    active.detailRect.right > active.viewport.width + 1 ||
    active.detailRect.bottom > active.viewport.height + 1
  ) {
    throw new Error(`${label}: el detalle expandido quedó fuera del viewport: ${JSON.stringify(active)}.`);
  }
  if (!active.detailHitInside) {
    throw new Error(`${label}: el detalle expandido quedó tapado o recortado.`);
  }
  if (active.contentOverflowY !== "auto" || active.contentClientHeight <= 0) {
    throw new Error(`${label}: el texto no quedó accesible en el detalle.`);
  }
  if (
    active.hasDescription &&
    (active.descriptionDisplay !== "block" || active.descriptionClamp !== "none")
  ) {
    throw new Error(`${label}: la descripción sigue truncada: ${JSON.stringify(active)}.`);
  }
  if (active.titleClamp !== "none") {
    throw new Error(`${label}: el título sigue truncado: ${JSON.stringify(active)}.`);
  }
  if (active.pageOverflowX > 1) {
    throw new Error(`${label}: el hover creó overflow horizontal (${active.pageOverflowX}px).`);
  }
}

async function capture(cdp) {
  await mkdir(outputRoot, { recursive: true });
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

async function assertLowSpecReadable(cdp) {
  const selector = 'article[data-card-variant="lowSpec"]';
  await navigate(cdp, `${baseUrl}/`);
  await waitForCard(cdp, selector);
  const state = await activateCard(cdp, selector);
  assertExpanded(state, "Home lowSpec");

  const requirements = await cdp.evaluate(`
    (() => {
      const card = document.querySelector(${JSON.stringify(selector)});
      const rows = card?.querySelectorAll('[data-card-requirements="true"] p');
      if (!rows || rows.length !== 3) return null;
      return Array.from(rows).map((row) => ({
        whiteSpace: getComputedStyle(row).whiteSpace,
        textOverflow: getComputedStyle(row).textOverflow,
      }));
    })()
  `);

  if (
    !requirements ||
    requirements.some(
      (row) => row.whiteSpace !== "normal" || row.textOverflow !== "clip"
    )
  ) {
    throw new Error(
      `Home lowSpec: RAM/GPU/SO siguen elipsados: ${JSON.stringify(requirements)}.`
    );
  }

  await moveMouse(cdp, 1, 1);
  await delay(180);
}

async function main() {
  const profileDir = await mkdtemp(
    path.join(os.tmpdir(), "deuna-card-hover-lowres-")
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
      "--window-size=1024,640",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  let cdp = null;
  let browserError = "";
  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    browserError += chunk;
    if (browserError.length > 20_000) browserError = browserError.slice(-20_000);
  });

  try {
    cdp = new CdpSession(await openWebSocket(await waitForDebugger(profileDir)));
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
    ]);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 640,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1024,
      screenHeight: 640,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });

    const selector = 'article[data-card-variant="standard"]';
    await navigate(cdp, `${baseUrl}/juegos?vista=compact`);
    await waitForCard(cdp, selector);
    const catalogState = await activateCard(cdp, selector);
    assertExpanded(catalogState, "Catálogo compacto 1024x640");
    await capture(cdp);

    await moveMouse(cdp, 1, 1);
    await delay(180);
    const reset = await cardProbe(cdp, selector);
    if (!reset || reset.expanded !== "false" || reset.position === "fixed") {
      throw new Error(
        `Catálogo compacto: la Card no volvió a su geometría de slot: ${JSON.stringify(reset)}.`
      );
    }

    await assertLowSpecReadable(cdp);

    console.log(
      "Game Card hover low-resolution browser smoke: OK " +
        `(viewport=1024x640, scale=${catalogState.active.scale.toFixed(3)}, ` +
        "catálogo=legible/sin clipping, Home lowSpec=RAM-GPU-SO legibles, layout estable)."
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