"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GameYouTubePreview } from "@/types/game";

import styles from "./YouTubeHoverPlayerProvider.module.css";

const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
const ALLOWED_MESSAGE_ORIGINS = new Set([
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
]);
const PLAYER_ID = "deuna-shared-youtube-hover-player";

type ActiveRequest = {
  target: HTMLElement;
  preview: GameYouTubePreview;
};

type PlayerPlacement = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

type YouTubeHoverPlayerContextValue = {
  activate: (
    target: HTMLElement,
    preview: GameYouTubePreview
  ) => void;
  deactivate: (target?: HTMLElement) => void;
};

type PlayerMessage = {
  event?: unknown;
  info?: unknown;
};

const YouTubeHoverPlayerContext =
  createContext<YouTubeHoverPlayerContextValue | null>(null);

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

function placementFor(target: HTMLElement): PlayerPlacement | null {
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

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: `${radius} ${radius} 0 0`,
  };
}

export function useYouTubeHoverPlayer() {
  const value = useContext(YouTubeHoverPlayerContext);

  if (!value) {
    throw new Error(
      "useYouTubeHoverPlayer debe usarse dentro de YouTubeHoverPlayerProvider."
    );
  }

  return value;
}

export default function YouTubeHoverPlayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef<ActiveRequest | null>(null);
  const readyRef = useRef(false);
  const frameCreatedRef = useRef(false);
  const positionFrameRef = useRef<number | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [placement, setPlacement] =
    useState<PlayerPlacement | null>(null);
  const [visible, setVisible] = useState(false);

  const sendMessage = useCallback(
    (payload: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(payload),
        PLAYER_ORIGIN
      );
    },
    []
  );

  const sendCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      sendMessage({
        event: "command",
        func,
        args,
        id: PLAYER_ID,
      });
    },
    [sendMessage]
  );

  const playActive = useCallback(() => {
    const active = activeRef.current;
    if (!active || !readyRef.current || document.hidden) return;

    sendCommand("mute");
    sendCommand("loadVideoById", [
      {
        videoId: active.preview.videoId,
        startSeconds: active.preview.startSeconds,
        endSeconds: active.preview.endSeconds,
      },
    ]);
  }, [sendCommand]);

  const syncPlacement = useCallback(() => {
    if (positionFrameRef.current !== null) return;

    positionFrameRef.current = requestAnimationFrame(() => {
      positionFrameRef.current = null;
      const active = activeRef.current;

      if (!active) {
        setPlacement(null);
        setVisible(false);
        return;
      }

      const next = placementFor(active.target);
      setPlacement(next);
      if (!next) setVisible(false);
    });
  }, []);

  const activate = useCallback(
    (
      target: HTMLElement,
      preview: GameYouTubePreview
    ) => {
      activeRef.current = { target, preview };
      setVisible(false);
      const nextPlacement = placementFor(target);
      setPlacement(nextPlacement);

      if (!frameCreatedRef.current) {
        frameCreatedRef.current = true;
        const origin = encodeURIComponent(window.location.origin);
        setFrameSrc(
          `${PLAYER_ORIGIN}/embed/${encodeURIComponent(preview.videoId)}` +
            `?enablejsapi=1&playsinline=1&controls=0&disablekb=1&fs=0&rel=0&iv_load_policy=3&origin=${origin}`
        );
        return;
      }

      playActive();
    },
    [playActive]
  );

  const deactivate = useCallback(
    (target?: HTMLElement) => {
      const active = activeRef.current;
      if (!active) return;
      if (target && active.target !== target) return;

      activeRef.current = null;
      setVisible(false);
      setPlacement(null);
      sendCommand("pauseVideo");
    },
    [sendCommand]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!ALLOWED_MESSAGE_ORIGINS.has(event.origin)) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = parseMessage(event.data);
      if (!message) return;

      if (message.event === "onReady") {
        readyRef.current = true;
        playActive();
        return;
      }

      if (message.event === "onStateChange") {
        const state = Number(message.info);

        if (state === 1 && activeRef.current) {
          setVisible(true);
          return;
        }

        if (state === 0 && activeRef.current) {
          setVisible(false);
          playActive();
        }

        return;
      }

      if (message.event === "onError") {
        setVisible(false);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playActive]);

  useEffect(() => {
    function onViewportChange() {
      syncPlacement();
    }

    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    const observer = new ResizeObserver(onViewportChange);
    const interval = window.setInterval(() => {
      const target = activeRef.current?.target;
      if (target) observer.observe(target);
    }, 500);

    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      window.clearInterval(interval);
      observer.disconnect();

      if (positionFrameRef.current !== null) {
        cancelAnimationFrame(positionFrameRef.current);
      }
    };
  }, [syncPlacement]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        setVisible(false);
        sendCommand("pauseVideo");
        return;
      }

      if (activeRef.current) {
        playActive();
      }
    }

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );
    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
  }, [playActive, sendCommand]);

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

  const frameHeight = placement
    ? Math.max(200, placement.height)
    : 200;
  const frameWidth = placement
    ? Math.max(200, placement.width)
    : 200;

  return (
    <YouTubeHoverPlayerContext.Provider
      value={{ activate, deactivate }}
    >
      {children}

      {frameSrc && placement && (
        <div
          className={`${styles.layer} ${
            visible ? styles.layerVisible : ""
          }`}
          style={{
            top: placement.top,
            left: placement.left,
            width: placement.width,
            height: placement.height,
            borderRadius: placement.borderRadius,
          }}
          aria-hidden="true"
        >
          <iframe
            ref={iframeRef}
            id={PLAYER_ID}
            className={styles.frame}
            src={frameSrc}
            title="Preview de video de juego"
            width={frameWidth}
            height={frameHeight}
            loading="eager"
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            onLoad={initializeChannel}
          />
        </div>
      )}
    </YouTubeHoverPlayerContext.Provider>
  );
}
