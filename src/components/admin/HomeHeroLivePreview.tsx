"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import IsolatedPublicPreviewFrame from "@/components/admin/IsolatedPublicPreviewFrame";
import HeroSection from "@/components/home/HeroSection";
import PublicPageBackground, {
  type PublicPageBackgroundProps,
} from "@/components/site/PublicPageBackground";
import type {
  HomeHeroDevice,
  HomeHeroPresentation,
} from "@/data/home-config";
import {
  clampHomeHeroViewport,
  homeHeroDeviceForWidth,
  HOME_HERO_VIEWPORT_DEFAULTS,
  HOME_HERO_VIEWPORT_HEIGHT_LIMITS,
  HOME_HERO_VIEWPORT_WIDTH_LIMITS,
  type HomeHeroViewport,
} from "@/lib/home/hero-devices";
import type { HomeHeroVisualPosition } from "@/lib/home/hero-layout";
import type { Game } from "@/types/game";

import styles from "./HomeHeroEditor.module.css";

type ViewportOverrides = Record<HomeHeroDevice, HomeHeroViewport>;
type ViewportCustomization = Record<HomeHeroDevice, boolean>;

const initialCustomization: ViewportCustomization = {
  desktop: false,
  tablet: false,
  mobile: false,
};

function browserViewportSnapshot() {
  if (typeof window === "undefined") return "";
  const width =
    document.documentElement.clientWidth || window.innerWidth;
  const height =
    document.documentElement.clientHeight || window.innerHeight;
  return `${width}:${height}`;
}

function serverViewportSnapshot() {
  return "";
}

