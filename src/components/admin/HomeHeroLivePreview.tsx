"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import HeroSection from "@/components/home/HeroSection";
import PublicPageBackground, { type PublicPageBackgroundProps } from "@/components/site/PublicPageBackground";
import type { HomeHeroDevice, HomeHeroPresentation } from "@/data/home-config";
import type { HomeHeroVisualPosition } from "@/lib/home/hero-layout";
import type { Game } from "@/types/game";

import styles from "./HomeHeroEditor.module.css";

type ViewportSize = { width: number; height: number };

const fallbackViewports: Record<HomeHeroDevice, ViewportSize> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 900, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const widthLimits: Record<HomeHeroDevice, readonly [number, number]> = {
  desktop: [1101, 3840],
  tablet: [681, 1100],
  mobile: [320, 680],
};
const documentHtml = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview"></div></body></html>';

function viewportDevice(width: number): HomeHeroDevice {
  if (width <= 680) return "mobile";
  if (width <= 1100) return "tablet";
  return "desktop";
}

function clampViewport(device: HomeHeroDevice, viewport: ViewportSize): ViewportSize {
  const [minWidth, maxWidth] = widthLimits[device];
  return {
    width: Math.min(maxWidth, Math.max(minWidth, Math.round(viewport.width))),
    height: Math.min(2160, Math.max(320, Math.round(viewport.height))),
  };
}

/**
 * Match the CSS viewport used by the real public page. clientWidth is deliberate:
 * unlike physical screenshot pixels it already reflects browser zoom and excludes
 * the scrollbar gutter used by percentage-based page containers.
 */
function readBrowserViewport(): ViewportSize | null {
  if (typeof window === "undefined") return null;
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
  };
}

async function synchronizePreviewStyles(doc: Document) {
  const previous = Array.from(doc.head.querySelectorAll("[data-preview-style]"));
  const loaded: Promise<void>[] = [];
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute("data-preview-style", "");
    if (copy.tagName === "LINK") {
      loaded.push(new Promise((resolve) => {
        copy.addEventListener("load", () => resolve(), { once: true });
        copy.addEventListener("error", () => resolve(), { once: true });
      }));
    }
    doc.head.append(copy);
  }
  // Copy the public identity at the root, never the admin's inherited theme.
  doc.documentElement.style.cssText = document.documentElement.style.cssText;
  doc.documentElement.className = document.documentElement.className;
  doc.documentElement.lang = document.documentElement.lang;
  doc.body.style.margin = "0";
  doc.body.style.overflowX = "hidden";
  await Promise.all(loaded);
  previous.forEach((node) => node.remove());
  const view = doc.defaultView;
  if (view) view.dispatchEvent(new view.Event("resize"));
}

