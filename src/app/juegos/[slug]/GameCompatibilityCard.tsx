"use client";

import Link from "next/link";
import {
  Cpu,
  Gauge,
  MemoryStick,
  Monitor,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";

import {
  estimateGamePerformance,
} from "@/features/game-finder/performance-model";
import type {
  HardwareProfile,
  PerformanceTier,
} from "@/features/game-finder/types";
import {
  useResolvedHardwareProfile,
} from "@/features/game-finder/useResolvedHardwareProfile";
import type {
  GamePerformanceCalibration,
} from "@/types/game";

import styles from "./page.module.css";

type GameCompatibilityCardProps = {
  slug: string;
  calibration?: GamePerformanceCalibration;
};

const tierLabels: Record<
  PerformanceTier,
  string
> = {
  excellent: "Excelente",
  good: "Bueno",
  acceptable: "Aceptable",
  basic: "Básico",
};

const confidenceLabels = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;

const bottleneckLabels = {
  cpu: "CPU",
  gpu: "GPU",
  ram: "RAM",
  balanced: "Equilibrado",
} as const;

function ramLabel(profile: HardwareProfile) {
  if (!profile.ramGb) return "Sin detectar";
  if (profile.ramKnowledge === "lower-bound") {
    return `${profile.ramGb} GB o más`;
  }
  if (profile.ramKnowledge === "approximate") {
    return `≈ ${profile.ramGb} GB`;
  }
  return `${profile.ramGb} GB`;
}

function profileStatusLabel(profile: HardwareProfile) {
  if (profile.source === "saved") {
    return "Perfil guardado";
  }

  if (profile.source === "browser") {
    return "Detección local";
  }

  return "Perfil local";
}

export default function GameCompatibilityCard({
  slug,
  calibration,
}: GameCompatibilityCardProps) {
  const {
    profile,
    status,
  } = useResolvedHardwareProfile();

  const estimate = useMemo(
    () =>
      profile
        ? estimateGamePerformance(
            slug,
            profile,
            {
              resolution: "1080p",
              quality: "medium",
            },
            calibration
          )
        : null,
    [calibration, profile, slug]
  );

  if (
    status !== "ready" ||
    !profile ||
    !estimate?.canEstimate
  ) {
    const statusLabel =
      status === "loading"
        ? "Detectando"
        : "Datos incompletos";

    const description =
      status === "loading"
        ? "Estamos comprobando primero el perfil guardado y después los datos que el navegador pueda identificar."
        : estimate?.reason ??
          "La detección automática no obtuvo CPU, GPU y RAM suficientes para calcular un rango fiable.";

    return (
      <aside
        className={styles.compatibilityCard}
        aria-labelledby="compatibility-title"
        aria-live="polite"
      >
        <div className={styles.compatibilityTopline}>
          <div className={styles.compatibilityHeading}>
            <span className={styles.compatibilityIcon}>
              <Gauge size={20} aria-hidden="true" />
            </span>
            <div>
              <span className={styles.compatibilityEyebrow}>
                COMPATIBILIDAD
              </span>
              <h2 id="compatibility-title">
                ¿Me funciona?
              </h2>
              <p>Estimación para tu equipo</p>
            </div>
          </div>

          <span className={styles.compatibilityStatus}>
            {statusLabel}
          </span>
        </div>

        <p className={styles.compatibilityEmpty}>
          {description}
        </p>

        <ol className={styles.compatibilitySteps}>
          <li>Detectamos los datos disponibles</li>
          <li>Confirmas CPU, GPU y RAM si falta información</li>
          <li>Calculamos rendimiento orientativo</li>
        </ol>

        <Link
          href={`/requisitos?juego=${encodeURIComponent(
            slug
          )}`}
          className={styles.compatibilityAction}
        >
          <Settings2 size={16} aria-hidden="true" />
          Analizar o configurar mi PC
        </Link>
      </aside>
    );
  }

  return (
    <aside
      className={styles.compatibilityCard}
      aria-labelledby="compatibility-title"
    >
      <div className={styles.compatibilityTopline}>
        <div className={styles.compatibilityHeading}>
          <span className={styles.compatibilityIcon}>
            <Gauge size={20} aria-hidden="true" />
          </span>
          <div>
            <span className={styles.compatibilityEyebrow}>
              COMPATIBILIDAD
            </span>
            <h2 id="compatibility-title">
              ¿Me funciona?
            </h2>
            <p>1080p · calidad media</p>
          </div>
        </div>

        <span
          className={`${styles.compatibilityStatus} ${styles.compatibilityStatusReady}`}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          {profileStatusLabel(profile)}
        </span>
      </div>

      <dl className={styles.compatibilitySpecs}>
        <div>
          <dt>
            <Cpu size={15} aria-hidden="true" />
            Procesador
          </dt>
          <dd>{profile.cpu?.name}</dd>
        </div>
        <div>
          <dt>
            <Monitor size={15} aria-hidden="true" />
            Gráficos
          </dt>
          <dd>{profile.gpu?.name}</dd>
        </div>
        <div>
          <dt>
            <MemoryStick size={15} aria-hidden="true" />
            Memoria RAM
          </dt>
          <dd>{ramLabel(profile)}</dd>
        </div>
      </dl>

      <div
        className={`${styles.compatibilityResult} ${styles[`compatibility_${estimate.tier}`]}`}
      >
        <div>
          <span>Rendimiento estimado</span>
          <strong>{tierLabels[estimate.tier]}</strong>
        </div>
        <p>
          <strong>
            {estimate.minFps}–{estimate.maxFps}
          </strong>
          <span>FPS</span>
        </p>
      </div>

      <dl className={styles.compatibilityMeta}>
        <div>
          <dt>Confianza</dt>
          <dd>{confidenceLabels[estimate.confidence]}</dd>
        </div>
        <div>
          <dt>Posible límite</dt>
          <dd>{bottleneckLabels[estimate.bottleneck]}</dd>
        </div>
      </dl>

      <p className={styles.compatibilityNote}>
        Estimación orientativa; no sustituye un benchmark ejecutado en tu
        equipo.
      </p>

      <Link
        href={`/requisitos?juego=${encodeURIComponent(
          slug
        )}`}
        className={styles.compatibilityAction}
      >
        Ajustar resolución y calidad
      </Link>
    </aside>
  );
}
