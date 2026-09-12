"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  HomeHeroMotionEngine,
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
import { resolveHeroDeviceDesign } from "@/lib/home/hero-device-design";
import type { HomeHeroVisualPosition } from "@/lib/home/hero-layout";
import type { Game } from "@/types/game";

import styles from "./HomeHeroEditor.module.css";

type ViewportOverrides = Record<HomeHeroDevice, HomeHeroViewport>;
type ViewportCustomization = Record<HomeHeroDevice, boolean>;

type HeroEditorPayload = {
  presentation?: HomeHeroPresentation;
  [key: string]: unknown;
};

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
  const wasPlaying = useRef(false);
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
  const [previewPhysicalMotion, setPreviewPhysicalMotion] =
    useState(false);
  const [engineNotice, setEngineNotice] =
    useState<string | null>(null);
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
  const effectivePresentation = useMemo<HomeHeroPresentation>(
    () =>
      previewPhysicalMotion && presentation.motionEngine !== "physical"
        ? { ...presentation, motionEngine: "physical" }
        : presentation,
    [presentation, previewPhysicalMotion]
  );

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
    setPreviewPhysicalMotion(false);
    setEngineNotice(null);
  }, [presentation.motionEngine]);

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
    effectivePresentation,
    previewEnd,
    showSpacingGuide,
    width,
  ]);

  const replayTransition = useCallback(() => {
    const previewRoot = previewEnd?.parentElement;
    if (!previewRoot) return false;
    const next = previewRoot.querySelector<HTMLButtonElement>(
      'button[aria-label="Juego siguiente"]:not(:disabled)'
    );
    const previous = previewRoot.querySelector<HTMLButtonElement>(
      'button[aria-label="Juego anterior"]:not(:disabled)'
    );
    const target = next ?? previous;
    if (!target) return false;
    target.click();
    return true;
  }, [previewEnd]);

  useEffect(() => {
    if (!playing) {
      wasPlaying.current = false;
      if (presentation.motionEngine !== "physical") {
        setPreviewPhysicalMotion(false);
      }
      return;
    }
    if (!previewEnd || wasPlaying.current) return;

    wasPlaying.current = true;
    if (presentation.motionEngine !== "physical") {
      setPreviewPhysicalMotion(true);
    }

    const view = previewEnd.ownerDocument.defaultView;
    if (!view) return;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = view.requestAnimationFrame(() => {
      secondFrame = view.requestAnimationFrame(() => {
        replayTransition();
      });
    });

    return () => {
      view.cancelAnimationFrame(firstFrame);
      view.cancelAnimationFrame(secondFrame);
    };
  }, [playing, presentation.motionEngine, previewEnd, replayTransition]);

  const saveMotionEngine = (motionEngine: HomeHeroMotionEngine) => {
    const doc = container.current?.ownerDocument;
    const form = doc?.querySelector<HTMLFormElement>(
      'form[action="/api/admin/content/home/hero"]'
    );
    const heroInput = form?.querySelector<HTMLInputElement>(
      'input[name="heroJson"]'
    );

    if (!form || !heroInput) {
      setEngineNotice(
        "No se encontró el guardado canónico del Hero. Recarga el panel antes de cambiar el motor."
      );
      return;
    }

    try {
      const payload = JSON.parse(heroInput.value) as HeroEditorPayload;
      if (!payload.presentation) {
        throw new Error("missing-presentation");
      }

      if (
        JSON.stringify(payload.presentation) !==
        JSON.stringify(presentation)
      ) {
        setEngineNotice(
          "Sal de «Comparar con guardado» antes de cambiar el motor. No se modificó el borrador."
        );
        return;
      }

      payload.presentation = {
        ...payload.presentation,
        motionEngine,
      };
      heroInput.value = JSON.stringify(payload);
      setPreviewPhysicalMotion(motionEngine === "physical");
      setEngineNotice(
        motionEngine === "physical"
          ? "Activando el motor físico mediante el guardado normal del Hero…"
          : "Restaurando el motor clásico mediante el guardado normal del Hero…"
      );
      form.requestSubmit();
    } catch {
      setEngineNotice(
        "No se pudo preparar el cambio de motor. El borrador actual no fue modificado."
      );
    }
  };

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

  const responsive = resolveHeroDeviceDesign(
    effectivePresentation,
    device
  ).responsive[device];
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
            presentation={effectivePresentation}
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
  const simulatingPhysicalMotion =
    presentation.motionEngine !== "physical" && previewPhysicalMotion;

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
        <div>
          <span role="status">
            {presentation.motionEngine === "physical"
              ? "Motor físico V2 activo en este borrador. La web pública cambia sólo al publicar Inicio."
              : simulatingPhysicalMotion
                ? "Simulación V2 activa sólo en esta prueba; todavía no está guardada."
                : "Motor clásico preservado. Probar funcionamiento simula V2 sin cambiar el borrador."}
          </span>
          {playing && games.length > 1 && (
            <button type="button" onClick={replayTransition}>
              Repetir transición ahora
            </button>
          )}
          {presentation.motionEngine === "physical" ? (
            <button
              type="button"
              onClick={() => saveMotionEngine("legacy")}
            >
              Volver al motor clásico y guardar borrador
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveMotionEngine("physical")}
            >
              Activar motor físico V2 y guardar borrador
            </button>
          )}
          {engineNotice && <span role="status">{engineNotice}</span>}
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
