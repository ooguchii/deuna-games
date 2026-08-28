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
import {
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  getStoredHardwareSnapshot,
  parseStoredHardwareProfile,
  PROFILE_STORAGE_KEY,
} from "@/features/game-finder/hardware-storage";
import {
  estimateGamePerformance,
} from "@/features/game-finder/performance-model";
import type {
  PerformanceTier,
} from "@/features/game-finder/types";

import styles from "./page.module.css";

type GameCompatibilityCardProps = {
  slug: string;
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

function subscribe(
  onStoreChange: () => void
) {
  function handleStorage(
    event: StorageEvent
  ) {
    if (
      event.key === null ||
      event.key === PROFILE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  }

  window.addEventListener(
    "storage",
    handleStorage
  );

  return () =>
    window.removeEventListener(
      "storage",
      handleStorage
    );
}

function getServerSnapshot() {
  return null;
}

export default function GameCompatibilityCard({
  slug,
}: GameCompatibilityCardProps) {
  const rawProfile = useSyncExternalStore(
    subscribe,
    getStoredHardwareSnapshot,
    getServerSnapshot
  );

  const profile = useMemo(
    () =>
      parseStoredHardwareProfile(
        rawProfile
      ),
    [rawProfile]
  );

  const estimate = useMemo(
    () =>
      profile
        ? estimateGamePerformance(
            slug,
            profile,
            {
              resolution: "1080p",
              quality: "medium",
            }
          )
        : null,
    [profile, slug]
  );

  if (!profile || !estimate?.canEstimate) {
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
              <p>Estimación para tu equipo</p>
            </div>
          </div>

          <span className={styles.compatibilityStatus}>
            Sin perfil
          </span>
        </div>

        <p className={styles.compatibilityEmpty}>
          Detecta lo que el navegador pueda identificar y completa manualmente los datos protegidos para obtener un rango de FPS.
        </p>

        <ol className={styles.compatibilitySteps}>
          <li>Detectamos datos disponibles</li>
          <li>Confirmas CPU, GPU y RAM</li>
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
          Perfil local
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
          <dd>{profile.ramGb} GB</dd>
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
        Estimación orientativa; no sustituye un benchmark ejecutado en tu equipo.
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
