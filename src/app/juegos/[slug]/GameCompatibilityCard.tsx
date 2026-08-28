"use client";

import Link from "next/link";
import {
  Cpu,
  Gauge,
  MemoryStick,
  Monitor,
  Settings2,
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
        <div className={styles.compatibilityHeading}>
          <span className={styles.compatibilityIcon}>
            <Gauge size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="compatibility-title">
              ¿Me funciona?
            </h2>
            <p>Basado en tu PC</p>
          </div>
        </div>

        <p className={styles.compatibilityEmpty}>
          Configurá tu equipo una vez y después podrás ver una estimación de rendimiento en cada juego.
        </p>

        <Link
          href={`/requisitos?juego=${encodeURIComponent(
            slug
          )}`}
          className={styles.compatibilityAction}
        >
          <Settings2 size={16} aria-hidden="true" />
          Configurar mi PC
        </Link>
      </aside>
    );
  }

  return (
    <aside
      className={styles.compatibilityCard}
      aria-labelledby="compatibility-title"
    >
      <div className={styles.compatibilityHeading}>
        <span className={styles.compatibilityIcon}>
          <Gauge size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="compatibility-title">
            ¿Me funciona?
          </h2>
          <p>1080p · calidad media</p>
        </div>
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
        <span>{tierLabels[estimate.tier]}</span>
        <strong>
          {estimate.minFps}–{estimate.maxFps} FPS
        </strong>
      </div>

      <p className={styles.compatibilityNote}>
        Estimación orientativa; no sustituye un benchmark ejecutado en tu equipo.
      </p>

      <Link
        href={`/requisitos?juego=${encodeURIComponent(
          slug
        )}`}
        className={styles.compatibilityAction}
      >
        Ver análisis completo
      </Link>
    </aside>
  );
}
