"use client";

import Link from "next/link";

import {
  Bolt,
  Cpu,
  Info,
  LoaderCircle,
  MemoryStick,
  Monitor,
  Settings2,
} from "lucide-react";

import { useMemo } from "react";

import type {
  GamePerformanceCalibration,
} from "@/types/game";

import {
  estimateGamePerformance,
} from "./performance-model";
import type {
  EstimateSettings,
  GameEstimate,
  HardwareProfile,
  PerformanceTier,
} from "./types";
import {
  useResolvedHardwareProfile,
} from "./useResolvedHardwareProfile";

import styles from "./GamePerformanceEstimate.module.css";

const DEFAULT_SETTINGS: EstimateSettings = {
  resolution: "1080p",
  quality: "medium",
};

const tierMeta: Record<
  PerformanceTier,
  { label: string; className: string }
> = {
  excellent: {
    label: "Excelente",
    className: styles.tierExcellent,
  },
  good: {
    label: "Bueno",
    className: styles.tierGood,
  },
  acceptable: {
    label: "Aceptable",
    className: styles.tierAcceptable,
  },
  basic: {
    label: "Básico",
    className: styles.tierBasic,
  },
};

type GamePerformanceEstimateProps = {
  slug: string;
  calibration?: GamePerformanceCalibration;
};

function sourceLabel(profile: HardwareProfile | null) {
  if (!profile) return "Sin perfil";
  if (profile.source === "saved") return "Perfil guardado";
  if (profile.source === "manual") return "Perfil confirmado";
  if (profile.source === "example") return "Perfil de ejemplo";
  return "Detección local";
}

function confidenceLabel(estimate: GameEstimate | null) {
  if (!estimate?.canEstimate) return "Sin confianza";
  if (estimate.confidence === "high") return "Confianza alta";
  if (estimate.confidence === "medium") return "Confianza media";
  return "Confianza orientativa";
}

function ramLabel(profile: HardwareProfile | null) {
  if (!profile?.ramGb) return "RAM sin detectar";
  if (profile.ramKnowledge === "lower-bound") {
    return `${profile.ramGb} GB o más`;
  }
  if (profile.ramKnowledge === "approximate") {
    return `≈ ${profile.ramGb} GB`;
  }
  return `${profile.ramGb} GB`;
}

export default function GamePerformanceEstimate({
  slug,
  calibration,
}: GamePerformanceEstimateProps) {
  const {
    profile: hardware,
    status,
  } = useResolvedHardwareProfile();

  const estimate = useMemo(
    () =>
      hardware
        ? estimateGamePerformance(
            slug,
            hardware,
            DEFAULT_SETTINGS,
            calibration
          )
        : null,
    [calibration, hardware, slug]
  );

  const missingParts = useMemo(() => {
    const missing: string[] = [];

    if (!hardware?.cpu) missing.push("CPU");
    if (!hardware?.gpu) missing.push("GPU");
    if (!hardware?.ramGb) missing.push("RAM");

    return missing;
  }, [hardware]);

  const configurationHref =
    `/requisitos?juego=${encodeURIComponent(slug)}`;

  if (status === "loading") {
    return (
      <aside className={styles.panel} aria-live="polite">
        <div className={styles.header}>
          <span className={styles.eyebrow}>
            <Bolt size={14} aria-hidden="true" />
            FPS estimados según tu PC
          </span>
        </div>

        <div className={styles.stateRow}>
          <span className={styles.stateIcon}>
            <LoaderCircle
              className={styles.spinner}
              size={20}
              aria-hidden="true"
            />
          </span>

          <div className={styles.stateCopy}>
            <strong>Comprobando tu perfil de hardware</strong>
            <span>
              Usamos primero tu configuración guardada y, si no existe,
              intentamos una detección local desde el navegador.
            </span>
          </div>
        </div>
      </aside>
    );
  }

  if (
    status !== "ready" ||
    !estimate?.canEstimate ||
    !hardware
  ) {
    const missingText =
      estimate?.reason ??
      (missingParts.length
        ? `Falta confirmar ${missingParts.join(", ")}.`
        : status === "error"
          ? "No se pudo completar la detección local del hardware."
          : "No pudimos completar una lectura suficiente del hardware.");

    return (
      <aside className={styles.panel} aria-live="polite">
        <div className={styles.header}>
          <span className={styles.eyebrow}>
            <Bolt size={14} aria-hidden="true" />
            FPS estimados según tu PC
          </span>
          <span className={styles.source}>
            {sourceLabel(hardware)}
          </span>
        </div>

        <div className={styles.stateRow}>
          <span className={styles.stateIcon}>
            <Info size={20} aria-hidden="true" />
          </span>

          <div className={styles.stateCopy}>
            <strong>
              Todavía no hay datos suficientes para calcular FPS
            </strong>
            <span>{missingText}</span>
          </div>
        </div>

        <div className={styles.footer}>
          <p>
            El navegador no siempre puede revelar CPU, GPU o RAM con
            precisión. Puedes completar esos datos manualmente para obtener
            una estimación útil cuando el juego tenga calibración disponible.
          </p>

          <Link href={configurationHref}>
            <Settings2 size={14} aria-hidden="true" />
            Configurar mi PC
          </Link>
        </div>
      </aside>
    );
  }

  const tier = tierMeta[estimate.tier];

  return (
    <aside
      className={styles.panel}
      aria-label="Rendimiento estimado para tu PC"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          <Bolt size={14} aria-hidden="true" />
          FPS estimados según tu PC
        </span>

        <span className={styles.source}>
          {sourceLabel(hardware)}
        </span>
      </div>

      <div className={styles.resultRow}>
        <div className={styles.fps}>
          <strong>
            {estimate.minFps}–{estimate.maxFps}
          </strong>
          <span>FPS</span>
        </div>

        <div className={styles.resultMeta}>
          <strong className={tier.className}>
            {tier.label}
          </strong>
          <span>
            1080p · Calidad media · {confidenceLabel(estimate)}
          </span>
        </div>
      </div>

      <div
        className={styles.hardware}
        aria-label="Hardware usado para la estimación"
      >
        <span title={hardware.cpu?.name ?? "CPU sin detectar"}>
          <Cpu size={14} aria-hidden="true" />
          <b>{hardware.cpu?.name ?? "CPU sin detectar"}</b>
        </span>

        <span title={hardware.gpu?.name ?? "GPU sin detectar"}>
          <Monitor size={14} aria-hidden="true" />
          <b>{hardware.gpu?.name ?? "GPU sin detectar"}</b>
        </span>

        <span title={ramLabel(hardware)}>
          <MemoryStick size={14} aria-hidden="true" />
          <b>{ramLabel(hardware)}</b>
        </span>
      </div>

      <div className={styles.footer}>
        <p>
          Estimación orientativa para 1080p en calidad media, sin ray tracing,
          frame generation ni escalado. El resultado real puede variar según
          drivers, temperatura y configuración del juego.
        </p>

        <Link href={configurationHref}>
          <Settings2 size={14} aria-hidden="true" />
          Ajustar mi PC
        </Link>
      </div>
    </aside>
  );
}
