"use client";

import Image from "next/image";
import { RotateCcw } from "lucide-react";
import {
  type PointerEvent,
  useState,
} from "react";

import {
  REQUIRED_GAME_MEDIA_CROPS,
} from "@/lib/media/game-media-readiness";
import {
  DEFAULT_GAME_IMAGE_VIEWPORT,
  MAX_GAME_IMAGE_ZOOM,
  normalizeGameImageViewport,
} from "@/lib/media/image-viewport";
import type { GameImageViewport } from "@/types/game";

import dialogStyles from "./ContextualMediaDialog.module.css";
import styles from "./ImageViewportEditor.module.css";

type Target = "cover" | "hero" | "card" | "gallery";

type Props = {
  slug: string;
  revision: number;
  target: Target;
  src: string;
  label: string;
  initialViewport?: GameImageViewport;
  resource?: string;
  onClose: () => void;
};

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function targetLabel(target: Target) {
  if (target === "cover") return "Portada";
  if (target === "hero") return "Hero";
  if (target === "gallery") return "Galería";
  return "Card";
}

function targetAspect(target: Target) {
  if (target === "gallery") return null;
  return REQUIRED_GAME_MEDIA_CROPS[target];
}

function cssAspectRatio(target: Target) {
  const aspect = targetAspect(target);
  if (aspect === "16:9") return "16 / 9";
  if (aspect === "4:5") return "4 / 5";
  return undefined;
}

export default function ImageViewportEditor({
  slug,
  revision,
  target,
  src,
  label,
  initialViewport,
  resource,
  onClose,
}: Props) {
  const [viewport, setViewport] = useState<GameImageViewport>(() =>
    normalizeGameImageViewport(initialViewport)
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const requiredAspect = targetAspect(target);

  function updateFocus(event: PointerEvent<HTMLDivElement>) {
    if (busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = round(clamp((event.clientX - rect.left) / rect.width));
    const y = round(clamp((event.clientY - rect.top) / rect.height));
    setViewport((current) => ({ ...current, x, y }));
  }

  function applySide(x: 0 | 0.5 | 1) {
    setViewport((current) => ({
      ...current,
      x,
      y: 0.5,
      zoom: x === 0.5 ? current.zoom : Math.max(current.zoom, 2),
    }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(
      requiredAspect
        ? `Confirmando recorte ${requiredAspect} de ${targetLabel(target)} sin crear otra imagen…`
        : "Guardando el encuadre de Galería sin crear otra imagen…"
    );

    try {
      const fields: Record<string, string> = {
        expectedRevision: String(revision),
        target,
        viewportX: String(viewport.x),
        viewportY: String(viewport.y),
        viewportZoom: String(viewport.zoom),
      };

      if (target === "gallery") {
        if (!resource) {
          throw new Error("La captura de Galería ya no está disponible.");
        }
        fields.resource = resource;
      }

      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/image-layout`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams(fields),
        }
      );
      const resultUrl = new URL(response.url, window.location.href);
      const state = resultUrl.searchParams.get("estado");
      if (state !== "imagen-encuadre-guardado") {
        throw new Error(
          state === "conflicto"
            ? "Otra pestaña guardó una revisión más reciente. Recarga Multimedia antes de continuar."
            : "El servidor rechazó el recorte de la imagen."
        );
      }
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el recorte."
      );
      setBusy(false);
    }
  }

  const position = `${(viewport.x * 100).toFixed(2)}% ${(viewport.y * 100).toFixed(2)}%`;

  return (
    <>
      {requiredAspect && (
        <div
          style={{
            margin: "0 0 12px",
            padding: "10px 12px",
            border: "1px solid #2b3b48",
            borderRadius: 8,
            color: "#c7d2db",
            background: "#0b131c",
            fontSize: 12,
          }}
        >
          <strong>Recorte obligatorio {requiredAspect}</strong>
          {" · "}
          Guardar este editor confirma el formato requerido para {targetLabel(target)}.
        </div>
      )}

      <div className={styles.workspace}>
        <div className={styles.previewColumn}>
          <div className={styles.previewHeader}>
            <div>
              <span>VISTA DEL DESTINO</span>
              <strong>{label}</strong>
            </div>
            <small>
              {targetLabel(target)}
              {requiredAspect ? ` · ${requiredAspect} obligatorio` : " · metadata visual"}
            </small>
          </div>

          <div
            className={styles.preview}
            style={{ aspectRatio: cssAspectRatio(target) }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateFocus(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                updateFocus(event);
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            aria-label="Seleccionar punto focal de la imagen"
          >
            <div
              className={styles.imageLayer}
              style={{
                transform: `scale(${viewport.zoom})`,
                transformOrigin: position,
              }}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 820px) 94vw, 760px"
                style={{ objectPosition: position }}
                draggable={false}
              />
            </div>
            <span
              className={styles.focusMarker}
              style={{
                left: `${viewport.x * 100}%`,
                top: `${viewport.y * 100}%`,
              }}
              aria-hidden="true"
            />
          </div>
          <p className={styles.previewHint}>
            Arrastra el punto focal hacia la zona que quieres priorizar. El archivo original no se recorta ni se duplica.
          </p>
        </div>

        <div className={styles.controls}>
          <span>ENCUADRE</span>

          <div className={styles.controlGroup}>
            <label htmlFor="image-viewport-zoom">
              Zoom · {Math.round(viewport.zoom * 100)}%
            </label>
            <input
              id="image-viewport-zoom"
              type="range"
              min="1"
              max={MAX_GAME_IMAGE_ZOOM}
              step="0.05"
              value={viewport.zoom}
              disabled={busy}
              onChange={(event) =>
                setViewport((current) => ({
                  ...current,
                  zoom: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className={styles.coordinateGrid}>
            <label>
              Posición X
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(viewport.x * 100)}
                disabled={busy}
                onChange={(event) =>
                  setViewport((current) => ({
                    ...current,
                    x: round(clamp(Number(event.target.value) / 100)),
                  }))
              />
            </label>
            <label>
              Posición Y
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(viewport.y * 100)}
                disabled={busy}
                onChange={(event) =>
                  setViewport((current) => ({
                    ...current,
                    y: round(clamp(Number(event.target.value) / 100)),
                  }))
              />
            </label>
          </div>

          <div className={styles.presets}>
            <button type="button" disabled={busy} onClick={() => applySide(0)}>
              Izquierda
            </button>
            <button type="button" disabled={busy} onClick={() => applySide(0.5)}>
              Centro
            </button>
            <button type="button" disabled={busy} onClick={() => applySide(1)}>
              Derecha
            </button>
          </div>

          <button
            type="button"
            className={styles.reset}
            disabled={busy}
            onClick={() => setViewport({ ...DEFAULT_GAME_IMAGE_VIEWPORT })}
          >
            <RotateCcw size={15} aria-hidden="true" />{" "}
            Restablecer encuadre
          </button>

          {status && (
            <p className={styles.status} role="status">{status}</p>
          )}
        </div>
      </div>

      <div className={dialogStyles.actions}>
        <button
          type="button"
          className={dialogStyles.secondary}
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={dialogStyles.primary}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy
            ? "Guardando…"
            : requiredAspect
              ? `Confirmar recorte ${requiredAspect}`
              : "Guardar encuadre"}
        </button>
      </div>
    </>
  );
}