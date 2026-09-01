"use client";

import type { GameYouTubePreview } from "@/types/game";

const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
const ALLOWED_MESSAGE_ORIGINS = new Set([
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
]);
const PLAYER_ID = "deuna-shared-youtube-hover-player";
const IDLE_DESTROY_MS = 60_000;
const MIN_PLAYER_EDGE_PX = 200;
const MIN_HIDDEN_PLAYBACK_MS = 900;

type ActiveRequest = {
  target: HTMLElement;
  preview: GameYouTubePreview;
};

type PlayerMessage = {
  event?: unknown;
  info?: unknown;
};

type SharedPlayerState = {
  wrapper: HTMLDivElement | null;
  iframe: HTMLIFrameElement | null;
  active: ActiveRequest | null;
  ready: boolean;
  revealRequested: boolean;
  playingSince: number | null;
  revealTimer: ReturnType<typeof setTimeout> | null;
  positionFrame: number | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  resizeObserver: ResizeObserver | null;
  listenersInstalled: boolean;
};

const state: SharedPlayerState = {
  wrapper: null,
  iframe: null,
  active: null,
  ready: false,
  revealRequested: false,
  playingSince: null,
  revealTimer: null,
  positionFrame: null,
  idleTimer: null,
  resizeObserver: null,
  listenersInstalled: false,
};

function parseMessage(value: unknown): PlayerMessage | null {
  if (typeof value === "object" && value !== null) {
    return value as PlayerMessage;
  }

  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as PlayerMessage)
      : null;
  } catch {
    return null;
  }
}

function sendMessage(payload: Record<string, unknown>) {
  state.iframe?.contentWindow?.postMessage(
    JSON.stringify(payload),
    PLAYER_ORIGIN
  );
}

function sendCommand(func: string, args: unknown[] = []) {
  sendMessage({
    event: "command",
    func,
    args,
    id: PLAYER_ID,
  });
}

function hidePlayer() {
  const wrapper = state.wrapper;
  if (!wrapper) return;

  wrapper.style.opacity = "0";
  wrapper.style.visibility = "hidden";
}

function keepPlayerRenderingInvisible() {
  const wrapper = state.wrapper;
  if (!wrapper || !state.active) return;

  syncPlacementNow();
  wrapper.style.visibility = "visible";
  wrapper.style.opacity = "0";
}

function showPlayer() {
  const wrapper = state.wrapper;
  if (!wrapper || !state.active) return;

  syncPlacementNow();
  wrapper.style.visibility = "visible";
  wrapper.style.opacity = "1";
}

function placementFor(target: HTMLElement) {
  if (!target.isConnected) return null;

  const rect = target.getBoundingClientRect();
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= window.innerHeight ||
    rect.left >= window.innerWidth
  ) {
    return null;
  }

  const card = target.closest("article");
  const radius = card
    ? getComputedStyle(card).borderTopLeftRadius
    : "0px";

  return { rect, radius };
}

function syncPlacementNow() {
  const wrapper = state.wrapper;
  const iframe = state.iframe;
  const active = state.active;

  if (!wrapper || !iframe || !active) {
    hidePlayer();
    return;
  }

  const placement = placementFor(active.target);
  if (!placement) {
    hidePlayer();
    return;
  }

  const { rect, radius } = placement;
  wrapper.style.top = `${rect.top}px`;
  wrapper.style.left = `${rect.left}px`;
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = `${rect.height}px`;
  wrapper.style.borderRadius = `${radius} ${radius} 0 0`;

  iframe.width = String(Math.max(MIN_PLAYER_EDGE_PX, Math.round(rect.width)));
  iframe.height = String(Math.max(MIN_PLAYER_EDGE_PX, Math.round(rect.height)));
}

function schedulePlacementSync() {
  if (state.positionFrame !== null) return;

  state.positionFrame = requestAnimationFrame(() => {
    state.positionFrame = null;
    syncPlacementNow();
  });
}

function cancelRevealTimer() {
  if (!state.revealTimer) return;
  clearTimeout(state.revealTimer);
  state.revealTimer = null;
}

function scheduleRevealIfReady() {
  cancelRevealTimer();

  if (
    !state.active ||
    !state.revealRequested ||
    state.playingSince === null ||
    document.hidden
  ) {
    return;
  }

  const elapsed = performance.now() - state.playingSince;
  const remaining = Math.max(0, MIN_HIDDEN_PLAYBACK_MS - elapsed);

  if (remaining === 0) {
    showPlayer();
    return;
  }

  state.revealTimer = setTimeout(() => {
    state.revealTimer = null;
    if (
      state.active &&
      state.revealRequested &&
      state.playingSince !== null &&
      !document.hidden
    ) {
      showPlayer();
    }
  }, remaining);
}

function playActive() {
  const active = state.active;
  if (!active || !state.ready || document.hidden) return;

  cancelRevealTimer();
  state.playingSince = null;
  keepPlayerRenderingInvisible();
  sendCommand("mute");
  sendCommand("loadVideoById", [
    {
      videoId: active.preview.videoId,
      startSeconds: active.preview.startSeconds,
      endSeconds: active.preview.endSeconds,
    },
  ]);
}

function initializeChannel() {
  sendMessage({
    event: "listening",
    id: PLAYER_ID,
  });

  for (const eventName of [
    "onReady",
    "onStateChange",
    "onError",
  ]) {
    sendCommand("addEventListener", [eventName]);
  }
}