function subscribeBrowserViewport(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function parseViewportSnapshot(
  snapshot: string
): HomeHeroViewport | null {
  if (!snapshot) return null;
  const [rawWidth, rawHeight] = snapshot.split(":");
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  return Number.isFinite(width) && Number.isFinite(height)
    ? { width, height }
    : null;
}

/**
 * Same Hero renderer and CSS viewport as the public Home. The surrounding
 * editor only controls the isolated viewport and never reimplements Hero.
 */
export default function HomeHeroLivePreview({
  games,
  presentation,
  device,
  playing,
  onSelectPosition,
  background,
  showSpacingGuide = false,
  navigationEditing = false,
  onNavigationPositionChange,
}: {
  games: Game[];
  presentation: HomeHeroPresentation;
  device: HomeHeroDevice;
  playing: boolean;
  onSelectPosition: (position: HomeHeroVisualPosition) => void;
  background?: Omit<
    PublicPageBackgroundProps,
    "children" | "previewPathname"
  >;
  showSpacingGuide?: boolean;
  navigationEditing?: boolean;
  onNavigationPositionChange?: (x: number, y: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [previewEnd, setPreviewEnd] =
    useState<HTMLDivElement | null>(null);
  const [contentEnd, setContentEnd] = useState<number | null>(null);
  const [availableWidth, setAvailableWidth] = useState(
    HOME_HERO_VIEWPORT_DEFAULTS.desktop.width
  );
  const [manualSizes, setManualSizes] =
    useState<ViewportOverrides>(() =>
      structuredClone(HOME_HERO_VIEWPORT_DEFAULTS)
    );
  const [customized, setCustomized] =
    useState<ViewportCustomization>(initialCustomization);
  const browserSnapshot = useSyncExternalStore(
    subscribeBrowserViewport,
    browserViewportSnapshot,
    serverViewportSnapshot
  );
  const browserViewport = parseViewportSnapshot(browserSnapshot);
  const browserDevice = browserViewport
    ? homeHeroDeviceForWidth(browserViewport.width)
    : null;
  const browserMatchesSelection = browserDevice === device;
  const followsBrowserViewport = Boolean(
    browserViewport &&
      browserMatchesSelection &&
      !customized[device]
  );
  const selectedViewport =
    followsBrowserViewport && browserViewport
      ? clampHomeHeroViewport(device, browserViewport)
      : manualSizes[device];
  const { width, height } = selectedViewport;
  const scale = Math.min(1, availableWidth / width);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const marker = previewEnd;
    const view = marker?.ownerDocument.defaultView;
    if (!marker || !view) return;

    let frame = 0;
    const measure = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(() => {
        const next = Math.max(
          1,
          Math.ceil(marker.getBoundingClientRect().top + view.scrollY)
        );
        setContentEnd((current) =>
          current === next ? current : next
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(marker.parentElement ?? marker);
    view.addEventListener("resize", measure);

    return () => {
      view.cancelAnimationFrame(frame);
      observer.disconnect();
      view.removeEventListener("resize", measure);
    };
  }, [
    games.length,
    height,
    presentation,
    previewEnd,
    showSpacingGuide,
    width,
  ]);

  const setManualViewportDimension = (
    key: keyof HomeHeroViewport,
    value: number
  ) => {
    setManualSizes((current) => ({
      ...current,
      [device]: {
        ...selectedViewport,
        [key]: value,
      },
    }));
    setCustomized((current) => ({
      ...current,
      [device]: true,
    }));
  };

  const responsive = presentation.responsive[device];
  const visiblePreviewHeight =
    contentEnd !== null
      ? Math.min(height, contentEnd)
      : height;
  const hero = (
    <main className="main-content">
      {games.length ? (
        <>
          <HeroSection
            games={games}
            presentation={presentation}
            autoplaySuspended={!playing}
            onSelectPosition={playing ? undefined : onSelectPosition}
            navigationEditor={
              navigationEditing && onNavigationPositionChange
                ? {
                    device,
                    onPositionChange:
                      onNavigationPositionChange,
                  }
                : undefined
            }
          />
          {showSpacingGuide && (
            <div
              aria-hidden="true"
              style={{
                borderTop:
                  "1px dashed color-mix(in srgb, var(--brand) 68%, rgba(255,255,255,.35))",
                color:
                  "color-mix(in srgb, var(--brand) 78%, #fff)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".04em",
                padding: "10px 0 8px",
              }}
            >
              COMIENZO DE LA SIGUIENTE SECCIÓN · separación inferior{" "}
              {responsive.spaceAfter}px
            </div>
          )}
        </>
      ) : (
        <p role="status">
          No hay juegos públicos para mostrar con esta selección.
        </p>
      )}
      <div
        ref={setPreviewEnd}
        aria-hidden="true"
        style={{ height: 0, pointerEvents: "none" }}
      />
    </main>
  );

  const previewContent = background ? (
    <PublicPageBackground
      {...background}
      previewPathname="/"
    >
      {hero}
    </PublicPageBackground>
  ) : (
    hero
  );
  const [minHeight, maxHeight] =
    HOME_HERO_VIEWPORT_HEIGHT_LIMITS;
  const [minWidth, maxWidth] =
    HOME_HERO_VIEWPORT_WIDTH_LIMITS[device];

  return (
    <div ref={container} className={styles.livePreview}>
      <div className={styles.previewToolbar}>
        <p className={styles.help}>
          {playing
            ? "Prueba interactiva"
            : "Vista real · avance automático detenido para editar"}
          . Los enlaces se abren en otra pestaña.
        </p>
        <div>
          <label>
            Ancho de pantalla{" "}
            <input
              key={`${device}-${width}-width`}
              type="number"
              min={minWidth}
              max={maxWidth}
              defaultValue={width}
              onBlur={(event) => {
                const value = Number(event.target.value);
                const next = Number.isFinite(value)
                  ? Math.min(
                      maxWidth,
                      Math.max(minWidth, Math.round(value))
                    )
                  : width;
                event.target.value = String(next);
                setManualViewportDimension("width", next);
              }}
            />{" "}
            px
          </label>
          <label>
            Alto de pantalla{" "}
            <input
              key={`${device}-${height}-height`}
              type="number"
              min={minHeight}
              max={maxHeight}
              defaultValue={height}
              onBlur={(event) => {
                const value = Number(event.target.value);
                const next = Number.isFinite(value)
                  ? Math.min(
                      maxHeight,
                      Math.max(minHeight, Math.round(value))
                    )
                  : height;
                event.target.value = String(next);
                setManualViewportDimension("height", next);
              }}
            />{" "}
            px
          </label>
          <span>
            Escala de visualización: {Math.round(scale * 100)} %
          </span>
          {browserViewport && (
            <span>
              Ventana actual: {Math.round(browserViewport.width)} ×{" "}
              {Math.round(browserViewport.height)} CSS px
            </span>
          )}
          {browserViewport &&
            browserMatchesSelection &&
            customized[device] && (
              <button
                type="button"
                className={styles.breakpoint}
                onClick={() =>
                  setCustomized((current) => ({
                    ...current,
                    [device]: false,
                  }))
                }
              >
                Usar ventana actual
              </button>
            )}
          {followsBrowserViewport && (
            <span>Vista sincronizada con la ventana actual</span>
          )}
        </div>
      </div>
      <div
        style={{
          height: visiblePreviewHeight * scale,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <IsolatedPublicPreviewFrame
          width={width}
          height={height}
          scale={scale}
          title={`Hero real en ${
            device === "mobile"
              ? "móvil"
              : device === "tablet"
                ? "tableta"
                : "escritorio"
          }`}
        >
          {previewContent}
        </IsolatedPublicPreviewFrame>
      </div>
    </div>
  );
}
