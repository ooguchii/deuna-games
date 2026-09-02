"use client";

import { useState } from "react";

import { contextualDialogStyles } from "@/components/admin/ContextualMediaDialog";
import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import {
  DEFAULT_PREVIEW_QUALITY,
  normalizePreviewViewport,
  type PreviewViewport,
} from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

type Target = "hero" | "card";
type Source = "hero" | "independent";

type Props = {
  slug: string;
  revision: number;
  target: Target;
  source: Source;
  clip: string;
  label: string;
  initialViewport: GameVideoViewport;
  onClose: () => void;
};

function ignoreTrim() {}

export default function GameVideoViewportEditor({
  slug,
  revision,
  target,
  source,
  clip,
  label,
  initialViewport,
  onClose,
}: Props) {
  const [viewport, setViewport] = useState<PreviewViewport>(() =>
    normalizePreviewViewport(initialViewport)
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus("Guardando sólo el encuadre visual; el WebM físico no se modifica…");

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-layout`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({
            expectedRevision: String(revision),
            target,
            source: target === "hero" ? "hero" : source,
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
            : "El servidor rechazó el encuadre del video."
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
      <VideoTrimEditor
        key={`${target}:${source}:${clip}`}
        src={clip}
        sourceLabel={label}
        quality={DEFAULT_PREVIEW_QUALITY}
        viewport={viewport}
        qualityDisabled
        layoutOnly
        onQualityChange={() => {}}
        onViewportChange={setViewport}
        onTrimChange={ignoreTrim}
      />

      {status && (
        <p role="status" style={{ margin: "12px 0 0", color: "#9db0c0", fontSize: 12 }}>
          {status}
        </p>
      )}

      <div className={contextualDialogStyles.actions}>
        <button
          type="button"
          className={contextualDialogStyles.secondary}
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={contextualDialogStyles.primary}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : "Guardar encuadre"}
        </button>
      </div>
    </>
  );
}
