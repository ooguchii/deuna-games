import { estimateCpuFromLogicalProcessors } from "./hardware-catalog";
import { readStoredHardwareProfile } from "./hardware-storage";
import {
  matchGpuRenderer,
  type GpuRendererMatch,
} from "./gpu-matcher";
import type { BrowserHardwareSnapshot, HardwareProfile } from "./types";

type GpuAdapterInfo = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{
      architecture?: string;
      platform?: string;
      platformVersion?: string;
    }>;
  };
  gpu?: {
    requestAdapter: (options?: {
      powerPreference?: "low-power" | "high-performance";
    }) => Promise<{
      info?: GpuAdapterInfo;
    } | null>;
  };
};

type RawGpuReading = {
  renderer: string;
  vendor: string | null;
};

type GpuReading = RawGpuReading & {
  source: "webgpu" | "webgl";
  match: GpuRendererMatch | null;
};

function detectOs(platform: string | null, userAgent: string) {
  const text = `${platform ?? ""} ${userAgent}`.toLowerCase();

  if (text.includes("android")) return "Android";
  if (text.includes("iphone") || text.includes("ipad") || text.includes("ios")) return "iOS";
  if (text.includes("windows")) return "Windows";
  if (text.includes("mac")) return "macOS";
  if (text.includes("linux")) return "Linux";

  return "Sistema sin confirmar";
}

function memoryDisclosureKind(value: number | null): BrowserHardwareSnapshot["memoryKind"] {
  if (value === null) return "unknown";

  // deviceMemory está deliberadamente cuantizado y limitado por privacidad.
  // En Chromium, 8 GB puede representar 8 GB o una cantidad física mayor.
  if (value >= 8) return "lower-bound";

  return "approximate";
}

async function detectWebGpu(nav: NavigatorWithDeviceMemory): Promise<RawGpuReading | null> {
  if (!nav.gpu?.requestAdapter) return null;

  try {
    // En equipos híbridos Chromium puede devolver la iGPU por defecto. La
    // preferencia de alto rendimiento no es una garantía, pero permite que el
    // navegador elija la dedicada cuando la plataforma lo admite.
    const adapter =
      (await nav.gpu.requestAdapter({
        powerPreference: "high-performance",
      })) ??
      (await nav.gpu.requestAdapter());

    if (!adapter) return null;

    const info = adapter.info;
    if (!info) return null;

    const renderer = [info.vendor, info.architecture, info.device, info.description]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!renderer) return null;

    return {
      renderer,
      vendor: info.vendor ?? null,
    };
  } catch {
    return null;
  }
}

function detectWebGl(): RawGpuReading | null {
  try {
    const canvas = document.createElement("canvas");
    const attributes: WebGLContextAttributes = {
      powerPreference: "high-performance",
    };

    const gl = (
      canvas.getContext("webgl2", attributes) ||
      canvas.getContext("webgl", attributes) ||
      canvas.getContext("experimental-webgl", attributes)
    ) as WebGLRenderingContext | WebGL2RenderingContext | null;

    if (!gl) return null;

    const extension = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;

    if (!extension) return null;

    const renderer = String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) ?? "").trim();
    const vendor = String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) ?? "").trim();

    if (!renderer) return null;

    return {
      renderer,
      vendor: vendor || null,
    };
  } catch {
    return null;
  }
}

function toGpuReading(
  reading: RawGpuReading | null,
  source: GpuReading["source"]
): GpuReading | null {
  if (!reading) return null;

  return {
    ...reading,
    source,
    match: matchGpuRenderer(reading.renderer),
  };
}

function compareGpuReadings(a: GpuReading, b: GpuReading) {
  const aMatch = a.match;
  const bMatch = b.match;

  if (aMatch && bMatch) {
    const aDiscrete = !aMatch.gpu.integrated;
    const bDiscrete = !bMatch.gpu.integrated;

    // Si una API ve la dedicada y la otra sólo ve la integrada, la dedicada
    // es la candidata útil para estimar juegos.
    if (aDiscrete !== bDiscrete) {
      return aDiscrete ? -1 : 1;
    }

    if (aMatch.confidence !== bMatch.confidence) {
      return bMatch.confidence - aMatch.confidence;
    }

    if (aMatch.matchedTokens !== bMatch.matchedTokens) {
      return bMatch.matchedTokens - aMatch.matchedTokens;
    }
  } else if (aMatch || bMatch) {
    return aMatch ? -1 : 1;
  }

  // En empate preferimos WebGL: en ANGLE suele conservar un nombre comercial
  // más útil que los campos genéricos de adapter.info.
  if (a.source !== b.source) {
    return a.source === "webgl" ? -1 : 1;
  }

  return b.renderer.length - a.renderer.length;
}

