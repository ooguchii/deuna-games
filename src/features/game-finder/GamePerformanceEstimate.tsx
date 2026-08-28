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

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  detectBrowserHardware,
  profileFromBrowserSnapshot,
} from "./browser-detection";
import {
  findCpuById,
  findGpuById,
} from "./hardware-catalog";
import {
  estimateGamePerformance,
} from "./performance-model";
import type {
  EstimateSettings,
  GameEstimate,
  HardwareProfile,
  MemoryMode,
  PerformanceTier,
} from "./types";

import styles from "./GamePerformanceEstimate.module.css";

const PROFILE_STORAGE_KEY = "deuna-games:hardware-profile:v2";

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

type EstimateState =
  | "loading"
  | "ready"
  | "incomplete"
  | "error";

type GamePerformanceEstimateProps = {
  slug: string;
};

function readStoredProfile(): HardwareProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const value = JSON.parse(raw) as {
      cpuId?: unknown;
      gpuId?: unknown;
      ramGb?: unknown;
      os?: unknown;
      memoryMode?: unknown;
      updatedAt?: unknown;
    };

    if (!value || typeof value !== "object") return null;
    if (typeof value.cpuId !== "string" || typeof value.gpuId !== "string") {
      return null;
    }

    const cpu = findCpuById(value.cpuId);
    const gpu = findGpuById(value.gpuId);
    const ramGb = typeof value.ramGb === "number" ? value.ramGb : Number.NaN;
    const memoryMode: MemoryMode =
      value.memoryMode === "single" || value.memoryMode === "dual"
        ? value.memoryMode
        : "unknown";

    if (!cpu || !gpu || !Number.isFinite(ramGb) || ramGb < 4 || ramGb > 256) {
      return null;
    }

    return {
      cpu,
      gpu,
      ramGb,
      ramKnowledge: "confirmed",
      os:
        typeof value.os === "string" && value.os.trim()
          ? value.os
          : "Sistema sin confirmar",
      memoryMode,
      source: "saved",
      confidence: "high",
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function sourceLabel(profile: HardwareProfile | null) {
  if (!profile) return "Sin perfil";
  if (profile.source === "saved") return "Perfil guardado";
  if (profile.source === "manual") return "Perfil confirmado";
  if (profile.source === "example") return "Perfil de ejemplo";
  return "Detección local";
}

function confidenceLabel(profile: HardwareProfile | null) {
  if (!profile) return "Sin confianza";
  if (profile.confidence === "high") return "Confianza alta";
  if (profile.confidence === "medium") return "Confianza media";
  return "Confianza orientativa";
}

function ramLabel(profile: HardwareProfile | null) {
  if (!profile?.ramGb) return "RAM sin detectar";
  if (profile.ramKnowledge === "lower-bound") return `${profile.ramGb} GB o más`;
  if (profile.ramKnowledge === "approximate") return `≈ ${profile.ramGb} GB`;
  return `${profile.ramGb} GB`;
}

export default function GamePerformanceEstimate({
  slug,
}: GamePerformanceEstimateProps) {
  const [state, setState] = useState<EstimateState>("loading");
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [estimate, setEstimate] = useState<GameEstimate | null>(null);

  useEffect(() => {
    let active = true;

    async function resolveEstimate() {
      setState("loading");

      try {
        let profile = readStoredProfile();

        if (!profile) {
          const snapshot = await detectBrowserHardware();
          profile = profileFromBrowserSnapshot(snapshot);
        }

        if (!active) return;

        setHardware(profile);

        const nextEstimate = estimateGamePerformance(
          slug,
          profile,
          DEFAULT_SETTINGS
        );

        setEstimate(nextEstimate);
        setState(nextEstimate.canEstimate ? "ready" : "incomplete");
      } catch {
        if (!active) return;

        setEstimate(null);
        setState("error");
      }
    }

    void resolveEstimate();

    return () => {
      active = false;
    };
  }, [slug]);

  const missingParts = useMemo(() => {
    const missing: string[] = [];

    if (!hardware?.cpu) missing.push("CPU");
    if (!hardware?.gpu) missing.push("GPU");
    if (!hardware?.ramGb) missing.push("RAM");

    return missing;
  }, [hardware]);

  if (state === "loading") {
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
            <LoaderCircle className={styles.spinner} size={20} aria-hidden="true" />
          </span>

          <div className={styles.stateCopy}>
            <strong>Comprobando tu perfil de hardware</strong>
            <span>
              Usamos primero tu configuración guardada y, si no existe, intentamos una detección local desde el navegador.
            </span>
          </div>
        </div>
      </aside>
    );
  }

  if (state !== "ready" || !estimate?.canEstimate || !hardware) {
    const missingText = missingParts.length
      ? `Falta confirmar ${missingParts.join(", ")}.`
      : "No pudimos completar una lectura suficiente del hardware.";

    return (
      <aside className={styles.panel} aria-live="polite">
        <div className={styles.header}>
          <span className={styles.eyebrow}>
            <Bolt size={14} aria-hidden="true" />
            FPS estimados según tu PC
          </span>
          <span className={styles.source}>{sourceLabel(hardware)}</span>
        </div>

        <div className={styles.stateRow}>
          <span className={styles.stateIcon}>
            <Info size={20} aria-hidden="true" />
          </span>

          <div className={styles.stateCopy}>
            <strong>Todavía no hay datos suficientes para calcular FPS</strong>
            <span>{missingText}</span>
          </div>
        </div>

        <div className={styles.footer}>
          <p>
            El navegador no siempre puede revelar CPU, GPU o RAM con precisión. Puedes completar esos datos manualmente para obtener una estimación útil.
          </p>

          <Link href="/requisitos">
            <Settings2 size={14} aria-hidden="true" />
            Configurar mi PC
          </Link>
        </div>
      </aside>
    );
  }

  const tier = tierMeta[estimate.tier];

  return (
    <aside className={styles.panel} aria-label="Rendimiento estimado para tu PC">
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          <Bolt size={14} aria-hidden="true" />
          FPS estimados según tu PC
        </span>

        <span className={styles.source}>{sourceLabel(hardware)}</span>
      </div>

      <div className={styles.resultRow}>
        <div className={styles.fps}>
          <strong>
            {estimate.minFps}–{estimate.maxFps}
          </strong>
          <span>FPS</span>
        </div>

        <div className={styles.resultMeta}>
          <strong className={tier.className}>{tier.label}</strong>
          <span>
            1080p · Calidad media · {confidenceLabel(hardware)}
          </span>
        </div>
      </div>

      <div className={styles.hardware} aria-label="Hardware usado para la estimación">
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
          Estimación orientativa para 1080p en calidad media, sin ray tracing, frame generation ni escalado. El resultado real puede variar según drivers, temperatura y configuración del juego.
        </p>

        <Link href="/requisitos">
          <Settings2 size={14} aria-hidden="true" />
          Ajustar mi PC
        </Link>
      </div>
    </aside>
  );
}
