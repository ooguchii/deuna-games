import { estimateCpuFromLogicalProcessors, findGpuByRenderer } from "./hardware-catalog";
import type { BrowserHardwareSnapshot, HardwareProfile } from "./types";

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
    requestAdapter: () => Promise<{
      info?: {
        vendor?: string;
        architecture?: string;
        device?: string;
        description?: string;
      };
    } | null>;
  };
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

async function detectWebGpu(nav: NavigatorWithDeviceMemory) {
  if (!nav.gpu?.requestAdapter) return null;

  try {
    const adapter = await nav.gpu.requestAdapter();
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

function detectWebGl() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

    if (!gl) return null;

    const extension = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;

    if (!extension) return null;

    const renderer = String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) ?? "");
    const vendor = String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) ?? "");

    if (!renderer) return null;

    return { renderer, vendor: vendor || null };
  } catch {
    return null;
  }
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

  let gpuRenderer: string | null = null;
  let gpuVendor: string | null = null;
  let gpuSource: BrowserHardwareSnapshot["gpuSource"] = "none";

  const webGpu = await detectWebGpu(nav);
  const webGpuRecognized = webGpu ? findGpuByRenderer(webGpu.renderer) : null;

  if (webGpu && webGpuRecognized) {
    gpuRenderer = webGpu.renderer;
    gpuVendor = webGpu.vendor;
    gpuSource = "webgpu";
  } else {
    const webGl = detectWebGl();

    if (webGl) {
      gpuRenderer = webGl.renderer;
      gpuVendor = webGl.vendor;
      gpuSource = "webgl";
    } else if (webGpu) {
      gpuRenderer = webGpu.renderer;
      gpuVendor = webGpu.vendor;
      gpuSource = "webgpu";
    }
  }

  if (!logicalProcessors) warnings.push("El navegador no informó procesadores lógicos.");
  if (!approximateMemoryGb) warnings.push("El navegador no expuso una estimación de RAM.");
  if (!gpuRenderer) {
    warnings.push("La GPU quedó protegida por el navegador o no pudo identificarse.");
  } else if (!findGpuByRenderer(gpuRenderer)) {
    warnings.push("El navegador expuso la GPU, pero el modelo todavía no está en el catálogo de equivalencias.");
  }

  return {
    logicalProcessors,
    approximateMemoryGb,
    gpuRenderer,
    gpuVendor,
    gpuSource,
    platform,
    architecture,
    warnings,
  };
}

export function profileFromBrowserSnapshot(snapshot: BrowserHardwareSnapshot): HardwareProfile {
  const cpu = estimateCpuFromLogicalProcessors(snapshot.logicalProcessors);
  const gpu = findGpuByRenderer(snapshot.gpuRenderer);

  const knownPieces = [cpu, gpu, snapshot.approximateMemoryGb].filter(Boolean).length;
  const confidence = gpu && knownPieces === 3 ? "medium" : "low";

  return {
    cpu,
    gpu,
    ramGb: snapshot.approximateMemoryGb,
    os: detectOs(snapshot.platform, navigator.userAgent),
    memoryMode: "unknown",
    source: "browser",
    confidence,
    updatedAt: new Date().toISOString(),
  };
}
