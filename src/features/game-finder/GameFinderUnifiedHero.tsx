"use client";

import Image from "next/image";

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gamepad2,
  Info,
  LoaderCircle,
  MemoryStick,
  Monitor,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";

import type { Game } from "@/types/game";

import { usePublicFinderCopy } from "./PublicFinderCopyContext";
import type {
  GameEstimate,
  HardwareProfile,
  PerformanceTier,
} from "./types";

import styles from "./GameFinderUnifiedHero.module.css";

type DetectionState = "idle" | "detecting" | "ready" | "partial" | "error";

type Recommendation = {
  game: Game;
  estimate: GameEstimate | null;
};

type GameFinderUnifiedHeroProps = {
  recommendations: Recommendation[];
  hardware: HardwareProfile;
  profileTitle: string;
  ramLabel: string;
  detectionState: DetectionState;
  detectionStatus: string;
  detectionHint: string;
  detectionSource: string;
  hasRealAnalysis: boolean;
  onAnalyze: () => void;
  onConfigure: () => void;
  onDetect: () => void;
  onSelectGame: (slug: string) => void;
  onViewAll: () => void;
};

const tierLabel: Record<PerformanceTier, string> = {
  excellent: "Excelente",
  good: "Bueno",
  acceptable: "Aceptable",
  basic: "Básico",
};