/** The same renderer, page container and CSS viewport as the public home. */
export default function HomeHeroLivePreview({ games, presentation, device, playing, onSelectPosition, background }: {
  games: Game[];
  presentation: HomeHeroPresentation;
  device: HomeHeroDevice;
  playing: boolean;
  onSelectPosition: (position: HomeHeroVisualPosition) => void;
  background?: Omit<PublicPageBackgroundProps, "children" | "previewPathname">;
}) {
  const container = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [styledTarget, setStyledTarget] = useState<HTMLElement | null>(null);
  const attachFrame = useCallback((frame: HTMLIFrameElement | null) => {
    frameRef.current = frame;
    if (!frame) return;
    const ready = () => setTarget(frame.contentDocument?.getElementById("preview") ?? null);
    frame.addEventListener("load", ready);
    ready();
    return () => frame.removeEventListener("load", ready);
  }, []);
  const [availableWidth, setAvailableWidth] = useState(fallbackViewports.desktop.width);
  const [sizes, setSizes] = useState(fallbackViewports);
  const [browserViewport, setBrowserViewport] = useState<ViewportSize | null>(null);
  const { width, height } = sizes[device];
  const scale = Math.min(1, availableWidth / width);
  const browserDevice = browserViewport ? viewportDevice(browserViewport.width) : null;
  const browserMatchesSelection = browserDevice === device;
  const previewMatchesBrowser = Boolean(
    browserViewport &&
    browserMatchesSelection &&
    width === clampViewport(device, browserViewport).width &&
    height === clampViewport(device, browserViewport).height
  );

  const useBrowserViewport = useCallback((viewport: ViewportSize, targetDevice: HomeHeroDevice) => {
    const next = clampViewport(targetDevice, viewport);
    setSizes((current) => ({ ...current, [targetDevice]: next }));
  }, []);

  useEffect(() => {
    const initial = readBrowserViewport();
    if (!initial) return;
    setBrowserViewport(initial);
    useBrowserViewport(initial, viewportDevice(initial.width));

    const trackBrowserViewport = () => {
      const next = readBrowserViewport();
      if (next) setBrowserViewport(next);
    };
    window.addEventListener("resize", trackBrowserViewport);
    return () => window.removeEventListener("resize", trackBrowserViewport);
  }, [useBrowserViewport]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    let disposed = false;
    const syncStyles = () => {
      void synchronizePreviewStyles(doc).then(() => { if (!disposed) setStyledTarget(target); });
    };
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "lang"] });
    const openGame = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      window.open(link.href, "_blank", "noopener,noreferrer");
    };
    doc.addEventListener("click", openGame, true);
    return () => { disposed = true; observer.disconnect(); doc.removeEventListener("click", openGame, true); };
  }, [target]);

  const hero = <main className="main-content">
    {games.length ? <HeroSection
      games={games}
      presentation={presentation}
      autoplaySuspended={!playing}
      onSelectPosition={playing ? undefined : onSelectPosition}
    /> : <p role="status">No hay juegos públicos para mostrar con esta selección.</p>}
  </main>;

  return <div ref={container} className={styles.livePreview}>
    <div className={styles.previewToolbar}>
      <p className={styles.help}>{playing ? "Prueba interactiva" : "Vista real · avance automático detenido para editar"}. Los enlaces se abren en otra pestaña.</p>
      <div>
        <label>Ancho de pantalla <input key={`${device}-${width}-width`} type="number" min={widthLimits[device][0]} max={widthLimits[device][1]} defaultValue={width} onBlur={(event) => {
          const value = Number(event.target.value);
          const next = Number.isFinite(value) ? Math.min(widthLimits[device][1], Math.max(widthLimits[device][0], Math.round(value))) : width;
          event.target.value = String(next);
          setSizes((current) => ({ ...current, [device]: { ...current[device], width: next } }));
        }} /> px</label>
        <label>Alto de pantalla <input key={`${device}-${height}-height`} type="number" min={320} max={2160} defaultValue={height} onBlur={(event) => {
          const value = Number(event.target.value);
          const next = Number.isFinite(value) ? Math.min(2160, Math.max(320, Math.round(value))) : height;
          event.target.value = String(next);
          setSizes((current) => ({ ...current, [device]: { ...current[device], height: next } }));
        }} /> px</label>
        <span>Escala de visualización: {Math.round(scale * 100)} %</span>
        {browserViewport && <span>Ventana actual: {Math.round(browserViewport.width)} × {Math.round(browserViewport.height)} CSS px</span>}
        {browserViewport && browserMatchesSelection && !previewMatchesBrowser && <button type="button" className={styles.breakpoint} onClick={() => useBrowserViewport(browserViewport, device)}>Usar ventana actual</button>}
        {previewMatchesBrowser && <span>Vista sincronizada con la ventana actual</span>}
      </div>
    </div>
    <div style={{ height: height * scale, position: "relative", overflow: "hidden" }}>
      <iframe
        ref={attachFrame}
        title={`Hero real en ${device === "mobile" ? "móvil" : device === "tablet" ? "tableta" : "escritorio"}`}
        srcDoc={documentHtml}
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, position: "absolute", left: "50%", marginLeft: -(width * scale) / 2 }}
      />
      {target && styledTarget === target && createPortal(background
        ? <PublicPageBackground {...background} previewPathname="/">{hero}</PublicPageBackground>
        : hero, target)}
    </div>
  </div>;
}
