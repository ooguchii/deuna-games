"use client";

import { useState } from "react";

import MediaViewportEditor from "@/components/admin/MediaViewportEditor";
import { REQUIRED_DESTINATION_ASPECTS } from "@/lib/media/game-media-requirements";
import { normalizeGameVideoViewport } from "@/lib/media/game-video-media";
import type { PreviewViewport } from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

import dialogStyles from "./ContextualMediaDialog.module.css";

type Target = "cover" | "hero" | "card";
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

function destinationLabel(target: Target) {
  if (target === "cover") return "Portada";
  if (target === "hero") return "Hero";
  return "Card";
}

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
  const requiredAspect = REQUIRED_DESTINATION_ASPECTS[target] as PreviewViewport["aspect"];
  const [viewport, setViewport] = useState<PreviewViewport>(() => ({
    ...normalizeGameVideoViewport(initialViewport),
    aspect: requiredAspect,
  }));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(
      `Confirmando el recorte obligatorio ${requiredAspect} de ${destinationLabel(target)}; el WebM físico no se modifica…`
    );

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
            viewportAspect: requiredAspect,
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
      <MediaViewportEditor
        key={`video:${target}:${clip}:${requiredAspect}`}
        kind="video"
        src={clip}
        sourceLabel={label}
        viewport={viewport}
        requiredAspect={requiredAspect}
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
          aria-label={`Guardar encuadre obligatorio ${requiredAspect}`}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : `Confirmar recorte ${requiredAspect}`}
        </button>
      </div>
    </>
  );
}
