"use client";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

const DEFAULT_PREVIEW_DELAY_MS = 2_000;

export default function useHoverPreviewIntent(
  previewClip: string | undefined,
  delayMs = DEFAULT_PREVIEW_DELAY_MS
) {
  const timer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const [active, setActive] = useState(false);

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setActive(false);
  }

  function schedule(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (
      !previewClip ||
      event.pointerType === "touch" ||
      !window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches ||
      timer.current ||
      active
    ) {
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      setActive(true);
    }, delayMs);
  }

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return {
    active,
    schedule,
    cancel,
  };
}
