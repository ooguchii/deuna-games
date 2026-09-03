export const MAX_ADMIN_VIDEO_FRAME_DIMENSION = 640;
export const MAX_ADMIN_VIDEO_FRAME_CACHE_ENTRIES = 72;
export const MAX_ADMIN_VIDEO_FRAME_DECODES = 2;

const ADMIN_VIDEO_FRAME_TIME_SECONDS = 0.35;
const ADMIN_VIDEO_FRAME_END_GUARD_SECONDS = 0.05;
const ADMIN_VIDEO_FRAME_TIMEOUT_MS = 15_000;

export type AdminVideoFrameStatus =
  | "idle"
  | "queued"
  | "loading"
  | "ready"
  | "error";

export type AdminVideoFrameSnapshot = {
  status: AdminVideoFrameStatus;
  url: string | null;
  width: number;
  height: number;
  error: string | null;
};

type AdminVideoFrameListener = (snapshot: AdminVideoFrameSnapshot) => void;

type AdminVideoFrameEntry = AdminVideoFrameSnapshot & {
  src: string;
  listeners: Set<AdminVideoFrameListener>;
  lastUsed: number;
};

type CapturedAdminVideoFrame = {
  url: string;
  width: number;
  height: number;
};

const entries = new Map<string, AdminVideoFrameEntry>();
const decodeQueue: string[] = [];
let activeDecodes = 0;
let lifecycleRegistered = false;

function snapshot(entry: AdminVideoFrameEntry): AdminVideoFrameSnapshot {
  return {
    status: entry.status,
    url: entry.url,
    width: entry.width,
    height: entry.height,
    error: entry.error,
  };
}

function touch(entry: AdminVideoFrameEntry) {
  entry.lastUsed = Date.now();
}

function notify(entry: AdminVideoFrameEntry) {
  const current = snapshot(entry);
  entry.listeners.forEach((listener) => listener(current));
}

function getOrCreateEntry(src: string) {
  const current = entries.get(src);
  if (current) return current;

  const entry: AdminVideoFrameEntry = {
    src,
    status: "idle",
    url: null,
    width: 0,
    height: 0,
    error: null,
    listeners: new Set(),
    lastUsed: Date.now(),
  };
  entries.set(src, entry);
  return entry;
}

function releaseFrame(entry: AdminVideoFrameEntry) {
  if (entry.url) URL.revokeObjectURL(entry.url);
  entry.status = "idle";
  entry.url = null;
  entry.width = 0;
  entry.height = 0;
  entry.error = null;
  notify(entry);
}

function enforceCacheLimit() {
  const readyEntries = [...entries.values()]
    .filter((entry) => entry.status === "ready" && entry.url)
    .sort((left, right) => left.lastUsed - right.lastUsed);

  while (readyEntries.length > MAX_ADMIN_VIDEO_FRAME_CACHE_ENTRIES) {
    const oldest = readyEntries.shift();
    if (oldest) releaseFrame(oldest);
  }
}

function disposeVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}

function captureAdminVideoFrame(src: string): Promise<CapturedAdminVideoFrame> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    let captureScheduled = false;
    let frameCallbackId: number | null = null;
    let animationFrameId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      finishError(new Error("La decodificación del fotograma excedió el tiempo disponible."));
    }, ADMIN_VIDEO_FRAME_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeoutId);
      if (frameCallbackId !== null) {
        video.cancelVideoFrameCallback(frameCallbackId);
      }
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      disposeVideo(video);
    }

    function finishError(reason: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    }

    function finishSuccess(frame: CapturedAdminVideoFrame) {
      if (settled) {
        URL.revokeObjectURL(frame.url);
        return;
      }
      settled = true;
      cleanup();
      resolve(frame);
    }

    function encodeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
      const complete = (blob: Blob | null, fallback = false) => {
        if (settled) return;
        if (!blob && !fallback) {
          canvas.toBlob(
            (pngBlob) => complete(pngBlob, true),
            "image/png"
          );
          return;
        }
        if (!blob) {
          finishError(new Error("El navegador no pudo codificar el fotograma temporal."));
          return;
        }
        finishSuccess({
          url: URL.createObjectURL(blob),
          width,
          height,
        });
      };

      canvas.toBlob(
        (blob) => complete(blob),
        "image/webp",
        0.78
      );
    }

    function drawFrame() {
      if (settled) return;
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        finishError(new Error("El video no informó dimensiones válidas."));
        return;
      }

      const reduction = Math.min(
        1,
        MAX_ADMIN_VIDEO_FRAME_DIMENSION / Math.max(sourceWidth, sourceHeight)
      );
      const width = Math.max(1, Math.round(sourceWidth * reduction));
      const height = Math.max(1, Math.round(sourceHeight * reduction));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        finishError(new Error("El navegador no pudo preparar la vista temporal."));
        return;
      }

      try {
        context.drawImage(video, 0, 0, width, height);
      } catch {
        finishError(new Error("El navegador no pudo leer el fotograma del video."));
        return;
      }
      encodeCanvas(canvas, width, height);
    }

    function scheduleCapture() {
      if (captureScheduled || settled) return;
      captureScheduled = true;
      if (typeof video.requestVideoFrameCallback === "function") {
        frameCallbackId = video.requestVideoFrameCallback(() => drawFrame());
      } else {
        animationFrameId = window.requestAnimationFrame(() => drawFrame());
      }
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.onerror = () => {
      finishError(new Error("El navegador no pudo abrir el WebM interno."));
    };
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration)
        ? video.duration
        : ADMIN_VIDEO_FRAME_TIME_SECONDS + ADMIN_VIDEO_FRAME_END_GUARD_SECONDS;
      const targetTime = Math.min(
        ADMIN_VIDEO_FRAME_TIME_SECONDS,
        Math.max(0, duration - ADMIN_VIDEO_FRAME_END_GUARD_SECONDS)
      );

      if (targetTime > 0) {
        video.onseeked = scheduleCapture;
        try {
          video.currentTime = targetTime;
        } catch {
          finishError(new Error("El navegador no pudo buscar un fotograma del video."));
        }
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        scheduleCapture();
      } else {
        video.onloadeddata = scheduleCapture;
      }
    };
    video.src = src;
    video.load();
  });
}

