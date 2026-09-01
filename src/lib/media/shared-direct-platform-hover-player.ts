"use client";

import {
  buildDirectPlatformEmbedUrl,
} from "./direct-platform-preview";

import type { GameDirectPreview } from "@/types/game";

const IDLE_DESTROY_MS = 60_000;
const MIN_PLAYER_EDGE_PX = 200;

type ActiveRequest = {
  target: HTMLElement;
  preview: GameDirectPreview;
};

type SharedPlayerState = {
  wrapper: HTMLDivElement | null;
  iframe: HTMLIFrameElement | null;
  active: ActiveRequest | null;
  positionFrame: number | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
  resizeObserver: ResizeObserver | null;
  listenersInstalled: boolean;
};

const state: SharedPlayerState = {
  wrapper: null,
  iframe: null,
  active: null,
  positionFrame: null,
  idleTimer: null,
  stopTimer: null,
  resizeObserver: null,
  listenersInstalled: false,
};

function hidePlayer() {
  if (!state.wrapper) return;
  state.wrapper.style.opacity = "0";
  state.wrapper.style.visibility = "hidden";
}

function clearStopTimer() {
  if (!state.stopTimer) return;
  clearTimeout(state.stopTimer);
  state.stopTimer = null;
}

function stopPlayback() {
  clearStopTimer();
  hidePlayer();
  if (state.iframe) {
    state.iframe.src = "about:blank";
  }
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
  iframe.width = String(
    Math.max(MIN_PLAYER_EDGE_PX, Math.round(rect.width))
  );
  iframe.height = String(
    Math.max(MIN_PLAYER_EDGE_PX, Math.round(rect.height))
  );
}

function schedulePlacementSync() {
  if (state.positionFrame !== null) return;

  state.positionFrame = requestAnimationFrame(() => {
    state.positionFrame = null;
    syncPlacementNow();
  });
}

function sendTikTokStart(preview: GameDirectPreview) {
  if (preview.platform !== "tiktok") return;

  const target = state.iframe?.contentWindow;
  if (!target) return;

  window.setTimeout(() => {
    if (state.active?.preview !== preview) return;

    target.postMessage(
      {
        type: "seekTo",
        value: preview.startSeconds,
        "x-tiktok-player": true,
      },
      "https://www.tiktok.com"
    );
    target.postMessage(
      {
        type: "mute",
        "x-tiktok-player": true,
      },
      "https://www.tiktok.com"
    );
    target.postMessage(
      {
        type: "play",
        "x-tiktok-player": true,
      },
      "https://www.tiktok.com"
    );
  }, 300);
}

function playActive() {
  const active = state.active;
  const iframe = state.iframe;
  const wrapper = state.wrapper;

  if (!active || !iframe || !wrapper || document.hidden) {
    return;
  }

  const src = buildDirectPlatformEmbedUrl(
    active.preview,
    {
      autoplay: true,
      muted: true,
      parentHostname: window.location.hostname || "localhost",
    }
  );

  if (!src) {
    stopPlayback();
    return;
  }

  clearStopTimer();
  hidePlayer();
  syncPlacementNow();

  iframe.onload = () => {
    if (!state.active || state.active !== active) return;
    sendTikTokStart(active.preview);
    syncPlacementNow();
    wrapper.style.visibility = "visible";
    wrapper.style.opacity = "1";
  };
  iframe.src = src;

  const durationMs = Math.max(
    100,
    (active.preview.endSeconds - active.preview.startSeconds) * 1_000
  );
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null;
    if (state.active === active) {
      stopPlayback();
    }
  }, durationMs);
}

function handleViewportChange() {
  if (state.active) schedulePlacementSync();
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPlayback();
    return;
  }

  if (state.active) playActive();
}

function installListeners() {
  if (state.listenersInstalled) return;

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
  clearStopTimer();

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
}

function scheduleIdleDestroy() {
  cancelIdleDestroy();
  state.idleTimer = setTimeout(() => {
    state.idleTimer = null;
    if (!state.active) destroyPlayer();
  }, IDLE_DESTROY_MS);
}

function ensurePlayer() {
  if (state.wrapper && state.iframe) return;

  const wrapper = document.createElement("div");
  wrapper.dataset.deunaDirectHoverPlayer = "true";
  Object.assign(wrapper.style, {
    position: "fixed",
    zIndex: "1200",
    overflow: "hidden",
    background: "#05080d",
    opacity: "0",
    pointerEvents: "none",
    visibility: "hidden",
    transition: "opacity 110ms ease",
    contain: "layout paint style",
  });

  const iframe = document.createElement("iframe");
  iframe.title = "Preview directo de juego";
  iframe.tabIndex = -1;
  iframe.loading = "eager";
  iframe.allow =
    "autoplay; encrypted-media; fullscreen; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
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

  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  state.wrapper = wrapper;
  state.iframe = iframe;
  installListeners();

  if (typeof ResizeObserver !== "undefined") {
    state.resizeObserver = new ResizeObserver(() => {
      schedulePlacementSync();
    });
  }
}

export function activateSharedDirectPlatformHoverPlayer(
  target: HTMLElement,
  preview: GameDirectPreview
) {
  cancelIdleDestroy();

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches ||
    !window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches
  ) {
    return;
  }

  const previousTarget = state.active?.target;
  if (previousTarget && previousTarget !== target) {
    state.resizeObserver?.unobserve(previousTarget);
  }

  ensurePlayer();
  state.active = { target, preview };
  state.resizeObserver?.observe(target);
  syncPlacementNow();
  playActive();
}

export function deactivateSharedDirectPlatformHoverPlayer(
  target?: HTMLElement
) {
  const active = state.active;
  if (!active) return;
  if (target && active.target !== target) return;

  state.resizeObserver?.unobserve(active.target);
  state.active = null;
  stopPlayback();
  scheduleIdleDestroy();
}
