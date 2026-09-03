"use client";

import Image from "next/image";
import {
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";

import styles from "./AdminMediaLibraryPreview.module.css";

type Props = {
  kind: "image" | "video";
  src: string;
  name: string;
  details: string;
  usage: readonly string[];
  onClose: () => void;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function VideoPreview({ src, name }: { src: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      setPlaying(!video.paused && !video.ended);
    };

    sync();
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("ended", sync);

    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("ended", sync);
    };
  }, [src]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      await video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  function seekBy(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    const maximum = Number.isFinite(video.duration) ? video.duration : duration;
    video.currentTime = clamp(video.currentTime + delta, 0, maximum || 0);
  }

  function seekTo(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clamp(value, 0, duration || 0);
  }

  async function enterFullscreen() {
    const stage = stageRef.current;
    if (!stage?.requestFullscreen) return;
    await stage.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className={styles.videoShell}>
      <div ref={stageRef} className={styles.videoStage}>
        <video
          ref={videoRef}
          src={src}
          className={styles.video}
          muted
          playsInline
          preload="metadata"
          aria-label={`Vista previa de ${name}`}
          onClick={() => void togglePlayback()}
        />
      </div>
      <div className={styles.videoControls} aria-label="Controles del reproductor">
        <button type="button" onClick={() => seekBy(-10)} aria-label="Retroceder 10 segundos" title="Retroceder 10 segundos">
          <RotateCcw size={17} aria-hidden="true" />
          <span>10 s</span>
        </button>
        <button type="button" className={styles.primaryControl} onClick={() => void togglePlayback()} aria-label={playing ? "Pausar" : "Reproducir"}>
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          <span>{playing ? "Pausar" : "Reproducir"}</span>
        </button>
        <button type="button" onClick={() => seekBy(10)} aria-label="Avanzar 10 segundos" title="Avanzar 10 segundos">
          <RotateCw size={17} aria-hidden="true" />
          <span>10 s</span>
        </button>
        <label className={styles.timeline}>
          <span className={styles.srOnly}>Posición del video</span>
          <input
            type="range"
            min="0"
            max={Math.max(duration, 0)}
            step="0.05"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
          />
        </label>
        <span className={styles.timeReadout}>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <button type="button" onClick={() => void enterFullscreen()} aria-label="Pantalla completa" title="Pantalla completa">
          <Maximize2 size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function AdminMediaLibraryPreview({
  kind,
  src,
  name,
  details,
  usage,
  onClose,
}: Props) {
  return (
    <ContextualMediaDialog
      eyebrow={kind === "image" ? "IMAGEN DE BIBLIOTECA" : "VIDEO DE BIBLIOTECA"}
      title={name}
      description="Vista del archivo master. Los recortes de cada destino permanecen independientes."
      onClose={onClose}
    >
      <div className={styles.previewLayout}>
        {kind === "image" ? (
          <div className={styles.imageStage}>
            <Image
              src={src}
              alt={`Vista ampliada de ${name}`}
              fill
              sizes="92vw"
              className={styles.image}
            />
          </div>
        ) : (
          <VideoPreview src={src} name={name} />
        )}

        <div className={styles.metaBar}>
          <div>
            <strong>{details}</strong>
            <span>{usage.length ? `Usado en: ${usage.join(" · ")}` : "Disponible · sin destinos asignados"}</span>
          </div>
          <small>{kind === "video" ? "WebM editorial sin audio" : "Archivo fuente sin alterar"}</small>
        </div>
      </div>
    </ContextualMediaDialog>
  );
}
