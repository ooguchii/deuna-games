"use client";

import { useState } from "react";

import VideoTrimEditor from "@/components/admin/VideoTrimEditor";
import {
  REQUIRED_GAME_MEDIA_CROPS,
} from "@/lib/media/game-media-readiness";
import { normalizeGameVideoViewport } from "@/lib/media/game-video-media";
import {
  DEFAULT_PREVIEW_QUALITY,
  type PreviewViewport,
} from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

import dialogStyles from "./ContextualMediaDialog.module.css";

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
function ignoreQuality() {}

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
  const requiredAspect = REQUIRED_GAME_MEDIA_CROPS[target];
  const [viewport, setViewport] = useState<PreviewViewport>(() => ({
    ...normalizeGameVideoViewport(initialViewport),
    aspect: requiredAspect,
  }));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function updateViewport(next: PreviewViewport) {
    setViewport({
      ...next,
      aspect: requiredAspect,
    });
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(
      `Confirmando recorte ${requiredAspect} para ${target === "hero" ? "Hero" : "Card"}; el WebM físico no se modifica…`
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-layout`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
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
            : "El servidor rechazó el recorte del video."
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

  async function switchCardToStaticImage() {
    if (busy || target !== "card") return;
    setBusy(true);
    setStatus(
      "Quitando sólo el preview animado; el WebM seguirá disponible en la biblioteca…"
    );

    try {
      const response = await fetch(
        `/api/admin/content/games/${encodeURIComponent(slug)}/preview-remove`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({
            expectedRevision: String(revision),
            target: "card",
          }),
        }
      );
      const resultUrl = new URL(response.url, window.location.href);
      const state = resultUrl.searchParams.get("estado");
      if (state !== "preview-quitado") {
        throw new Error(
          state === "conflicto"
            ? "Otra pestaña guardó una revisión más reciente. Recarga Multimedia antes de continuar."
            : "No se pudo volver la Card a imagen estática."
        );
      }
      window.location.assign(resultUrl.toString());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la Card."
      );
      setBusy(false);
    }
  }

  return (
    <>
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
        Ajusta posición y zoom hasta dejar listo este destino. Guardar confirma el recorte requerido.
      </div>

      <VideoTrimEditor
        key={`${target}:${source}:${clip}:${requiredAspect}`}
        src={clip}
        sourceLabel={label}
        quality={DEFAULT_PREVIEW_QUALITY}
        viewport={viewport}
        layoutOnly
        onQualityChange={ignoreQuality}
        onViewportChange={updateViewport}
        onTrimChange={ignoreTrim}
      />

      {status && (
        <p
          role="status"
          style={{
            margin: "12px 0 0",
            color: "#9db0c0",
            fontSize: 12,
          }}
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
        {target === "card" && (
          <button
            type="button"
            className={dialogStyles.secondary}
            disabled={busy}
            onClick={() => void switchCardToStaticImage()}
          >
            Usar imagen estática
          </button>
        )}
        <button
          type="button"
          className={dialogStyles.primary}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : `Confirmar recorte ${requiredAspect}`}
        </button>
      </div>
    </>
  );
}