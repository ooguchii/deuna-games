"use client";

import { useState } from "react";

import MediaViewportEditor from "@/components/admin/MediaViewportEditor";
import { REQUIRED_DESTINATION_ASPECTS } from "@/lib/media/game-media-requirements";
import {
  DEFAULT_GALLERY_IMAGE_ASPECT,
  normalizeGameImageViewport,
} from "@/lib/media/image-viewport";
import type {
  PreviewViewport,
  PreviewViewportAspectId,
} from "@/lib/media/preview-video-policy";
import type { GameImageViewport } from "@/types/game";

import dialogStyles from "./ContextualMediaDialog.module.css";

type Target = "cover" | "hero" | "card" | "gallery";
type FixedTarget = Exclude<Target, "gallery">;
type FixedImageAspect = (typeof REQUIRED_DESTINATION_ASPECTS)[FixedTarget];

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

const GALLERY_ASPECT_OPTIONS: readonly PreviewViewportAspectId[] = [
  "16:9",
  "3:2",
  "1:1",
  "4:5",
  "9:16",
  "free",
];

function targetLabel(target: Target) {
  if (target === "cover") return "Portada";
  if (target === "hero") return "Hero";
  if (target === "gallery") return "Galería";
  return "Card";
}

function targetAspect(target: FixedTarget): FixedImageAspect {
  return REQUIRED_DESTINATION_ASPECTS[target];
}

function cropLabel(viewport: PreviewViewport) {
  if (viewport.aspect !== "free") return viewport.aspect;
  return `Libre · ${(viewport.customAspectRatio ?? 16 / 9).toFixed(2)}:1`;
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
  const requiredAspect: FixedImageAspect | undefined =
    target === "gallery" ? undefined : targetAspect(target);
  const [viewport, setViewport] = useState<PreviewViewport>(() => {
    const normalized = normalizeGameImageViewport(initialViewport);
    if (target === "gallery") {
      const aspect = normalized.aspect ?? DEFAULT_GALLERY_IMAGE_ASPECT;
      return {
        x: normalized.x,
        y: normalized.y,
        zoom: normalized.zoom,
        aspect,
        ...(aspect === "free"
          ? { customAspectRatio: normalized.aspectRatio ?? 16 / 9 }
          : {}),
      };
    }

    const aspect = targetAspect(target);
    return {
      x: normalized.x,
      y: normalized.y,
      zoom: normalized.zoom,
      aspect,
    };
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const currentCropLabel = cropLabel(viewport);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(
      `Confirmando el recorte ${currentCropLabel} de ${targetLabel(target)} sin crear otra imagen…`
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
        fields.viewportAspect = viewport.aspect;
        fields.viewportAspectRatio = viewport.aspect === "free"
          ? String(viewport.customAspectRatio ?? 16 / 9)
          : "";
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
            : "El servidor rechazó el encuadre de la imagen."
        );
      }
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el encuadre."
      );
      setBusy(false);
    }
  }

  return (
    <>
      <MediaViewportEditor
        key={`image:${target}:${src}:${requiredAspect ?? "selectable"}`}
        kind="image"
        src={src}
        sourceLabel={label}
        viewport={viewport}
        requiredAspect={requiredAspect}
        selectableAspects={target === "gallery" ? GALLERY_ASPECT_OPTIONS : undefined}
        disabled={busy}
        onViewportChange={setViewport}
      />

      {status && (
        <p
          role="status"
          style={{ margin: "12px 0 0", color: "#9db0c0", fontSize: 12 }}
        >
          {status}
        </p>
      )}

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
          {busy ? "Guardando…" : `Confirmar recorte ${currentCropLabel}`}
        </button>
      </div>
    </>
  );
}