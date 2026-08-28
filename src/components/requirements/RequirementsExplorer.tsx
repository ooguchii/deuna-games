"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Cpu,
  Gamepad2,
  Grid2X2,
  HardDrive,
  Heart,
  LayoutList,
  MemoryStick,
  Monitor,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";
import type { Game } from "@/types/game";

import styles from "./RequirementsExplorer.module.css";

type RequirementsExplorerProps = {
  games: Game[];
};

type ProfileId =
  | "essential"
  | "balanced"
  | "powerful";

type PerformanceTone =
  | "excellent"
  | "good"
  | "fair"
  | "basic";

type PerformanceFilter =
  | "all"
  | PerformanceTone;

type SortMode =
  | "performance"
  | "title"
  | "storage";

type ViewMode =
  | "grid"
  | "list";

type DemoProfile = {
  id: ProfileId;
  name: string;
  description: string;
  cpu: string;
  gpu: string;
  ram: string;
  system: string;
  multiplier: number;
};

type DemoResult = {
  game: Game;
  fps: number;
  storage: number;
  tone: PerformanceTone;
  label: string;
};

const profiles: DemoProfile[] = [
  {
    id: "essential",
    name: "Equipo esencial",
    description: "Para juegos livianos y calidad reducida",
    cpu: "AMD Ryzen 3 3200G",
    gpu: "Radeon Vega 8",
    ram: "8 GB",
    system: "Windows 10 64-bit",
    multiplier: 0.66,
  },
  {
    id: "balanced",
    name: "Equipo equilibrado",
    description: "Una referencia de gama media actual",
    cpu: "AMD Ryzen 5 5600G",
    gpu: "Radeon Vega 7",
    ram: "16 GB",
    system: "Windows 11 64-bit",
    multiplier: 1,
  },
  {
    id: "powerful",
    name: "Equipo potente",
    description: "Pensado para calidad alta y más fluidez",
    cpu: "AMD Ryzen 7 7700",
    gpu: "Radeon RX 7700 XT",
    ram: "32 GB",
    system: "Windows 11 64-bit",
    multiplier: 1.48,
  },
];

const basePerformance: Record<
  string,
  { fps: number; storage: number }
> = {
  "forza-horizon-5": { fps: 74, storage: 110 },
  "god-of-war-ragnarok": { fps: 48, storage: 190 },
  "elden-ring": { fps: 45, storage: 60 },
  "red-dead-redemption-2": { fps: 42, storage: 150 },
  "cyberpunk-2077": { fps: 38, storage: 70 },
  "hogwarts-legacy": { fps: 34, storage: 85 },
  "helldivers-2": { fps: 31, storage: 100 },
  "portal-2": { fps: 120, storage: 8 },
};

const performanceMeta: Record<
  PerformanceTone,
  { label: string; range: string }
> = {
  excellent: {
    label: "Excelente",
    range: "60+ FPS",
  },
  good: {
    label: "Bueno",
    range: "40–59 FPS",
  },
  fair: {
    label: "Aceptable",
    range: "28–39 FPS",
  },
  basic: {
    label: "Básico",
    range: "Menos de 28 FPS",
  },
};

const processSteps = [
  {
    icon: Cpu,
    title: "Eliges tu PC",
    text: "Seleccionás un perfil de hardware de ejemplo.",
  },
  {
    icon: Activity,
    title: "Comparamos",
    text: "Relacionamos el perfil con cada juego disponible.",
  },
  {
    icon: CircleGauge,
    title: "Ves el resultado",
    text: "Ordenamos los títulos por rendimiento estimado.",
  },
  {
    icon: Gamepad2,
    title: "Eliges y exploras",
    text: "Abrís la ficha del juego antes de decidir.",
  },
] as const;

function getPerformanceTone(
  fps: number
): PerformanceTone {
  if (fps >= 60) return "excellent";
  if (fps >= 40) return "good";
  if (fps >= 28) return "fair";
  return "basic";
}

function buildResults(
  games: Game[],
  profile: DemoProfile
): DemoResult[] {
  return games.map((game, index) => {
    const fallback = {
      fps: Math.max(24, 76 - index * 7),
      storage: 55 + index * 9,
    };
    const base =
      basePerformance[game.slug] ?? fallback;
    const fps = Math.max(
      18,
      Math.round(base.fps * profile.multiplier)
    );
    const tone = getPerformanceTone(fps);

    return {
      game,
      fps,
      storage: base.storage,
      tone,
      label: performanceMeta[tone].label,
    };
  });
}

