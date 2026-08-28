"use client";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  Bolt,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gamepad2,
  Grid2X2,
  Heart,
  Info,
  List,
  LoaderCircle,
  MemoryStick,
  Monitor,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Game } from "@/types/game";

import {
  detectBrowserHardware,
  profileFromBrowserSnapshot,
} from "./browser-detection";
import {
  cpuCatalog,
  findCpuById,
  findGpuById,
  gpuCatalog,
} from "./hardware-catalog";
import {
  PROFILE_STORAGE_KEY,
  readStoredHardwareProfile,
} from "./hardware-storage";
import { getPerformanceProfile } from "./performance-data";
import { estimateGamePerformance } from "./performance-model";
import type {
  BrowserHardwareSnapshot,
  EstimateSettings,
  GameEstimate,
  HardwareProfile,
  MemoryMode,
  PerformanceTier,
  QualityPreset,
  ResolutionPreset,
} from "./types";

import styles from "./GameFinderClient.module.css";

const FAVORITES_STORAGE_KEY = "deuna-games:finder-favorites:v2";

const EMPTY_PROFILE: HardwareProfile = {
  cpu: null,
  gpu: null,
  ramGb: null,
  ramKnowledge: "unknown",
  os: "Sistema sin confirmar",
  memoryMode: "unknown",
  source: "browser",
  confidence: "low",
  updatedAt: "",
};

const tierMeta: Record<
  PerformanceTier,
  { label: string; range: string; className: string }
> = {
  excellent: {
    label: "Excelente",
    range: "60+ FPS",
    className: styles.tierExcellent,
  },
  good: {
    label: "Bueno",
    range: "40–59 FPS",
    className: styles.tierGood,
  },
  acceptable: {
    label: "Aceptable",
    range: "28–39 FPS",
    className: styles.tierAcceptable,
  },
  basic: {
    label: "Básico",
    range: "Menos de 28 FPS",
    className: styles.tierBasic,
  },
};

const resolutionLabels: Record<ResolutionPreset, string> = {
  "720p": "1280×720",
  "1080p": "1920×1080",
  "1440p": "2560×1440",
  "2160p": "3840×2160",
};

const qualityLabels: Record<QualityPreset, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  ultra: "Ultra",
};

type ViewMode = "grid" | "list";
type SortMode = "performance" | "name";
type DetectionState = "idle" | "detecting" | "ready" | "partial" | "error";

type GameFinderClientProps = {
  games: Game[];
};

type ManualDraft = {
  cpuId: string;
  gpuId: string;
  ramGb: string;
  os: string;
  memoryMode: MemoryMode;
};

function nowIso() {
  return new Date().toISOString();
}

function readStoredFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set<string>();

    const values = JSON.parse(raw) as unknown;
    if (!Array.isArray(values)) return new Set<string>();

    return new Set(values.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

function profileToManualDraft(profile: HardwareProfile | null): ManualDraft {
  const cpuId = profile?.cpu && cpuCatalog.some((cpu) => cpu.id === profile.cpu?.id)
    ? profile.cpu.id
    : "";

  const gpuId = profile?.gpu && gpuCatalog.some((gpu) => gpu.id === profile.gpu?.id)
    ? profile.gpu.id
    : "";

  return {
    cpuId,
    gpuId,
    // Una cifra de RAM expuesta por el navegador no se precarga como si
    // estuviera confirmada. El usuario debe elegir la cantidad física real.
    ramGb: profile?.ramKnowledge === "confirmed" && profile.ramGb
      ? String(profile.ramGb)
      : "",
    os: profile?.os && profile.os !== "Sistema sin confirmar"
      ? profile.os
      : "Windows 11 64-bit",
    memoryMode: profile?.memoryMode ?? "unknown",
  };
}

function profileLabel(profile: HardwareProfile | null) {
  if (!profile) return "Sin configurar";
  if (profile.source === "example") return "Perfil de demostración";
  if (profile.source === "manual") return "Perfil confirmado";
  if (profile.source === "saved") return "Perfil guardado";
  return "Detección orientativa";
}

function profileRamLabel(profile: HardwareProfile) {
  if (!profile.ramGb) return "No disponible";
  if (profile.ramKnowledge === "lower-bound") return `${profile.ramGb} GB o más`;
  if (profile.ramKnowledge === "approximate") return `≈ ${profile.ramGb} GB`;
  return `${profile.ramGb} GB`;
}

function snapshotRamLabel(snapshot: BrowserHardwareSnapshot | null) {
  if (!snapshot?.approximateMemoryGb) return "Protegida";
  if (snapshot.memoryKind === "lower-bound") return `${snapshot.approximateMemoryGb} GB o más`;
  return `≈ ${snapshot.approximateMemoryGb} GB`;
}

function confidenceLabel(estimate: GameEstimate | null) {
  if (!estimate?.canEstimate) return "Sin cálculo";
  if (estimate.confidence === "high") return "Confianza alta";
  if (estimate.confidence === "medium") return "Confianza media";
  return "Confianza baja";
}

function bottleneckLabel(estimate: GameEstimate | null) {
  if (!estimate?.canEstimate) return "—";
  if (estimate.bottleneck === "cpu") return "CPU";
  if (estimate.bottleneck === "gpu") return "GPU";
  if (estimate.bottleneck === "ram") return "RAM";
  return "Equilibrado";
}

function sourceLabel(snapshot: BrowserHardwareSnapshot | null) {
  if (!snapshot) return "Sin lectura";
  if (snapshot.gpuSource === "webgpu") return "WebGPU";
  if (snapshot.gpuSource === "webgl") return "WebGL";
  return "Protegida";
}

function stopTilt(event: ReactPointerEvent<HTMLElement>) {
  const node = event.currentTarget;
  node.style.setProperty("--tilt-x", "0deg");
  node.style.setProperty("--tilt-y", "0deg");
  node.style.setProperty("--pointer-x", "50%");
  node.style.setProperty("--pointer-y", "50%");
  node.style.setProperty("--image-x", "0px");
  node.style.setProperty("--image-y", "0px");
}

function updateTilt(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;

  const node = event.currentTarget;
  const rect = node.getBoundingClientRect();
  const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

  const rotateY = (x - 0.5) * 8;
  const rotateX = (0.5 - y) * 7;

  node.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
  node.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
  node.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
  node.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
  node.style.setProperty("--image-x", `${((x - 0.5) * -8).toFixed(2)}px`);
  node.style.setProperty("--image-y", `${((y - 0.5) * -6).toFixed(2)}px`);
}

function GameResultCard({
  game,
  estimate,
  selected,
  favorite,
  view,
  onSelect,
  onFavorite,
}: {
  game: Game;
  estimate: GameEstimate;
  selected: boolean;
  favorite: boolean;
  view: ViewMode;
  onSelect: () => void;
  onFavorite: () => void;
}) {
  const tier = tierMeta[estimate.tier];

  return (
    <article
      className={`${styles.gameCard} ${selected ? styles.gameCardSelected : ""} ${
        view === "list" ? styles.gameCardList : ""
      }`}
      onPointerMove={updateTilt}
      onPointerLeave={stopTilt}
      style={
        {
          "--tilt-x": "0deg",
          "--tilt-y": "0deg",
          "--pointer-x": "50%",
          "--pointer-y": "50%",
          "--image-x": "0px",
          "--image-y": "0px",
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={styles.gameCardMain}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Seleccionar ${game.title}`}
      >
        <div className={styles.gameCardMedia}>
          {game.coverImage ? (
            <Image
              src={game.coverImage}
              alt={game.imageAlt}
              fill
              sizes={view === "list" ? "180px" : "(max-width: 760px) 100vw, 420px"}
              className={styles.gameCardImage}
            />
          ) : (
            <div className={styles.gameCardFallback} aria-hidden="true" />
          )}

          <div className={styles.gameCardShade} aria-hidden="true" />
          <div className={styles.gameCardSpotlight} aria-hidden="true" />
        </div>

        <div className={styles.gameCardContent}>
          <div className={styles.gameTitleRow}>
            <h3>{game.title}</h3>

            {selected && (
              <span className={styles.selectedMark}>
                <Check size={13} aria-hidden="true" />
                Seleccionado
              </span>
            )}
          </div>

          {estimate.canEstimate ? (
            <div className={`${styles.performanceBar} ${tier.className}`}>
              <span>
                <Bolt size={14} aria-hidden="true" />
                {tier.label}
              </span>
              <strong>{estimate.minFps}–{estimate.maxFps} FPS</strong>
            </div>
          ) : (
            <div className={`${styles.performanceBar} ${styles.performancePending}`}>
              <span>
                <Info size={14} aria-hidden="true" />
                Falta configurar
              </span>
              <strong>— FPS</strong>
            </div>
          )}

          <div className={styles.gameCardMeta}>
            <span>
              <Gamepad2 size={13} aria-hidden="true" />
              {game.category}
            </span>
            <span>
              <Monitor size={13} aria-hidden="true" />
              PC
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        className={`${styles.favoriteButton} ${favorite ? styles.favoriteButtonActive : ""}`}
        aria-label={favorite ? `Quitar ${game.title} de favoritos` : `Añadir ${game.title} a favoritos`}
        aria-pressed={favorite}
        onClick={onFavorite}
      >
        <Heart size={19} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

export default function GameFinderClient({ games }: GameFinderClientProps) {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [snapshot, setSnapshot] = useState<BrowserHardwareSnapshot | null>(null);
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [detectionMessage, setDetectionMessage] = useState("Preparando detección local...");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(() => profileToManualDraft(null));

  const [estimateSettings, setEstimateSettings] = useState<EstimateSettings>({
    resolution: "1080p",
    quality: "medium",
  });

  const [genre, setGenre] = useState("all");
  const [tierFilter, setTierFilter] = useState<PerformanceTier | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("performance");
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedSlug, setSelectedSlug] = useState(games[0]?.slug ?? "");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);

  const runDetection = useCallback(async () => {
    setDetectionState("detecting");
    setDetectionMessage("Leyendo únicamente la información que el navegador permite exponer...");

    try {
      const detected = await detectBrowserHardware();
      const browserProfile = profileFromBrowserSnapshot(detected);

      setSnapshot(detected);
      setHardware(browserProfile);
      setManualDraft(profileToManualDraft(browserProfile));

      const complete = Boolean(browserProfile.cpu && browserProfile.gpu && browserProfile.ramGb);
      setDetectionState(complete ? "ready" : "partial");
      setDetectionMessage(
        complete
          ? "Obtuvimos una base automática, pero CPU y RAM siguen limitadas por privacidad. Confirma los modelos para mejorar la precisión."
          : "El navegador protegió parte del hardware. Conservamos lo detectado y puedes completar solo lo que falte."
      );
    } catch {
      setDetectionState("error");
      setDetectionMessage("No se pudo completar la detección automática. Puedes cargar tu PC manualmente.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readStoredHardwareProfile();
      setFavorites(readStoredFavorites());
      setFavoritesHydrated(true);

      if (saved) {
        setHardware(saved);
        setManualDraft(profileToManualDraft(saved));
        setDetectionState("ready");
        setDetectionMessage("Cargamos tu perfil confirmado de este navegador. Puedes volver a detectar sin perderlo.");
        return;
      }

      void runDetection();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [runDetection]);

  useEffect(() => {
    if (
      !hardware ||
      hardware.source === "browser" ||
      hardware.source === "example" ||
      !hardware.cpu ||
      !hardware.gpu ||
      !hardware.ramGb
    ) {
      return;
    }

    try {
      window.localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          cpuId: hardware.cpu.id,
          gpuId: hardware.gpu.id,
          ramGb: hardware.ramGb,
          os: hardware.os,
          memoryMode: hardware.memoryMode,
          updatedAt: hardware.updatedAt,
        })
      );
    } catch {
      // El sitio funciona aunque el usuario bloquee localStorage.
    }
  }, [hardware]);

  useEffect(() => {
    if (!favoritesHydrated) return;

    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // Favoritos locales opcionales.
    }
  }, [favorites, favoritesHydrated]);

  const activeHardware = hardware ?? EMPTY_PROFILE;

  const estimates = useMemo(() => {
    return new Map(
      games.map((game) => [
        game.slug,
        estimateGamePerformance(game.slug, activeHardware, estimateSettings),
      ])
    );
  }, [activeHardware, estimateSettings, games]);

  const genres = useMemo(() => {
    return [...new Set(games.map((game) => game.category))].sort((a, b) => a.localeCompare(b, "es"));
  }, [games]);

  const tierCounts = useMemo(() => {
    const counts: Record<PerformanceTier, number> = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      basic: 0,
    };

    for (const estimate of estimates.values()) {
      if (estimate.canEstimate) counts[estimate.tier] += 1;
    }

    return counts;
  }, [estimates]);

  const visibleGames = useMemo(() => {
    const filtered = games.filter((game) => {
      if (genre !== "all" && game.category !== genre) return false;

      const estimate = estimates.get(game.slug);
      if (tierFilter !== "all" && estimate?.tier !== tierFilter) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.title.localeCompare(b.title, "es");

      const aFps = estimates.get(a.slug)?.fps ?? -1;
      const bFps = estimates.get(b.slug)?.fps ?? -1;
      return bFps - aFps;
    });
  }, [estimates, games, genre, sortMode, tierFilter]);

  const selectedGame =
    visibleGames.find((game) => game.slug === selectedSlug) ??
    visibleGames[0] ??
    games[0];
  const selectedEstimate = selectedGame ? estimates.get(selectedGame.slug) ?? null : null;
  const selectedProfile = selectedGame ? getPerformanceProfile(selectedGame.slug) : null;
  const selectedManualGpu = findGpuById(manualDraft.gpuId);
  const manualRamGb = Number(manualDraft.ramGb);
  const manualProfileReady = Boolean(
    manualDraft.cpuId &&
    manualDraft.gpuId &&
    Number.isFinite(manualRamGb) &&
    manualRamGb >= 4 &&
    manualRamGb <= 256
  );

  function toggleFavorite(slug: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function applyManualProfile() {
    const cpu = findCpuById(manualDraft.cpuId);
    const gpu = findGpuById(manualDraft.gpuId);
    const ramGb = Number(manualDraft.ramGb);

    if (!cpu || !gpu || !Number.isFinite(ramGb) || ramGb < 4 || ramGb > 256) return;

    const manualProfile: HardwareProfile = {
      cpu,
      gpu,
      ramGb,
      ramKnowledge: "confirmed",
      os: manualDraft.os || "Sistema sin confirmar",
      memoryMode: gpu.integrated ? manualDraft.memoryMode : "unknown",
      source: "manual",
      confidence: "high",
      updatedAt: nowIso(),
    };

    setHardware(manualProfile);
    setDetectionState("ready");
    setDetectionMessage("Perfil confirmado manualmente. Guardamos estos componentes solo en este navegador.");
    setSettingsOpen(false);
  }

  function useExampleProfile() {
    const cpu = findCpuById("ryzen-5-5600g");
    const gpu = findGpuById("radeon-vega-7");
    if (!cpu || !gpu) return;

    const example: HardwareProfile = {
      cpu,
      gpu,
      ramGb: 16,
      ramKnowledge: "confirmed",
      os: "Windows 11 64-bit",
      memoryMode: "dual",
      source: "example",
      confidence: "high",
      updatedAt: nowIso(),
    };

    setHardware(example);
    setManualDraft(profileToManualDraft(example));
    setDetectionState("ready");
    setDetectionMessage("Perfil de demostración activo: Ryzen 5 5600G + Radeon Vega 7 + 16 GB dual-channel.");
  }

  function resetFilters() {
    setGenre("all");
    setTierFilter("all");
    setSortMode("performance");
  }

  const canEstimate = Boolean(activeHardware.cpu && activeHardware.gpu && activeHardware.ramGb);

  return (
    <div className={styles.finderRoot}>
      <section className={styles.hero} aria-labelledby="finder-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>COMPATIBILIDAD ORIENTATIVA</span>

          <h1 id="finder-title">
            Descubre los juegos que
            <strong> tu PC puede correr</strong>
          </h1>

          <p>
            Detectamos lo que el navegador permite, completas lo que falte y calculamos un rango de FPS según resolución y calidad.
          </p>

          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryAction} onClick={useExampleProfile}>
              <Target size={18} aria-hidden="true" />
              Ver análisis de ejemplo
              <ArrowRight size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                setManualDraft(profileToManualDraft(hardware));
                setSettingsOpen(true);
              }}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              Configurar perfil
            </button>
          </div>

          <div className={styles.heroTrust}>
            <ShieldCheck size={15} aria-hidden="true" />
            La detección y el cálculo se procesan en tu navegador. No leemos tus archivos ni instalamos nada.
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroCovers}>
            {games.slice(0, 4).map((game, index) => (
              <div
                key={game.slug}
                className={styles.heroCover}
                style={{ "--cover-index": index } as CSSProperties}
              >
                {game.coverImage && (
                  <Image
                    src={game.coverImage}
                    alt=""
                    fill
                    sizes="180px"
                    className={styles.heroCoverImage}
                    priority={index < 2}
                  />
                )}
              </div>
            ))}

            <span className={styles.heroRecommendationBadge}>
              <Gamepad2 size={14} aria-hidden="true" />
              Recomendaciones para tu equipo
            </span>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileCardHeader}>
              <div>
                <span>PERFIL ACTUAL</span>
                <strong>{profileLabel(hardware)}</strong>
              </div>

              {detectionState === "detecting" ? (
                <LoaderCircle className={styles.spin} size={22} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} aria-hidden="true" />
              )}
            </div>

            <dl className={styles.profileSpecs}>
              <div>
                <dt>CPU</dt>
                <dd>{activeHardware.cpu?.name ?? "No identificado"}</dd>
              </div>
              <div>
                <dt>GPU</dt>
                <dd>{activeHardware.gpu?.name ?? "No identificada"}</dd>
              </div>
              <div>
                <dt>RAM</dt>
                <dd>{profileRamLabel(activeHardware)}</dd>
              </div>
              <div>
                <dt>Sistema</dt>
                <dd>{activeHardware.os}</dd>
              </div>
            </dl>

            <button
              type="button"
              className={styles.profileChangeButton}
              onClick={() => {
                setManualDraft(profileToManualDraft(hardware));
                setSettingsOpen(true);
              }}
            >
              Cambiar configuración
            </button>
          </div>
        </div>
      </section>

      <section className={styles.detectionPanel} aria-labelledby="detection-title">
        <div className={styles.detectionIntro}>
          <div className={styles.detectionIcon}>
            <Cpu size={21} aria-hidden="true" />
          </div>

          <div>
            <span className={styles.sectionKicker}>DETECCIÓN LOCAL</span>
            <h2 id="detection-title">Tu hardware, con límites claros</h2>
            <p>{detectionMessage}</p>
          </div>
        </div>

        <div className={styles.detectionFacts}>
          <div>
            <span>CPU visible</span>
            <strong>{snapshot?.logicalProcessors ? `${snapshot.logicalProcessors} hilos · modelo protegido` : hardware?.cpu?.name ?? "Sin confirmar"}</strong>
          </div>
          <div>
            <span>RAM visible</span>
            <strong>{snapshot ? snapshotRamLabel(snapshot) : profileRamLabel(activeHardware)}</strong>
          </div>
          <div>
            <span>GPU / API</span>
            <strong>{snapshot?.gpuRenderer ?? hardware?.gpu?.name ?? "Sin confirmar"}</strong>
            <small>{sourceLabel(snapshot)}</small>
          </div>
        </div>

        <div className={styles.detectionActions}>
          <button type="button" className={styles.detectAgainButton} onClick={() => void runDetection()} disabled={detectionState === "detecting"}>
            <RefreshCw size={16} aria-hidden="true" />
            Detectar otra vez
          </button>

          <button
            type="button"
            className={styles.manualButton}
            onClick={() => {
              setManualDraft(profileToManualDraft(hardware));
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={16} aria-hidden="true" />
            Confirmar manualmente
          </button>
        </div>
      </section>

      {settingsOpen && (
        <section className={styles.configPanel} aria-labelledby="config-title">
          <div className={styles.configHeader}>
            <div>
              <span className={styles.sectionKicker}>PERFIL MANUAL</span>
              <h2 id="config-title">Confirma los componentes de tu PC</h2>
              <p>Los datos automáticos sirven como ayuda. Para estimaciones más útiles, confirma el modelo exacto de CPU, GPU y la RAM física.</p>
            </div>

            <button type="button" className={styles.closeConfig} onClick={() => setSettingsOpen(false)} aria-label="Cerrar configuración">
              <X size={20} />
            </button>
          </div>

          <div className={styles.configGrid}>
            <label>
              <span>Procesador</span>
              <select value={manualDraft.cpuId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setManualDraft((current) => ({ ...current, cpuId: event.target.value }))}>
                <option value="">Selecciona tu CPU</option>
                {cpuCatalog.map((cpu) => (
                  <option key={cpu.id} value={cpu.id}>{cpu.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Tarjeta gráfica</span>
              <select value={manualDraft.gpuId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setManualDraft((current) => ({ ...current, gpuId: event.target.value }))}>
                <option value="">Selecciona tu GPU</option>
                {gpuCatalog.map((gpu) => (
                  <option key={gpu.id} value={gpu.id}>{gpu.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Memoria RAM física</span>
              <select value={manualDraft.ramGb} onChange={(event: ChangeEvent<HTMLSelectElement>) => setManualDraft((current) => ({ ...current, ramGb: event.target.value }))}>
                <option value="">Selecciona tu RAM</option>
                {[4, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128, 192, 256].map((ram) => (
                  <option key={ram} value={ram}>{ram} GB</option>
                ))}
              </select>
            </label>

            <label>
              <span>Sistema operativo</span>
              <select value={manualDraft.os} onChange={(event: ChangeEvent<HTMLSelectElement>) => setManualDraft((current) => ({ ...current, os: event.target.value }))}>
                <option>Windows 11 64-bit</option>
                <option>Windows 10 64-bit</option>
                <option>Linux 64-bit</option>
                <option>Otro / no estoy seguro</option>
              </select>
            </label>

            {selectedManualGpu?.integrated && (
              <label>
                <span>Canales de memoria</span>
                <select value={manualDraft.memoryMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setManualDraft((current) => ({ ...current, memoryMode: event.target.value as MemoryMode }))}>
                  <option value="unknown">No lo sé</option>
                  <option value="single">Single-channel / un módulo</option>
                  <option value="dual">Dual-channel / dos módulos</option>
                </select>
              </label>
            )}
          </div>

          <div className={styles.configFooter}>
            <p>
              <Info size={15} aria-hidden="true" />
              {selectedManualGpu?.integrated
                ? "En gráficas integradas, single/dual-channel puede cambiar bastante el rendimiento y por eso entra en el cálculo."
                : "La CPU exacta no puede leerse desde una web estándar. Si el navegador no la identifica, elegirla aquí es la opción más fiable."}
            </p>

            <button
              type="button"
              className={styles.saveProfileButton}
              onClick={applyManualProfile}
              disabled={!manualProfileReady}
            >
              Guardar y recalcular
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <section className={styles.processStrip} aria-labelledby="process-title">
        <div className={styles.processHeading}>
          <span>PROCESO SIMPLE</span>
          <h2 id="process-title">¿Cómo funciona?</h2>
        </div>

        {[
          [Cpu, "Eliges tu PC", "Detectamos lo posible y confirmas lo que falte."],
          [Sparkles, "Comparamos", "Relacionamos CPU, GPU y RAM con la exigencia de cada juego."],
          [Target, "Ves un rango", "Calculamos FPS orientativos para tu resolución y calidad."],
          [Gamepad2, "Eliges y exploras", "Abres la ficha del juego antes de decidir."],
        ].map(([Icon, title, text], index) => {
          const StepIcon = Icon as typeof Cpu;

          return (
            <div key={String(title)} className={styles.processStep}>
              <div className={styles.processIcon}>
                <StepIcon size={20} aria-hidden="true" />
                <span>{index + 1}</span>
              </div>
              <div>
                <strong>{String(title)}</strong>
                <p>{String(text)}</p>
              </div>
              {index < 3 && <ChevronRight className={styles.processArrow} size={18} aria-hidden="true" />}
            </div>
          );
        })}
      </section>

      <section className={styles.resultsSection} aria-labelledby="results-title">
        <div className={styles.resultsHeader}>
          <div>
            <span className={styles.sectionKicker}>RESULTADOS PARA TU PERFIL</span>
            <div className={styles.resultsTitleLine}>
              <h2 id="results-title">Juegos que puedes jugar</h2>
              <span>{visibleGames.length} analizados</span>
            </div>
            <p>
              {canEstimate
                ? `Estimación en ${resolutionLabels[estimateSettings.resolution]} · calidad ${qualityLabels[estimateSettings.quality].toLowerCase()}.`
                : "Completa CPU, GPU y RAM para activar los FPS orientativos."}
            </p>
          </div>

          <div className={styles.resultControls}>
            <div className={styles.viewToggle} aria-label="Vista de resultados">
              <button type="button" className={view === "grid" ? styles.viewActive : ""} onClick={() => setView("grid")} aria-label="Vista cuadrícula" aria-pressed={view === "grid"}>
                <Grid2X2 size={17} />
              </button>
              <button type="button" className={view === "list" ? styles.viewActive : ""} onClick={() => setView("list")} aria-label="Vista lista" aria-pressed={view === "list"}>
                <List size={18} />
              </button>
            </div>

            <label className={styles.sortControl}>
              <span>Ordenar por</span>
              <select value={sortMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSortMode(event.target.value as SortMode)}>
                <option value="performance">Mejor rendimiento</option>
                <option value="name">Nombre A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.resultsLayout}>
          <aside className={styles.filtersPanel} aria-label="Filtros de rendimiento">
            <h3>Rendimiento estimado</h3>

            <div className={styles.tierFilters}>
              {(Object.keys(tierMeta) as PerformanceTier[]).map((tier) => {
                const meta = tierMeta[tier];
                const active = tierFilter === tier;

                return (
                  <button
                    type="button"
                    key={tier}
                    className={`${styles.tierFilter} ${meta.className} ${active ? styles.tierFilterActive : ""}`}
                    onClick={() => setTierFilter((current) => current === tier ? "all" : tier)}
                    aria-pressed={active}
                  >
                    <span className={styles.tierDot} />
                    <span>
                      <strong>{meta.label}</strong>
                      <small>{meta.range}</small>
                    </span>
                    <b>{tierCounts[tier]}</b>
                  </button>
                );
              })}
            </div>

            <div className={styles.filterDivider} />

            <label className={styles.filterField}>
              <span>Género</span>
              <select value={genre} onChange={(event: ChangeEvent<HTMLSelectElement>) => setGenre(event.target.value)}>
                <option value="all">Todos los géneros</option>
                {genres.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className={styles.filterField}>
              <span>Resolución</span>
              <select
                value={estimateSettings.resolution}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setEstimateSettings((current) => ({ ...current, resolution: event.target.value as ResolutionPreset }))}
              >
                {(Object.keys(resolutionLabels) as ResolutionPreset[]).map((item) => (
                  <option key={item} value={item}>{item} · {resolutionLabels[item]}</option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span>Calidad gráfica</span>
              <select
                value={estimateSettings.quality}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setEstimateSettings((current) => ({ ...current, quality: event.target.value as QualityPreset }))}
              >
                {(Object.keys(qualityLabels) as QualityPreset[]).map((item) => (
                  <option key={item} value={item}>{qualityLabels[item]}</option>
                ))}
              </select>
            </label>

            <button type="button" className={styles.clearFilters} onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              Limpiar filtros
            </button>

            <div className={styles.privacyBox}>
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Tu privacidad primero</strong>
                <p>El perfil confirmado se guarda solo en este navegador. Una nueva detección automática no borra ese perfil.</p>
              </div>
            </div>
          </aside>

          <div className={`${styles.gamesArea} ${view === "list" ? styles.gamesAreaList : ""}`}>
            {visibleGames.length ? (
              visibleGames.map((game) => (
                <GameResultCard
                  key={game.slug}
                  game={game}
                  estimate={estimates.get(game.slug)!}
                  selected={selectedGame?.slug === game.slug}
                  favorite={favorites.has(game.slug)}
                  view={view}
                  onSelect={() => setSelectedSlug(game.slug)}
                  onFavorite={() => toggleFavorite(game.slug)}
                />
              ))
            ) : (
              <div className={styles.emptyResults}>
                <SlidersHorizontal size={26} aria-hidden="true" />
                <h3>No hay juegos con esos filtros</h3>
                <p>Prueba otra categoría o quita el filtro de rendimiento.</p>
                <button type="button" onClick={resetFilters}>Restablecer filtros</button>
              </div>
            )}
          </div>

          {selectedGame && (
            <aside className={styles.detailPanel} aria-label={`Detalle de ${selectedGame.title}`}>
              <div className={styles.detailMedia}>
                {selectedGame.coverImage && (
                  <Image
                    src={selectedGame.coverImage}
                    alt={selectedGame.imageAlt}
                    fill
                    sizes="330px"
                    className={styles.detailImage}
                  />
                )}
                <div className={styles.detailShade} aria-hidden="true" />

                <button
                  type="button"
                  className={`${styles.detailFavorite} ${favorites.has(selectedGame.slug) ? styles.favoriteButtonActive : ""}`}
                  onClick={() => toggleFavorite(selectedGame.slug)}
                  aria-label={favorites.has(selectedGame.slug) ? "Quitar de favoritos" : "Añadir a favoritos"}
                >
                  <Heart size={19} fill={favorites.has(selectedGame.slug) ? "currentColor" : "none"} />
                </button>
              </div>

              <div className={styles.detailBody}>
                <h3>{selectedGame.title}</h3>

                <div className={styles.detailTags}>
                  <span>{selectedGame.category}</span>
                  <span>PC</span>
                  <span>{confidenceLabel(selectedEstimate)}</span>
                </div>

                <div className={styles.detailEstimate}>
                  <span>Rendimiento estimado</span>
                  {selectedEstimate?.canEstimate ? (
                    <strong className={tierMeta[selectedEstimate.tier].className}>
                      {tierMeta[selectedEstimate.tier].label}
                      <b>{selectedEstimate.minFps}–{selectedEstimate.maxFps} FPS</b>
                    </strong>
                  ) : (
                    <strong className={styles.performancePending}>Configura tu PC <b>— FPS</b></strong>
                  )}
                </div>

                <p className={styles.detailDescription}>{selectedGame.description}</p>

                <div className={styles.quickInfo}>
                  <h4>Información rápida</h4>
                  <dl>
                    <div><dt>Espacio estimado</dt><dd>{selectedProfile?.storageGb ? `${selectedProfile.storageGb} GB` : "A confirmar"}</dd></div>
                    <div><dt>Género</dt><dd>{selectedGame.category}</dd></div>
                    <div><dt>Cuello de botella</dt><dd>{bottleneckLabel(selectedEstimate)}</dd></div>
                    <div><dt>Escenario</dt><dd>{estimateSettings.resolution} · {qualityLabels[estimateSettings.quality]}</dd></div>
                  </dl>
                </div>

                <Link href={`/juegos/${selectedGame.slug}`} className={styles.detailPrimaryLink}>
                  Ver ficha del juego
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>

                <Link href="/juegos" className={styles.detailSecondaryLink}>
                  <Monitor size={16} aria-hidden="true" />
                  Explorar catálogo completo
                </Link>

                <div className={styles.detailFootnote}>
                  <span><CheckCircle2 size={13} /> Datos orientativos</span>
                  <span><MemoryStick size={13} /> Sin escaneo real</span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className={styles.methodNote} aria-label="Cómo interpretar las estimaciones">
        <Bolt size={20} aria-hidden="true" />
        <div>
          <strong>Los FPS son un rango, no una promesa.</strong>
          <p>
            Drivers, temperatura, procesos en segundo plano, versión del juego y memoria pueden cambiar el resultado. La RAM expuesta por el navegador se trata como aproximada —8 GB puede significar 8 GB o más— y ensancha el rango en lugar de asumirse como exacta. El modelo toma 1080p/Medio como referencia y no simula ray tracing, frame generation ni escalado.
          </p>
        </div>
      </section>
    </div>
  );
}