function chooseGpuReading(
  webGpu: RawGpuReading | null,
  webGl: RawGpuReading | null
) {
  const candidates = [
    toGpuReading(webGpu, "webgpu"),
    toGpuReading(webGl, "webgl"),
  ].filter((item): item is GpuReading => Boolean(item));

  return candidates.sort(compareGpuReadings)[0] ?? null;
}

export async function detectBrowserHardware(): Promise<BrowserHardwareSnapshot> {
  const nav = navigator as NavigatorWithDeviceMemory;
  const warnings: string[] = [];

  const logicalProcessors = Number.isFinite(nav.hardwareConcurrency)
    ? nav.hardwareConcurrency
    : null;

  const approximateMemoryGb = typeof nav.deviceMemory === "number"
    ? nav.deviceMemory
    : null;
  const memoryKind = memoryDisclosureKind(approximateMemoryGb);

  let platform: string | null = nav.userAgentData?.platform ?? nav.platform ?? null;
  let architecture: string | null = null;

  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      const values = await nav.userAgentData.getHighEntropyValues([
        "architecture",
        "platform",
        "platformVersion",
      ]);
      architecture = values.architecture ?? null;
      platform = values.platform ?? platform;
    } catch {
      // La detección de alto nivel es opcional.
    }
  }

  // Consultamos las dos APIs. Antes se aceptaba WebGPU apenas reconocía algo,
  // lo que en PCs híbridas podía fijar la integrada sin llegar a comparar la
  // dedicada expuesta por WebGL.
  const [webGpu, webGl] = await Promise.all([
    detectWebGpu(nav),
    Promise.resolve(detectWebGl()),
  ]);

  const selectedGpu = chooseGpuReading(webGpu, webGl);
  const webGpuMatch = webGpu ? matchGpuRenderer(webGpu.renderer) : null;
  const webGlMatch = webGl ? matchGpuRenderer(webGl.renderer) : null;

  const gpuRenderer = selectedGpu?.renderer ?? null;
  const gpuVendor = selectedGpu?.vendor ?? null;
  const gpuSource: BrowserHardwareSnapshot["gpuSource"] =
    selectedGpu?.source ?? "none";

  if (!logicalProcessors) {
    warnings.push("El navegador no informó procesadores lógicos.");
  } else {
    warnings.push("El navegador informa hilos lógicos, no el modelo exacto de CPU.");
  }

  if (!approximateMemoryGb) {
    warnings.push("El navegador no expuso una estimación de RAM.");
  } else if (memoryKind === "lower-bound") {
    warnings.push("La RAM visible es un límite de privacidad: 8 GB puede significar 8 GB o más.");
  } else {
    warnings.push("La RAM del navegador es una aproximación redondeada, no una lectura física exacta.");
  }

  if (
    webGpuMatch?.gpu.integrated &&
    webGlMatch &&
    !webGlMatch.gpu.integrated &&
    selectedGpu?.source === "webgl"
  ) {
    warnings.push(
      "WebGPU expuso una integrada y WebGL identificó una GPU dedicada; se priorizó la dedicada."
    );
  }

  if (!gpuRenderer) {
    warnings.push("La GPU quedó protegida por el navegador o no pudo identificarse.");
  } else if (!selectedGpu?.match) {
    warnings.push("El navegador expuso la GPU, pero el modelo todavía no está en el catálogo de equivalencias.");
  }

  return {
    logicalProcessors,
    approximateMemoryGb,
    memoryKind,
    gpuRenderer,
    gpuVendor,
    gpuSource,
    platform,
    architecture,
    warnings,
  };
}

export function profileFromBrowserSnapshot(snapshot: BrowserHardwareSnapshot): HardwareProfile {
  // Un perfil confirmado manualmente es más fiable que una relectura del
  // navegador. "Detectar otra vez" refresca el snapshot, pero no debe borrar
  // CPU/RAM/GPU confirmadas por el usuario.
  const storedProfile = readStoredHardwareProfile();
  if (storedProfile) {
    return storedProfile;
  }

  const cpu = estimateCpuFromLogicalProcessors(snapshot.logicalProcessors);
  const gpu = matchGpuRenderer(snapshot.gpuRenderer)?.gpu ?? null;

  return {
    cpu,
    gpu,
    ramGb: snapshot.approximateMemoryGb,
    ramKnowledge: snapshot.memoryKind,
    os: detectOs(snapshot.platform, navigator.userAgent),
    memoryMode: "unknown",
    source: "browser",
    // Ningún navegador web estándar expone el modelo exacto de CPU y la RAM
    // está cuantizada. Por eso un perfil puramente automático permanece en
    // confianza baja aunque la GPU sí se reconozca.
    confidence: "low",
    updatedAt: new Date().toISOString(),
  };
}