export default function RequirementsExplorer({
  games,
}: RequirementsExplorerProps) {
  const [profileId, setProfileId] =
    useState<ProfileId>("balanced");
  const [showConfiguration, setShowConfiguration] =
    useState(false);
  const [performanceFilter, setPerformanceFilter] =
    useState<PerformanceFilter>("all");
  const [category, setCategory] =
    useState("all");
  const [sort, setSort] =
    useState<SortMode>("performance");
  const [view, setView] =
    useState<ViewMode>("grid");
  const [selectedSlug, setSelectedSlug] =
    useState(games[0]?.slug ?? "");
  const [favorites, setFavorites] =
    useState<string[]>([]);

  const profile =
    profiles.find((item) => item.id === profileId) ??
    profiles[1];

  const results = useMemo(
    () => buildResults(games, profile),
    [games, profile]
  );

  const categories = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(games.map((game) => game.category))
      ).sort((a, b) => a.localeCompare(b, "es")),
    ],
    [games]
  );

  const counts = useMemo(() => {
    return results.reduce(
      (accumulator, result) => {
        accumulator[result.tone] += 1;
        return accumulator;
      },
      {
        excellent: 0,
        good: 0,
        fair: 0,
        basic: 0,
      } as Record<PerformanceTone, number>
    );
  }, [results]);

  const visibleResults = useMemo(() => {
    const next = results.filter((result) => {
      const matchesPerformance =
        performanceFilter === "all" ||
        result.tone === performanceFilter;
      const matchesCategory =
        category === "all" ||
        result.game.category === category;

      return matchesPerformance && matchesCategory;
    });

    return [...next].sort((a, b) => {
      if (sort === "title") {
        return a.game.title.localeCompare(
          b.game.title,
          "es"
        );
      }

      if (sort === "storage") {
        return a.storage - b.storage;
      }

      return b.fps - a.fps;
    });
  }, [category, performanceFilter, results, sort]);

  const selectedResult =
    visibleResults.find(
      (result) => result.game.slug === selectedSlug
    ) ?? visibleResults[0];

  const featuredGames = games.slice(0, 4);
  const favorite = selectedResult
    ? favorites.includes(selectedResult.game.slug)
    : false;

  function scrollToResults() {
    document
      .getElementById("compatibility-results")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function resetFilters() {
    setPerformanceFilter("all");
    setCategory("all");
    setSort("performance");
  }

  function toggleFavorite() {
    if (!selectedResult) return;

    setFavorites((current) =>
      current.includes(selectedResult.game.slug)
        ? current.filter(
            (slug) => slug !== selectedResult.game.slug
          )
        : [...current, selectedResult.game.slug]
    );
  }

  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        aria-labelledby="requirements-title"
      >
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            COMPATIBILIDAD ORIENTATIVA
          </span>

          <h1 id="requirements-title">
            Descubre los juegos que
            <span> tu PC puede correr</span>
          </h1>

          <p>
            Prueba distintos perfiles de hardware y explora
            el catálogo según un rendimiento estimado. Esta
            primera versión utiliza información demostrativa.
          </p>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={scrollToResults}
            >
              <CircleGauge size={20} aria-hidden="true" />
              Ver análisis de ejemplo
              <ArrowRight size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setShowConfiguration((current) => !current)
              }
              aria-expanded={showConfiguration}
              aria-controls="demo-pc-configuration"
            >
              <Settings2 size={18} aria-hidden="true" />
              Configurar perfil
            </button>
          </div>

          <span className={styles.demoNotice}>
            <Sparkles size={15} aria-hidden="true" />
            Simulación visual: no escanea tu dispositivo.
          </span>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.coverMosaic} aria-hidden="true">
            {featuredGames.map((game, index) => (
              <div
                className={styles.mosaicCard}
                key={game.slug}
              >
                <GameMedia
                  src={game.coverImage}
                  alt=""
                  sizes="(max-width: 900px) 22vw, 150px"
                  priority={index < 2}
                />
              </div>
            ))}
            <div className={styles.mosaicShade} />
            <div className={styles.mosaicBadge}>
              <Gamepad2 size={17} aria-hidden="true" />
              Recomendaciones para tu equipo
            </div>
          </div>

          <article className={styles.detectedCard}>
            <div className={styles.detectedHeader}>
              <div>
                <span>Perfil seleccionado</span>
                <strong>{profile.name}</strong>
              </div>
              <CheckCircle2
                size={22}
                aria-label="Perfil listo"
              />
            </div>

            <dl className={styles.hardwareList}>
              <div>
                <dt>CPU</dt>
                <dd>{profile.cpu}</dd>
              </div>
              <div>
                <dt>GPU</dt>
                <dd>{profile.gpu}</dd>
              </div>
              <div>
                <dt>RAM</dt>
                <dd>{profile.ram}</dd>
              </div>
              <div>
                <dt>Sistema</dt>
                <dd>{profile.system}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setShowConfiguration(true)}
            >
              Cambiar configuración
            </button>
          </article>
        </div>
      </section>

      <section
        className={styles.process}
        aria-labelledby="process-title"
      >
        <div className={styles.processHeader}>
          <span>PROCESO SIMPLE</span>
          <h2 id="process-title">¿Cómo funciona?</h2>
        </div>

        <ol className={styles.processGrid}>
          {processSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li key={step.title}>
                <div className={styles.stepIcon}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{index + 1}</span>
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                {index < processSteps.length - 1 && (
                  <ChevronRight
                    className={styles.stepArrow}
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section
        id="demo-pc-configuration"
        className={`${styles.configuration} ${
          showConfiguration ? styles.configurationOpen : ""
        }`}
        aria-label="Configuración del perfil de prueba"
      >
        <div className={styles.configurationIntro}>
          <span>
            <SlidersHorizontal size={17} aria-hidden="true" />
            CONFIGURACIÓN DE PRUEBA
          </span>
          <h2>Elige un perfil para comparar</h2>
          <p>
            Los valores son demostrativos y puedes cambiarlos sin
            compartir información de tu dispositivo.
          </p>
        </div>

        <div className={styles.profileGrid}>
          {profiles.map((item) => {
            const active = item.id === profileId;

            return (
              <button
                type="button"
                className={`${styles.profileOption} ${
                  active ? styles.profileActive : ""
                }`}
                key={item.id}
                onClick={() => setProfileId(item.id)}
                aria-pressed={active}
              >
                <span className={styles.profileCheck}>
                  {active && <Check size={15} aria-hidden="true" />}
                </span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <span>{item.ram} · {item.gpu}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        id="compatibility-results"
        className={styles.resultsSection}
        aria-labelledby="results-title"
      >
        <header className={styles.resultsHeader}>
          <div>
            <span className={styles.eyebrow}>
              RESULTADOS DE DEMOSTRACIÓN
            </span>
            <div className={styles.resultsTitleRow}>
              <h2 id="results-title">
                Juegos que puedes jugar
              </h2>
              <span>{results.length} analizados</span>
            </div>
            <p>
              Estimaciones orientativas para el perfil {profile.name.toLowerCase()}.
            </p>
          </div>

          <div className={styles.resultsControls}>
            <div
              className={styles.viewToggle}
              role="group"
              aria-label="Vista de resultados"
            >
              <button
                type="button"
                className={view === "grid" ? styles.controlActive : ""}
                onClick={() => setView("grid")}
                aria-label="Vista en cuadrícula"
                aria-pressed={view === "grid"}
              >
                <Grid2X2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={view === "list" ? styles.controlActive : ""}
                onClick={() => setView("list")}
                aria-label="Vista en lista"
                aria-pressed={view === "list"}
              >
                <LayoutList size={19} aria-hidden="true" />
              </button>
            </div>

            <label className={styles.sortControl}>
              <span>Ordenar por</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortMode)
                }
              >
                <option value="performance">Mejor rendimiento</option>
                <option value="title">Nombre</option>
                <option value="storage">Menor tamaño</option>
              </select>
            </label>
          </div>
        </header>

        <div className={styles.resultsLayout}>
          <aside className={styles.filters}>
            <div className={styles.filterGroup}>
              <h3>Rendimiento estimado</h3>
              <div className={styles.performanceFilters}>
                {(Object.keys(performanceMeta) as PerformanceTone[]).map(
                  (tone) => (
                    <button
                      type="button"
                      key={tone}
                      className={`${styles.filterButton} ${
                        performanceFilter === tone
                          ? styles.filterSelected
                          : ""
                      }`}
                      onClick={() =>
                        setPerformanceFilter((current) =>
                          current === tone ? "all" : tone
                        )
                      }
                      aria-pressed={performanceFilter === tone}
                    >
                      <span
                        className={`${styles.filterIndicator} ${styles[tone]}`}
                      />
                      <span>
                        <strong>{performanceMeta[tone].label}</strong>
                        <small>{performanceMeta[tone].range}</small>
                      </span>
                      <b>{counts[tone]}</b>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="requirements-category">
                Género
              </label>
              <select
                id="requirements-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option value={item} key={item}>
                    {item === "all" ? "Todos los géneros" : item}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={styles.resetButton}
              onClick={resetFilters}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Limpiar filtros
            </button>

            <div className={styles.dataNote}>
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                <strong>Tu privacidad primero</strong>
                No leemos ni almacenamos datos reales de tu PC.
              </p>
            </div>
          </aside>

          <div
            className={`${styles.gamesGrid} ${
              view === "list" ? styles.gamesList : ""
            }`}
            aria-live="polite"
          >
            {visibleResults.map((result) => {
              const active =
                selectedResult?.game.slug === result.game.slug;

              return (
                <button
                  type="button"
                  className={`${styles.gameCard} ${
                    active ? styles.gameCardActive : ""
                  }`}
                  key={result.game.slug}
                  onClick={() => setSelectedSlug(result.game.slug)}
                  aria-pressed={active}
                >
                  <span className={styles.gameMedia}>
                    <GameMedia
                      src={result.game.coverImage}
                      alt={result.game.imageAlt}
                      sizes="(max-width: 720px) 88vw, (max-width: 1180px) 36vw, 240px"
                    />
                    <span className={styles.gameMediaShade} />
                  </span>

                  <span className={styles.gameCardContent}>
                    <strong>{result.game.title}</strong>
                    <span
                      className={`${styles.performanceBadge} ${styles[result.tone]}`}
                    >
                      <Zap size={13} aria-hidden="true" />
                      {result.label}
                      <b>{result.fps} FPS</b>
                    </span>
                    <span className={styles.gameMeta}>
                      <span>
                        <Gamepad2 size={13} aria-hidden="true" />
                        {result.game.category}
                      </span>
                      <span>
                        <HardDrive size={13} aria-hidden="true" />
                        {result.storage} GB
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}

            {visibleResults.length === 0 && (
              <div className={styles.emptyState}>
                <Gamepad2 size={32} aria-hidden="true" />
                <h3>No hay juegos con estos filtros</h3>
                <p>Prueba otra combinación para volver a ver resultados.</p>
                <button type="button" onClick={resetFilters}>
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>

          <aside className={styles.gameDetail} aria-live="polite">
            {selectedResult ? (
              <>
                <div className={styles.detailMedia}>
                  <GameMedia
                    src={selectedResult.game.coverImage}
                    alt={selectedResult.game.imageAlt}
                    sizes="(max-width: 1180px) 50vw, 360px"
                  />
                  <div className={styles.detailShade} />
                  <button
                    type="button"
                    className={`${styles.favoriteButton} ${
                      favorite ? styles.favoriteActive : ""
                    }`}
                    onClick={toggleFavorite}
                    aria-label={
                      favorite
                        ? `Quitar ${selectedResult.game.title} de favoritos`
                        : `Agregar ${selectedResult.game.title} a favoritos`
                    }
                    aria-pressed={favorite}
                  >
                    <Heart
                      size={20}
                      fill={favorite ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className={styles.detailContent}>
                  <h3>{selectedResult.game.title}</h3>
                  <div className={styles.detailTags}>
                    <span>{selectedResult.game.category}</span>
                    <span>PC</span>
                    <span>Estimación demo</span>
                  </div>

                  <div className={styles.detailPerformance}>
                    <span>Rendimiento estimado</span>
                    <strong className={styles[selectedResult.tone]}>
                      {selectedResult.label}
                    </strong>
                    <b>{selectedResult.fps} FPS</b>
                  </div>

                  <p>{selectedResult.game.description}</p>

                  <div className={styles.quickInfo}>
                    <h4>Información rápida</h4>
                    <dl>
                      <div>
                        <dt>Tamaño estimado</dt>
                        <dd>{selectedResult.storage} GB</dd>
                      </div>
                      <div>
                        <dt>Género</dt>
                        <dd>{selectedResult.game.category}</dd>
                      </div>
                      <div>
                        <dt>Versión</dt>
                        <dd>{selectedResult.game.version ?? "A confirmar"}</dd>
                      </div>
                    </dl>
                  </div>

                  <Link
                    href={`/juegos/${selectedResult.game.slug}`}
                    className={styles.detailPrimary}
                  >
                    Ver ficha del juego
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>

                  <Link
                    href="/juegos?equipo=requirements"
                    className={styles.detailSecondary}
                  >
                    <Monitor size={17} aria-hidden="true" />
                    Explorar juegos con requisitos
                  </Link>

                  <div className={styles.trustRow}>
                    <span>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      Datos orientativos
                    </span>
                    <span>
                      <MemoryStick size={14} aria-hidden="true" />
                      Sin escaneo real
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.detailEmpty}>
                <Gamepad2 size={30} aria-hidden="true" />
                <p>Elige un juego para ver su detalle.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
