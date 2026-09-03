"use client";

import Image from "next/image";
import {
  CheckCircle2,
  ImageIcon,
  Info,
  MonitorPlay,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";
import GameBackgroundViewportEditor from "@/components/admin/GameBackgroundViewportEditor";
import type {
  GameBackgroundVideo,
  GameDestinationMediaMode,
  GameImageViewport,
} from "@/types/game";

import styles from "./GameBackgroundMediaEditor.module.css";

type ResourceImage = {
  kind: "image";
  origin: "editorial" | "bundled";
  src: string;
  digest: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
};

type ResourceVideo = {
  kind: "video";
  origin: "editorial";
  src: string;
  digest: string;
  bytes: number;
};

type LibraryResource = ResourceImage | ResourceVideo;

type BackgroundState = {
  revision: number;
  resources: LibraryResource[];
  assignment: {
    active: boolean;
    mode: GameDestinationMediaMode | null;
    image: string | null;
    imageViewport: GameImageViewport | null;
    video: GameBackgroundVideo | null;
  };
};

type Props = {
  slug: string;
};

const MODES: Array<{ value: GameDestinationMediaMode; label: string }> = [
  { value: "image", label: "Imagen" },
  { value: "video", label: "Video" },
  { value: "hover-video", label: "Imagen + hover" },
];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function shortName(src: string) {
  const filename = src.split("/").filter(Boolean).at(-1) ?? src;
  return filename.length <= 28 ? filename : `${filename.slice(0, 13)}…${filename.slice(-12)}`;
}

function isState(value: unknown): value is BackgroundState {
  if (!value || typeof value !== "object") return false;
  const root = value as Partial<BackgroundState>;
  return typeof root.revision === "number" &&
    Array.isArray(root.resources) &&
    Boolean(root.assignment && typeof root.assignment === "object");
}

function RequirementButton({
  complete,
  missing,
  done,
  disabled,
  onClick,
}: {
  complete: boolean;
  missing: string;
  done: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const Icon = complete ? CheckCircle2 : Info;
  return (
    <button
      type="button"
      className={`${styles.requirementButton} ${complete ? styles.complete : styles.missing}`}
      disabled={disabled}
      onClick={onClick}
      data-requirement-state={complete ? "complete" : "missing"}
    >
      <Icon size={17} aria-hidden="true" />
      {complete ? done : missing}
    </button>
  );
}

function ResourcePicker({
  kind,
  resources,
  selected,
  busy,
  onSelect,
}: {
  kind: "image" | "video";
  resources: LibraryResource[];
  selected: string | null;
  busy: boolean;
  onSelect: (src: string) => void;
}) {
  const available = resources.filter((resource) => resource.kind === kind);

  return (
    <details className={styles.resourcePicker}>
      <summary className={styles.resourcePickerSummary}>
        {kind === "image" ? <ImageIcon size={17} aria-hidden="true" /> : <MonitorPlay size={17} aria-hidden="true" />}
        {kind === "image" ? "Elegir imagen de fondo" : "Elegir video de fondo"}
      </summary>
      <div className={styles.resourcePanel}>
        <div className={styles.resourcePanelHeading}>
          <strong>{kind === "image" ? "Imágenes disponibles" : "Videos disponibles"}</strong>
          <span>{available.length} recurso{available.length === 1 ? "" : "s"}</span>
        </div>
        {available.length ? (
          <div className={styles.resourceGrid}>
            {available.map((resource) => (
              <button
                key={resource.src}
                type="button"
                className={`${styles.resourceCard} ${selected === resource.src ? styles.resourceSelected : ""}`}
                disabled={busy}
                onClick={() => onSelect(resource.src)}
              >
                <span className={styles.resourceThumb}>
                  {resource.kind === "image" ? (
                    <Image src={resource.src} alt="" fill sizes="150px" />
                  ) : (
                    <video src={resource.src} muted playsInline preload="metadata" aria-hidden="true" />
                  )}
                </span>
                <span className={styles.resourceCopy}>
                  <strong>{shortName(resource.src)}</strong>
                  <small>{formatBytes(resource.bytes)}</small>
                </span>
                {selected === resource.src && <CheckCircle2 size={16} aria-label="Seleccionado" />}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.emptyResource}>
            No hay recursos de este tipo todavía. Agrégalos desde la Biblioteca multimedia compartida y volverán a aparecer aquí sin duplicarse.
          </p>
        )}
      </div>
    </details>
  );
}

export default function GameBackgroundMediaEditor({ slug }: Props) {
  const [state, setState] = useState<BackgroundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<"image" | "video" | null>(null);

  const endpoint = `/api/admin/content/games/${encodeURIComponent(slug)}/background-media`;

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch(endpoint, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !isState(payload)) {
          throw new Error(payload?.error ?? "No se pudo cargar el Fondo del juego.");
        }
        if (alive) {
          setState(payload);
          setError(null);
        }
      } catch (reason) {
        if (alive) {
          setError(reason instanceof Error ? reason.message : "No se pudo cargar el Fondo del juego.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  const mode = state?.assignment.mode ?? null;
  const imageSelected = Boolean(state?.assignment.image);
  const imageCropReady = state?.assignment.imageViewport?.confirmed === true;
  const videoSelected = Boolean(state?.assignment.video?.clip);
  const videoCropReady = state?.assignment.video?.viewport.confirmed === true &&
    state?.assignment.video?.viewport.aspect === "source";
  const needsImage = mode === "image" || mode === "hover-video";
  const needsVideo = mode === "video" || mode === "hover-video";
  const activeReady = Boolean(
    mode &&
      (!needsImage || (imageSelected && imageCropReady)) &&
      (!needsVideo || (videoSelected && videoCropReady))
  );

  const currentLabel = useMemo(() => {
    if (!mode) return "Fondo global de Juegos";
    if (mode === "image") return "Imagen";
    if (mode === "video") return "Video";
    return "Imagen + hover";
  }, [mode]);

  async function mutate(action: string, resource: string) {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          expectedRevision: String(state.revision),
          action,
          resource,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar el Fondo del juego.");
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el Fondo del juego.");
      setBusy(false);
    }
  }

  if (loading) {
    return <section className={styles.panel}><p className={styles.loading}>Cargando Fondo del juego…</p></section>;
  }

  if (!state) {
    return (
      <section className={styles.panel}>
        <div className={styles.error} role="alert">{error ?? "No se pudo cargar el Fondo del juego."}</div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="game-background-heading">
      <div className={styles.heading}>
        <div>
          <span className={styles.step}>D</span>
          <div>
            <span className={styles.eyebrow}>FONDO DEL JUEGO · ADAPTABLE</span>
            <h2 id="game-background-heading">Fondo de la ficha completa</h2>
          </div>
        </div>
        <p>
          Reemplaza sólo el fondo global detrás de esta ficha. Reutiliza los mismos archivos físicos de la biblioteca y guarda un foco independiente que se adapta a desktop, ultrawide y móvil.
        </p>
      </div>

      <div className={styles.statusBar}>
        <div className={styles.statusIcon}>
          <Sparkles size={20} aria-hidden="true" />
        </div>
        <div>
          <span>Modo activo</span>
          <strong>{currentLabel}</strong>
          <small>
            {mode
              ? activeReady
                ? "Configuración completa y lista para publicar."
                : "Completa los pasos marcados en rojo antes de publicar."
              : "La ficha conserva exactamente el fondo global configurado para Juegos."}
          </small>
        </div>
        <button
          type="button"
          className={styles.globalButton}
          disabled={busy || !mode}
          onClick={() => void mutate("global", "global")}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Usar fondo global
        </button>
      </div>

      <div className={styles.modeSwitch} aria-label="Modo del Fondo del juego">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={busy}
            aria-pressed={mode === option.value}
            className={mode === option.value ? styles.modeActive : ""}
            onClick={() => void mutate("mode", option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode ? (
        <div className={styles.layers}>
          {needsImage && (
            <section className={styles.layerCard}>
              <div className={styles.layerHeading}>
                <ImageIcon size={18} aria-hidden="true" />
                <div><strong>Imagen base</strong><span>Fallback permanente y base visual</span></div>
              </div>
              <ResourcePicker
                kind="image"
                resources={state.resources}
                selected={state.assignment.image}
                busy={busy}
                onSelect={(src) => void mutate("select-image", src)}
              />
              <RequirementButton
                complete={imageSelected}
                missing="Falta seleccionar imagen"
                done="Imagen base seleccionada"
                disabled
              />
              <RequirementButton
                complete={imageCropReady}
                missing="Falta ajustar el foco de la imagen"
                done="Foco adaptable de imagen confirmado"
                disabled={!imageSelected || busy}
                onClick={() => imageSelected && setEditing("image")}
              />
            </section>
          )}

          {needsVideo && (
            <section className={styles.layerCard}>
              <div className={styles.layerHeading}>
                <MonitorPlay size={18} aria-hidden="true" />
                <div><strong>{mode === "hover-video" ? "Video hover" : "Video de fondo"}</strong><span>WebM reutilizable por referencia</span></div>
              </div>
              <ResourcePicker
                kind="video"
                resources={state.resources}
                selected={state.assignment.video?.clip ?? null}
                busy={busy}
                onSelect={(src) => void mutate("select-video", src)}
              />
              <RequirementButton
                complete={videoSelected}
                missing="Falta seleccionar video"
                done={mode === "hover-video" ? "Video hover seleccionado" : "Video seleccionado"}
                disabled
              />
              <RequirementButton
                complete={videoCropReady}
                missing="Falta ajustar el foco del video"
                done="Foco adaptable de video confirmado"
                disabled={!videoSelected || busy}
                onClick={() => videoSelected && setEditing("video")}
              />
            </section>
          )}
        </div>
      ) : (
        <div className={styles.globalState}>
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <strong>Fondo global activo</strong>
            <span>No agrega bytes, requests ni reproducción extra a esta ficha.</span>
          </div>
        </div>
      )}

      <div className={styles.performanceNote}>
        <Info size={17} aria-hidden="true" />
        <p>
          <strong>Rendimiento:</strong> seleccionar un recurso ya existente no crea copias. En móvil o con reducción de movimiento, el video de fondo no se activa y se conserva la imagen base —o el fondo global si no hay imagen—.
        </p>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {editing === "image" && state.assignment.image && (
        <ContextualMediaDialog
          eyebrow="FONDO ADAPTABLE"
          title="Ajustar foco de la imagen de fondo"
          description="El archivo físico permanece intacto. El mismo foco se adapta a distintas proporciones de pantalla."
          onClose={() => setEditing(null)}
        >
          <GameBackgroundViewportEditor
            slug={slug}
            revision={state.revision}
            kind="image"
            src={state.assignment.image}
            label={`Fondo · ${shortName(state.assignment.image)}`}
            initialViewport={state.assignment.imageViewport ?? undefined}
            onClose={() => setEditing(null)}
            onSaved={() => window.location.reload()}
          />
        </ContextualMediaDialog>
      )}

      {editing === "video" && state.assignment.video?.clip && (
        <ContextualMediaDialog
          eyebrow="FONDO ADAPTABLE"
          title="Ajustar foco del video de fondo"
          description="El WebM físico permanece intacto. Sólo se guarda posición y zoom para el fondo adaptable."
          onClose={() => setEditing(null)}
        >
          <GameBackgroundViewportEditor
            slug={slug}
            revision={state.revision}
            kind="video"
            src={state.assignment.video.clip}
            label={`Fondo · ${shortName(state.assignment.video.clip)}`}
            initialViewport={state.assignment.video.viewport}
            onClose={() => setEditing(null)}
            onSaved={() => window.location.reload()}
          />
        </ContextualMediaDialog>
      )}
    </section>
  );
}