export default function GameFinderUnifiedHero({
  recommendations,
  hardware,
  profileTitle,
  ramLabel,
  detectionState,
  detectionStatus,
  detectionHint,
  detectionSource,
  hasRealAnalysis,
  onAnalyze,
  onConfigure,
  onDetect,
  onSelectGame,
  onViewAll,
}: GameFinderUnifiedHeroProps) {
  const copy = usePublicFinderCopy();
  const isDetecting = detectionState === "detecting";
  const isReady = detectionState === "ready";
  const isWarning = detectionState === "partial" || detectionState === "error";

  return (
    <section className={styles.hero} aria-labelledby="finder-unified-title">
      <div className={styles.heroGlow} aria-hidden="true" />

      <div className={styles.copy}>
        <span className={styles.eyebrow}>{copy.eyebrow}</span>

        <h1 id="finder-unified-title">
          {copy.title}{"\u00a0"}
          <strong>{copy.highlight}</strong>
        </h1>

        <p>{copy.description}</p>

        <div className={styles.microFlow} aria-label="Resumen del proceso">
          {copy.flow.map((label, index) => (
            <span key={`${index}-${label}`}>
              {index > 0 && <i aria-hidden="true" />}
              <span>{label}</span>
            </span>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={onAnalyze}
            disabled={isDetecting}
            aria-busy={isDetecting}
          >
            {isDetecting ? (
              <>
                <LoaderCircle className={styles.spin} size={18} aria-hidden="true" />
                Detectando tu PC...
              </>
            ) : (
              <>
                <Target size={18} aria-hidden="true" />
                {hasRealAnalysis ? "Ver análisis con mi PC" : "Ver análisis de ejemplo"}
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>

          <button type="button" className={styles.secondaryAction} onClick={onConfigure}>
            <SlidersHorizontal size={18} aria-hidden="true" />
            Configurar perfil
          </button>
        </div>

        <div className={styles.trust}>
          <ShieldCheck size={15} aria-hidden="true" />
          {copy.trustText}
        </div>
      </div>

      <div className={styles.workspace}>
        <article className={styles.profileCard} aria-label="Perfil actual del equipo">
          <div className={styles.profileIdentity}>
            <div className={styles.profileIdentityTop} data-state={detectionState}>
              <span>TU PERFIL ACTUAL</span>
              {isDetecting ? (
                <LoaderCircle className={styles.spin} size={19} aria-hidden="true" />
              ) : isReady ? (
                <CheckCircle2 size={19} aria-hidden="true" />
              ) : (
                <Info size={19} aria-hidden="true" />
              )}
            </div>

            <div className={styles.profileTitleLine}>
              <strong>{profileTitle}</strong>
              <small>{detectionSource}</small>
            </div>

            <div
              className={styles.profileState}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className={styles.profileStateLabel} data-state={detectionState}>
                {isDetecting ? (
                  <LoaderCircle size={12} aria-hidden="true" />
                ) : isWarning ? (
                  <Info size={12} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={12} aria-hidden="true" />
                )}
                {detectionStatus}
              </span>
              <p className={styles.profileHint}>{detectionHint}</p>
            </div>
          </div>

          <dl className={styles.profileSpecs}>
            <div className={styles.specItem}>
              <dt className={styles.specLabel}>
                <Cpu size={15} aria-hidden="true" />
                CPU
              </dt>
              <dd title={hardware.cpu?.name ?? "No identificado"}>
                {hardware.cpu?.name ?? "No identificado"}
              </dd>
            </div>

            <div className={styles.specItem}>
              <dt className={styles.specLabel}>
                <Gamepad2 size={15} aria-hidden="true" />
                GPU
              </dt>
              <dd title={hardware.gpu?.name ?? "No identificada"}>
                {hardware.gpu?.name ?? "No identificada"}
              </dd>
            </div>

            <div className={styles.specItem}>
              <dt className={styles.specLabel}>
                <MemoryStick size={15} aria-hidden="true" />
                RAM
              </dt>
              <dd>{ramLabel}</dd>
            </div>

            <div className={styles.specItem}>
              <dt className={styles.specLabel}>
                <Monitor size={15} aria-hidden="true" />
                Sistema
              </dt>
              <dd title={hardware.os}>{hardware.os}</dd>
            </div>
          </dl>

          <div className={styles.profileActions}>
            <button type="button" onClick={onDetect} disabled={isDetecting}>
              <RefreshCw size={14} aria-hidden="true" />
              Detectar otra vez
            </button>
            <button type="button" className={styles.profileActionPrimary} onClick={onConfigure}>
              <SlidersHorizontal size={14} aria-hidden="true" />
              Cambiar configuración
            </button>
          </div>
        </article>

        <article className={styles.recommendationsPanel}>
          <div className={styles.recommendationsHeader}>
            <span>
              <Sparkles size={14} aria-hidden="true" />
              RECOMENDACIONES PARA TI
            </span>
            <button type="button" onClick={onViewAll}>
              Ver todas
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.recommendationsGrid}>
            {recommendations.map(({ game, estimate }, index) => {
              const canEstimate = Boolean(estimate?.canEstimate);
              const tier = canEstimate ? estimate!.tier : null;

              return (
                <button
                  key={game.slug}
                  type="button"
                  className={styles.recommendationCard}
                  onClick={() => onSelectGame(game.slug)}
                  aria-label={`Ver análisis de ${game.title}`}
                >
                  <div className={styles.recommendationMedia}>
                    {game.coverImage ? (
                      <Image
                        src={game.coverImage}
                        alt={game.imageAlt}
                        fill
                        sizes="(max-width: 640px) 150px, (max-width: 1260px) 22vw, 180px"
                        className={styles.recommendationImage}
                        priority={index < 2}
                      />
                    ) : (
                      <div className={styles.recommendationFallback} aria-hidden="true" />
                    )}
                    <div className={styles.recommendationShade} aria-hidden="true" />
                  </div>

                  <div className={styles.recommendationMeta}>
                    <strong data-tier={tier ?? "pending"}>
                      {tier ? tierLabel[tier] : "Configura tu PC"}
                    </strong>
                    <span>
                      {canEstimate
                        ? `${estimate!.minFps}–${estimate!.maxFps} FPS`
                        : "FPS pendientes"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.recommendationFooter}>
            <span>
              <Gamepad2 size={13} aria-hidden="true" />
              Según tu perfil actual
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