function handlePlayerMessage(event: MessageEvent) {
  const iframe = state.iframe;
  if (!iframe) return;
  if (!ALLOWED_MESSAGE_ORIGINS.has(event.origin)) return;
  if (event.source !== iframe.contentWindow) return;

  const message = parseMessage(event.data);
  if (!message) return;

  if (message.event === "onReady") {
    state.ready = true;
    playActive();
    return;
  }

  if (message.event === "onStateChange") {
    const playerState = Number(message.info);

    if (playerState === 1 && state.active) {
      state.playingSince = performance.now();
      keepPlayerRenderingInvisible();
      scheduleRevealIfReady();
      return;
    }

    if (playerState === 0 && state.active) {
      cancelRevealTimer();
      state.playingSince = null;
      keepPlayerRenderingInvisible();
      playActive();
    }

    return;
  }

  if (message.event === "onError") {
    cancelRevealTimer();
    state.playingSince = null;
    hidePlayer();
  }
}

function handleViewportChange() {
  if (state.active) schedulePlacementSync();
}

function handleVisibilityChange() {
  if (document.hidden) {
    cancelRevealTimer();
    hidePlayer();
    sendCommand("pauseVideo");
    return;
  }

  if (state.active) playActive();
}

function installListeners() {
  if (state.listenersInstalled) return;

  window.addEventListener("message", handlePlayerMessage);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange);
  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );
  state.listenersInstalled = true;
}

function removeListeners() {
  if (!state.listenersInstalled) return;

  window.removeEventListener("message", handlePlayerMessage);
  window.removeEventListener("scroll", handleViewportChange, true);
  window.removeEventListener("resize", handleViewportChange);
  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );
  state.listenersInstalled = false;
}

function cancelIdleDestroy() {
  if (!state.idleTimer) return;
  clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

function destroyPlayer() {
  cancelIdleDestroy();
  cancelRevealTimer();

  if (state.positionFrame !== null) {
    cancelAnimationFrame(state.positionFrame);
    state.positionFrame = null;
  }

  state.resizeObserver?.disconnect();
  state.resizeObserver = null;
  removeListeners();
  state.wrapper?.remove();

  state.wrapper = null;
  state.iframe = null;
  state.active = null;
  state.ready = false;
  state.revealRequested = false;
  state.playingSince = null;
}

function scheduleIdleDestroy() {
  cancelIdleDestroy();
  state.idleTimer = setTimeout(() => {
    state.idleTimer = null;
    if (!state.active) destroyPlayer();
  }, IDLE_DESTROY_MS);
}

function ensurePlayer(initialVideoId: string) {
  if (state.wrapper && state.iframe) return;

  const wrapper = document.createElement("div");
  wrapper.dataset.deunaYoutubeHoverPlayer = "true";
  Object.assign(wrapper.style, {
    position: "fixed",
    zIndex: "1200",
    overflow: "hidden",
    background: "#05080d",
    opacity: "0",
    pointerEvents: "none",
    visibility: "hidden",
    transition: "opacity 90ms ease",
    contain: "layout paint style",
  });

  const iframe = document.createElement("iframe");
  iframe.id = PLAYER_ID;
  iframe.title = "Preview de video de juego";
  iframe.tabIndex = -1;
  iframe.loading = "eager";
  iframe.allow = "autoplay; encrypted-media";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src =
    `${PLAYER_ORIGIN}/embed/${encodeURIComponent(initialVideoId)}` +
    "?enablejsapi=1&playsinline=1&controls=0&disablekb=1&fs=0&rel=0&iv_load_policy=3" +
    `&origin=${encodeURIComponent(window.location.origin)}`;
  Object.assign(iframe.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    minWidth: `${MIN_PLAYER_EDGE_PX}px`,
    minHeight: `${MIN_PLAYER_EDGE_PX}px`,
    width: "100%",
    height: "100%",
    border: "0",
    background: "#05080d",
    pointerEvents: "none",
    transform: "translate(-50%, -50%)",
  });

  iframe.addEventListener("load", initializeChannel);
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  state.wrapper = wrapper;
  state.iframe = iframe;
  state.ready = false;
  installListeners();

  if (typeof ResizeObserver !== "undefined") {
    state.resizeObserver = new ResizeObserver(() => {
      schedulePlacementSync();
    });
  }
}

export function prepareSharedYouTubeHoverPlayer(
  target: HTMLElement,
  preview: GameYouTubePreview
) {
  cancelIdleDestroy();
  cancelRevealTimer();

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    return;
  }

  const previousTarget = state.active?.target;
  if (previousTarget && previousTarget !== target) {
    state.resizeObserver?.unobserve(previousTarget);
  }

  state.active = { target, preview };
  state.revealRequested = false;
  state.playingSince = null;
  ensurePlayer(preview.videoId);
  state.resizeObserver?.observe(target);
  keepPlayerRenderingInvisible();

  if (state.ready) playActive();
}

export function revealSharedYouTubeHoverPlayer(
  target: HTMLElement
) {
  if (!state.active || state.active.target !== target) return;

  state.revealRequested = true;
  syncPlacementNow();
  scheduleRevealIfReady();
}

export function deactivateSharedYouTubeHoverPlayer(
  target?: HTMLElement
) {
  const active = state.active;
  if (!active) return;
  if (target && active.target !== target) return;

  state.resizeObserver?.unobserve(active.target);
  state.active = null;
  state.revealRequested = false;
  state.playingSince = null;
  cancelRevealTimer();
  hidePlayer();
  sendCommand("pauseVideo");
  scheduleIdleDestroy();
}