function registerLifecycleCleanup() {
  if (lifecycleRegistered || typeof window === "undefined") return;
  lifecycleRegistered = true;
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) clearAdminVideoFrameCache();
  });
}

async function runDecode(entry: AdminVideoFrameEntry) {
  entry.status = "loading";
  entry.error = null;
  touch(entry);
  notify(entry);

  try {
    const frame = await captureAdminVideoFrame(entry.src);
    if (entries.get(entry.src) !== entry) {
      URL.revokeObjectURL(frame.url);
      return;
    }
    if (entry.listeners.size === 0) {
      URL.revokeObjectURL(frame.url);
      entries.delete(entry.src);
      return;
    }
    if (entry.url) URL.revokeObjectURL(entry.url);
    entry.status = "ready";
    entry.url = frame.url;
    entry.width = frame.width;
    entry.height = frame.height;
    entry.error = null;
    touch(entry);
    notify(entry);
    enforceCacheLimit();
  } catch (reason) {
    if (entries.get(entry.src) !== entry) return;
    if (entry.listeners.size === 0) {
      entries.delete(entry.src);
      return;
    }
    entry.status = "error";
    entry.url = null;
    entry.width = 0;
    entry.height = 0;
    entry.error = reason instanceof Error
      ? reason.message
      : "No se pudo generar la vista temporal.";
    touch(entry);
    notify(entry);
  }
}

function drainDecodeQueue() {
  while (
    activeDecodes < MAX_ADMIN_VIDEO_FRAME_DECODES &&
    decodeQueue.length > 0
  ) {
    const src = decodeQueue.shift();
    if (!src) continue;
    const entry = entries.get(src);
    if (!entry || entry.status !== "queued") continue;

    activeDecodes += 1;
    void runDecode(entry).finally(() => {
      activeDecodes -= 1;
      drainDecodeQueue();
    });
  }
}

export function getAdminVideoFrameSnapshot(src: string) {
  return snapshot(getOrCreateEntry(src));
}

export function subscribeAdminVideoFrame(
  src: string,
  listener: AdminVideoFrameListener
) {
  const entry = getOrCreateEntry(src);
  entry.listeners.add(listener);
  touch(entry);
  listener(snapshot(entry));
  registerLifecycleCleanup();

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0 || entry.status === "loading") return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    entries.delete(src);
  };
}

export function requestAdminVideoFrame(src: string) {
  const entry = getOrCreateEntry(src);
  touch(entry);
  if (
    entry.status === "ready" ||
    entry.status === "queued" ||
    entry.status === "loading"
  ) {
    return;
  }

  entry.status = "queued";
  entry.error = null;
  decodeQueue.push(src);
  notify(entry);
  registerLifecycleCleanup();
  drainDecodeQueue();
}

export function retryAdminVideoFrame(src: string) {
  const entry = getOrCreateEntry(src);
  if (entry.status !== "error") {
    requestAdminVideoFrame(src);
    return;
  }
  entry.status = "idle";
  entry.error = null;
  requestAdminVideoFrame(src);
}

export function clearAdminVideoFrameCache() {
  decodeQueue.length = 0;
  entries.forEach((entry) => {
    if (entry.url) URL.revokeObjectURL(entry.url);
  });
  entries.clear();
}
