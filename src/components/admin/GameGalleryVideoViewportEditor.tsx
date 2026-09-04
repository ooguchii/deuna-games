"use client";

import { useState } from "react";

import MediaViewportEditor from "@/components/admin/MediaViewportEditor";
import {
  DEFAULT_PREVIEW_VIEWPORT,
  type PreviewViewport,
  type PreviewViewportAspectId,
} from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

import dialogStyles from "./ContextualMediaDialog.module.css";

const GALLERY_VIDEO_ASPECTS: readonly PreviewViewportAspectId[] = [
  "source",
  "16:9",
  "3:2",
  "1:1",
  "4:5",
  "9:16",
];

type Props = {
  slug: string;
  revision: number;
  clip: string;
  label: string;
  initialViewport: GameVideoViewport;
  onClose: () => void;
};

function initialEditorViewport(viewport: GameVideoViewport): PreviewViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
    aspect: GALLERY_VIDEO_ASPECTS.includes(viewport.aspect)
      ? viewport.aspect
      : DEFAULT_PREVIEW_VIEWPORT.aspect,
  };
}

export default function GameGalleryVideoViewportEditor({
  slug,
  revision,
  clip,
  label,
  initialViewport,
  onClose,
}: Props) {
  const [viewport, setViewport] = useState<PreviewViewport>(() =>
    initialEditorViewport(initialViewport)
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (busy || viewport.aspect === "free") return;
    setBusy(true);
    setStatus("Confirmando el recorte del video de Galería; el WebM físico no se modifica…");

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/gallery-media`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({
            expectedRevision: String(revision),
            target: "gallery-video-layout",
            kind: "video",
            resource: clip,
            viewportX: String(viewport.x),
            viewportY: String(viewport.y),
            viewportZoom: String(viewport.zoom),
            viewportAspect: viewport.aspect,
          }),
        }
      );
      const resultUrl = new URL(response.url, window.location.href);
      const state = resultUrl.searchParams.get("estado");
      if (state !== "preview-diseno-guardado") {
        throw new Error(
          state === "conflicto"
            ? "Otra pestaña guardó una revisión más reciente. Recarga Multimedia antes de continuar."
            : "El servidor rechazó el encuadre del video de Galería."
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
        key={`gallery-video:${clip}`}
        kind="video"
        src={clip}
        sourceLabel={label}
        viewport={viewport}
        selectableAspects={GALLERY_VIDEO_ASPECTS}
        disabled={busy}
        onViewportChange={setViewport}
      />

      <p style={{ margin: "12px 0 0", color: "#9db0c0", fontSize: 12, lineHeight: 1.55 }}>
        Galería permite Original, 16:9, 3:2, 1:1, 4:5 y 9:16. El recorte es sólo metadata de presentación: no vuelve a ejecutar FFmpeg ni modifica el master.
      </p>

      {status && (
        <p role="status" style={{ margin: "12px 0 0", color: "#9db0c0", fontSize: 12 }}>
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
          disabled={busy || viewport.aspect === "free"}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : `Confirmar recorte ${viewport.aspect === "source" ? "original" : viewport.aspect}`}
        </button>
      </div>
    </>
  );
}
