import { estimateCpuFromLogicalProcessors } from "./hardware-catalog";
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
      bitness?: string;
      platform?: string;
      platformVersion?: string;
      wow64?: boolean;
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

function bitnessSuffix(snapshot: BrowserHardwareSnapshot, userAgent: string) {
  if (snapshot.bitness === "64") return " 64-bit";
  if (snapshot.bitness === "32") return " 32-bit";

  const text = userAgent.toLowerCase();
  if (text.includes("win64") || text.includes("x64") || text.includes("wow64")) {
    return " 64-bit";
  }

  return "";
}

function detectWindowsVersion(platformVersion: string | null) {
  if (!platformVersion) return null;

  const major = Number.parseInt(platformVersion.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) return null;

  // Chromium/Edge exponen Windows 11 como platformVersion 13+ y Windows 10
  // dentro del rango legado <= 10. La UA tradicional ya no diferencia ambos.
  if (major >= 13) return "Windows 11";
  if (major >= 1 && major <= 10) return "Windows 10";

  return null;
}

function detectOs(snapshot: BrowserHardwareSnapshot, userAgent: string) {
  const platform = snapshot.platform?.toLowerCase() ?? "";
  const text = `${snapshot.platform ?? ""} ${userAgent}`.toLowerCase();
  const suffix = bitnessSuffix(snapshot, userAgent);

  if (text.includes("android")) return "Android";
  if (text.includes("iphone") || text.includes("ipad") || text.includes("ios")) return "iOS";

  if (platform.includes("windows") || text.includes("windows")) {
    const version = detectWindowsVersion(snapshot.platformVersion);
    if (version) return `${version}${suffix}`;

    // Desde la reducción de User-Agent, Windows 10 y 11 comparten a menudo
    // "Windows NT 10.0". Sin UA-CH no afirmamos una versión incorrecta.
    if (text.includes("windows nt 6.3")) return `Windows 8.1${suffix}`;
    if (text.includes("windows nt 6.2")) return `Windows 8${suffix}`;
    if (text.includes("windows nt 6.1")) return `Windows 7${suffix}`;
    return `Windows 10/11${suffix}`;
  }

  if (text.includes("mac")) return "macOS";
  if (text.includes("linux")) return `Linux${suffix}`;

  return "Sistema sin confirmar";
}

function isSpecificDetectedOs(os: string) {
  return os !== "Sistema sin confirmar" && !os.startsWith("Windows 10/11");
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
  const secureContext = window.isSecureContext;

  const logicalProcessors = Number.isFinite(nav.hardwareConcurrency)
    ? nav.hardwareConcurrency
    : null;

  const approximateMemoryGb = typeof nav.deviceMemory === "number"
    ? nav.deviceMemory
    : null;
  const memoryKind = memoryDisclosureKind(approximateMemoryGb);

  let platform: string | null = nav.userAgentData?.platform ?? nav.platform ?? null;
  let platformVersion: string | null = null;
  let architecture: string | null = null;
  let bitness: string | null = null;

  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      const values = await nav.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "platform",
        "platformVersion",
        "wow64",
      ]);
      architecture = values.architecture ?? null;
      bitness = values.bitness ?? null;
      platform = values.platform ?? platform;
      platformVersion = values.platformVersion ?? null;
    } catch {
      // Los valores de alta entropía son opcionales y dependen del navegador.
    }
  }

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

  if (!secureContext) {
    warnings.push(
      "La página usa un contexto HTTP no seguro; WebGPU y parte de la detección avanzada pueden quedar limitados."
    );
  }

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

  if (
    (platform?.toLowerCase().includes("windows") ?? false) &&
    !platformVersion
  ) {
    warnings.push("El navegador no expuso la versión de Windows; no se diferencia Windows 10 de 11.");
  }

  return {
    secureContext,
    logicalProcessors,
    approximateMemoryGb,
    memoryKind,
    gpuRenderer,
    gpuVendor,
    gpuSource,
    platform,
    platformVersion,
    architecture,
    bitness,
    warnings,
  };
}

export function profileFromBrowserSnapshot(
  snapshot: BrowserHardwareSnapshot,
  preferredProfile: HardwareProfile | null = null
): HardwareProfile {
  const detectedOs = detectOs(snapshot, navigator.userAgent);

  // CPU/GPU/RAM confirmados manualmente siguen siendo más fiables que una
  // lectura web. Una nueva detección sólo puede corregir el SO si UA-CH expone
  // una versión inequívoca; perfiles automáticos anteriores sí se recalculan.
  const confirmedProfile =
    preferredProfile?.source === "manual" ||
    preferredProfile?.source === "saved"
      ? preferredProfile
      : null;

  if (confirmedProfile) {
    const detectedIsSpecific = isSpecificDetectedOs(detectedOs);
    const useDetectedOs =
      detectedIsSpecific ||
      confirmedProfile.osConfirmed !== true;

    return {
      ...confirmedProfile,
      os: useDetectedOs ? detectedOs : confirmedProfile.os,
      osConfirmed: useDetectedOs
        ? detectedIsSpecific
        : confirmedProfile.osConfirmed,
    };
  }

  const cpu = estimateCpuFromLogicalProcessors(snapshot.logicalProcessors);
  const gpu = matchGpuRenderer(snapshot.gpuRenderer)?.gpu ?? null;

  return {
    cpu,
    gpu,
    ramGb: snapshot.approximateMemoryGb,
    ramKnowledge: snapshot.memoryKind,
    os: detectedOs,
    osConfirmed: isSpecificDetectedOs(detectedOs),
    memoryMode: "unknown",
    source: "browser",
    confidence: "low",
    updatedAt: new Date().toISOString(),
  };
}
