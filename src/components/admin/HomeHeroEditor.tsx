"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitCompare,
  Laptop,
  Minus,
  Monitor,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Send,
  Smartphone,
  Trash2,
  Undo2,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import type React from "react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import type {
  HomeCurationMode,
  HomeHeroDevice,
  HomeHeroPosition,
  HomeHeroPositionStyle,
  HomeHeroPresentation,
  ResolvedHomeConfig,
} from "@/data/home-config";
import { HOME_HERO_MAX_SLIDES } from "@/lib/home/hero-contract";
import {
  HOME_HERO_VISUAL_POSITIONS,
  homeHeroPositionOffset,
  homeHeroPositionTransform,
  homeHeroVisiblePositions,
  type HomeHeroVisualPosition,
} from "@/lib/home/hero-layout";
import { resolveHomeCollectionGames } from "@/lib/home/ranking";
import type { Game } from "@/types/game";

import styles from "./HomeHeroEditor.module.css";

type State = {
  slugs: string[];
  presentation: HomeHeroPresentation;
  mode: HomeCurationMode;
};

type PresetName =
  | "Classic"
  | "Coverflow"
  | "Cinema"
  | "Stack"
  | "Arc"
  | "Perspective"
  | "Minimal"
  | "Spotlight"
  | "Cards"
  | "Custom";

type TransitionName =
  | "Slide"
  | "Coverflow"
  | "Fade"
  | "3D"
  | "Stack"
  | "Perspective"
  | "Custom";

const positionList: Array<{ id: HomeHeroPosition; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "main", label: "Principal" },
  { id: "left1", label: "Izquierda 1" },
  { id: "left2", label: "Izquierda 2" },
  { id: "right1", label: "Derecha 1" },
  { id: "right2", label: "Derecha 2" },
];

const devices: Array<{
  id: HomeHeroDevice;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Laptop },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

const presets: PresetName[] = [
  "Classic",
  "Coverflow",
  "Cinema",
  "Stack",
  "Arc",
  "Perspective",
  "Minimal",
  "Spotlight",
  "Cards",
  "Custom",
];

const transitions: TransitionName[] = [
  "Slide",
  "Coverflow",
  "Fade",
  "3D",
  "Stack",
  "Perspective",
  "Custom",
];

const clone = <T,>(value: T): T => structuredClone(value);
const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const neutralPosition: HomeHeroPositionStyle = {
  scale: 1,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  translateX: 0,
  translateY: 0,
  translateZ: 0,
  opacity: 100,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

function position(
  overrides: Partial<HomeHeroPositionStyle>
): HomeHeroPositionStyle {
  return { ...neutralPosition, ...overrides };
}

function transitionMotion(
  transition: HomeHeroPresentation["transition"]
): HomeHeroPresentation["motion"] {
  if (transition === "fade") return "fade";
  if (transition === "slide") return "slide";
  return "depth";
}

function applyPreset(
  name: PresetName,
  value: HomeHeroPresentation
) {
  if (name === "Custom") {
    return { ...clone(value), preset: "custom" as const };
  }

  const next = clone(value);
  next.positions.all = position({});
  next.positions.main = position({ translateZ: 80, saturation: 105 });

  const setSides = (
    near: Partial<HomeHeroPositionStyle>,
    far: Partial<HomeHeroPositionStyle>
  ) => {
    next.positions.left1 = position({ ...near, translateX: -Math.abs(near.translateX ?? 0), rotateY: Math.abs(near.rotateY ?? 0) });
    next.positions.right1 = position({ ...near, translateX: Math.abs(near.translateX ?? 0), rotateY: -Math.abs(near.rotateY ?? 0) });
    next.positions.left2 = position({ ...far, translateX: -Math.abs(far.translateX ?? 0), rotateY: Math.abs(far.rotateY ?? 0) });
    next.positions.right2 = position({ ...far, translateX: Math.abs(far.translateX ?? 0), rotateY: -Math.abs(far.rotateY ?? 0) });
  };

  if (name === "Classic") {
    setSides(
      { scale: .84, translateX: 70, translateZ: -80, opacity: 76, brightness: 82, saturation: 88 },
      { scale: .69, translateX: 126, translateZ: -170, opacity: 44, blur: 1, brightness: 66, saturation: 72 }
    );
    next.radius = 16;
    next.transition = "slide";
    next.composition = "studio";
  }

  if (name === "Coverflow") {
    setSides(
      { scale: .8, rotateY: 28, translateX: 92, translateZ: -120, opacity: 74, brightness: 78 },
      { scale: .64, rotateY: 36, translateX: 156, translateZ: -220, opacity: 42, blur: 1, brightness: 60 }
    );
    next.radius = 14;
    next.transition = "coverflow";
    next.composition = "studio";
  }

  if (name === "Cinema") {
    setSides(
      { scale: .84, rotateY: 14, translateX: 74, translateZ: -100, opacity: 72, brightness: 74, saturation: 82 },
      { scale: .68, rotateY: 22, translateX: 126, translateZ: -180, opacity: 42, blur: 1, brightness: 58, saturation: 68 }
    );
    next.radius = 18;
    next.transition = "3d";
    next.composition = "cinema";
  }

  if (name === "Stack") {
    setSides(
      { scale: .92, translateX: 34, translateY: 10, translateZ: -150, opacity: 62, brightness: 76 },
      { scale: .84, translateX: 64, translateY: 20, translateZ: -260, opacity: 34, blur: 1, brightness: 58 }
    );
    next.radius = 20;
    next.transition = "stack";
    next.composition = "focus";
  }

  if (name === "Arc") {
    setSides(
      { scale: .8, rotateY: 12, translateX: 88, translateY: 18, translateZ: -110, opacity: 72, brightness: 78 },
      { scale: .65, rotateY: 20, translateX: 150, translateY: 42, translateZ: -210, opacity: 40, blur: 1, brightness: 60 }
    );
    next.radius = 18;
    next.transition = "3d";
    next.composition = "studio";
  }

  if (name === "Perspective") {
    setSides(
      { scale: .76, rotateY: 34, translateX: 102, translateZ: -170, opacity: 66, brightness: 74 },
      { scale: .58, rotateY: 42, translateX: 175, translateZ: -300, opacity: 34, blur: 1, brightness: 54 }
    );
    next.radius = 14;
    next.transition = "perspective";
    next.composition = "studio";
  }

  if (name === "Minimal") {
    setSides(
      { scale: .9, translateX: 68, translateZ: -50, opacity: 48, brightness: 82, saturation: 86 },
      { scale: .76, translateX: 120, translateZ: -120, opacity: 24, brightness: 68, saturation: 72 }
    );
    next.radius = 8;
    next.shadow = 20;
    next.glow = 0;
    next.overlay = 30;
    next.transition = "fade";
    next.composition = "focus";
  }

  if (name === "Spotlight") {
    setSides(
      { scale: .76, rotateY: 8, translateX: 90, translateZ: -150, opacity: 36, brightness: 54, saturation: 62 },
      { scale: .6, rotateY: 14, translateX: 154, translateZ: -260, opacity: 18, blur: 2, brightness: 42, saturation: 50 }
    );
    next.glow = 50;
    next.overlay = 62;
    next.transition = "fade";
    next.composition = "cinema";
  }

  if (name === "Cards") {
    setSides(
      { scale: .86, translateX: 76, translateZ: -70, opacity: 90, brightness: 94, saturation: 96 },
      { scale: .72, translateX: 132, translateZ: -150, opacity: 66, brightness: 82, saturation: 88 }
    );
    next.radius = 24;
    next.transition = "slide";
    next.composition = "studio";
  }

  next.motion = transitionMotion(next.transition);
  next.preset = name.toLowerCase() as HomeHeroPresentation["preset"];
  return next;
}

function Artwork({
  game,
  aspect,
}: {
  game: Game;
  aspect: number;
}) {
  const src = game.heroImage ?? game.coverImage;
  return src ? (
    <AdminMediaThumbnail
      kind="image"
      src={src}
      mode="destination"
      viewport={game.heroImage ? game.imageMedia?.hero : game.imageMedia?.cover}
      frameAspect={aspect}
      sizes="900px"
      label={`Hero de ${game.title}`}
    />
  ) : (
    <span className={styles.noArtwork}>Sin imagen</span>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  change: (value: number) => void;
}) {
  return (
    <label className={styles.range}>
      <span>{label}</span>
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => change(Number(event.target.value))}
        />
        <b>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) =>
              change(Math.min(max, Math.max(min, Number(event.target.value))))
            }
          />
          {unit}
        </b>
      </div>
    </label>
  );
}

function Switch({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (value: boolean) => void;
}) {
  return (
    <label className={styles.switch}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => change(event.target.checked)}
      />
      <i />
    </label>
  );
}

function gameIndexForPosition(
  active: number,
  position: HomeHeroVisualPosition,
  total: number,
  loop: boolean
) {
  if (!total) return null;
  const raw = active + homeHeroPositionOffset(position);
  if (!loop && (raw < 0 || raw >= total)) return null;
  return ((raw % total) + total) % total;
}

export default function HomeHeroEditor({
  config,
  games,
  publicGames,
  revision,
}: {
  config: ResolvedHomeConfig;
  games: Game[];
  publicGames: Game[];
  revision: number;
}) {
  const [baseline] = useState<State>(() =>
    clone({
      slugs: config.heroSlugs,
      presentation: config.heroPresentation,
      mode: config.curation.hero.mode,
    })
  );
  const [state, setState] = useState<State>(() => clone(baseline));
  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);
  const [device, setDevice] = useState<HomeHeroDevice>("desktop");
  const [target, setTarget] = useState<HomeHeroPosition>("main");
  const [panel, setPanel] = useState("structure");
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [preview, setPreview] = useState(false);
  const [rankingNow] = useState(() => Date.now());

  const dirty = JSON.stringify(state) !== JSON.stringify(baseline);
  const bySlug = useMemo(() => new Map(games.map((game) => [game.slug, game])), [games]);
  const result = useMemo(
    () =>
      resolveHomeCollectionGames(
        publicGames,
        "hero",
        state.mode,
        state.slugs,
        HOME_HERO_MAX_SLIDES,
        rankingNow
      ),
    [publicGames, rankingNow, state.mode, state.slugs]
  );
  const candidates = useMemo(
    () =>
      games
        .filter(
          (game) =>
            !state.slugs.includes(game.slug) &&
            (!query || norm(`${game.title} ${game.category}`).includes(norm(query)))
        )
        .slice(0, 8),
    [games, query, state.slugs]
  );
  const shown = compare ? baseline.presentation : state.presentation;
  const responsive = shown.responsive[device];
  const visiblePositions = homeHeroVisiblePositions(
    responsive,
    shown.direction,
    result.length
  );
  const activeGame = result[active % Math.max(1, result.length)];
  const selected = target === "all" ? shown.positions.all : shown.positions[target];
  const previewScale = device === "desktop" ? .72 : device === "tablet" ? .82 : 1;
  const previewStyle = {
    "--hero-card-width": `${responsive.cardWidth}px`,
    "--hero-card-height": `${responsive.cardHeight}px`,
    "--hero-gap": `${responsive.gap}px`,
    "--hero-perspective": `${responsive.perspective}px`,
    "--hero-preview-scale": previewScale,
    "--hero-radius": `${shown.radius}px`,
    "--hero-duration": `${shown.durationMs}ms`,
    "--hero-easing": shown.easing,
    "--hero-shadow": shown.shadow / 100,
    "--hero-glow": shown.glow / 100,
    "--hero-overlay": shown.overlay / 100,
    "--hero-border": `${shown.borderWidth}px`,
  } as CSSProperties;

  const commit = (fn: (state: State) => State) =>
    setState((current) => {
      const next = fn(clone(current));
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      setPast((history) => [...history.slice(-39), clone(current)]);
      setFuture([]);
      return next;
    });

  const setPresentation = <Key extends keyof HomeHeroPresentation>(
    key: Key,
    value: HomeHeroPresentation[Key]
  ) =>
    commit((current) => {
      current.presentation[key] = value;
      return current;
    });

  const setTransition = (value: HomeHeroPresentation["transition"]) =>
    commit((current) => {
      current.presentation.transition = value;
      current.presentation.motion = transitionMotion(value);
      return current;
    });

  const setPosition = (
    key: keyof HomeHeroPositionStyle,
    value: number
  ) =>
    commit((current) => {
      if (target === "all") {
        current.presentation.positions.all[key] = value;
        for (const id of HOME_HERO_VISUAL_POSITIONS) {
          current.presentation.positions[id][key] = value;
        }
      } else {
        current.presentation.positions[target][key] = value;
      }
      current.presentation.preset = "custom";
      return current;
    });

  const setResponsive = (
    key: keyof typeof responsive,
    value: number
  ) =>
    commit((current) => {
      Object.assign(current.presentation.responsive[device], { [key]: value });
      current.presentation.preset = "custom";
      return current;
    });

  const move = (delta: number) => {
    if (!result.length) return;
    setActive((current) => (current + delta + result.length) % result.length);
  };

  const payload = JSON.stringify({
    mode: state.mode,
    slugs: state.slugs,
    presentation: state.presentation,
    copy: config.copy.hero,
  });

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((history) => history.slice(0, -1));
    setFuture((history) => [clone(state), ...history]);
    setState(clone(previous));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((history) => history.slice(1));
    setPast((history) => [...history, clone(state)]);
    setState(clone(next));
  };

  const accordion = (
    id: string,
    title: string,
    index: string,
    content: React.ReactNode
  ) => (
    <div className={styles.accordion}>
      <button
        type="button"
        data-open={panel === id}
        onClick={() => setPanel(panel === id ? "" : id)}
      >
        <span><b>{index}</b>{title}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {panel === id && <section>{content}</section>}
    </div>
  );

  return (
    <div className={styles.app} data-preview={preview}>
      <header className={styles.topbar}>
        <div className={styles.title}>
          <i>H</i>
          <div>
            <h2>Editor de Hero</h2>
            <span data-dirty={dirty}>
              {dirty ? "Cambios sin guardar" : `Borrador guardado · revisión ${revision}`}
            </span>
          </div>
        </div>

        <div className={styles.history}>
          <button type="button" onClick={undo} disabled={!past.length} title="Deshacer">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={redo} disabled={!future.length} title="Rehacer">
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => commit(() => clone(baseline))}
            disabled={!dirty}
          >
            <RotateCcw size={16} /> Resetear
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" data-active={preview} onClick={() => setPreview(!preview)}>
            <Eye size={16} /> Vista previa
          </button>
          <button
            type="button"
            data-active={compare}
            onClick={() => setCompare(!compare)}
            disabled={!dirty}
          >
            <GitCompare size={16} /> Comparar
          </button>
          <form method="post" action="/api/admin/content/home/hero">
            <input type="hidden" name="expectedRevision" value={revision} />
            <input type="hidden" name="heroJson" value={payload} />
            <button className={styles.save} disabled={!dirty}>
              <Save size={16} /> Guardar borrador
            </button>
          </form>
          <form method="post" action="/api/admin/content/home/publish">
            <input type="hidden" name="expectedRevision" value={revision} />
            <button className={styles.publish} disabled={dirty}>
              <Send size={16} /> Publicar
            </button>
          </form>
        </div>
      </header>

      <div className={styles.grid}>
        <main className={styles.main}>
          <div className={styles.canvasBar}>
            <div>
              {devices.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  data-active={device === id}
                  onClick={() => setDevice(id)}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            <span>
              {responsive.cardWidth} × {responsive.cardHeight} · {responsive.visibleCards} tarjetas · perspectiva {responsive.perspective}px
            </span>
          </div>

          <section
            className={styles.canvas}
            data-device={device}
            data-transition={shown.transition}
            style={previewStyle}
          >
            <div className={styles.stage} data-playing={playing}>
              {activeGame && visiblePositions.map((positionId) => {
                const index = gameIndexForPosition(
                  active,
                  positionId,
                  result.length,
                  shown.loop
                );
                if (index === null) return null;
                const game = result[index] ?? activeGame;
                const positionStyle = shown.positions[positionId];
                const isMain = positionId === "main";

                return (
                  <button
                    key={`${active}-${positionId}-${game.slug}`}
                    type="button"
                    className={styles.card}
                    data-position={positionId}
                    data-main={isMain || undefined}
                    data-selected={target === positionId || target === "all"}
                    onClick={() => setTarget(positionId)}
                    style={{
                      opacity: positionStyle.opacity / 100,
                      filter: `blur(${positionStyle.blur}px) brightness(${positionStyle.brightness}%) contrast(${positionStyle.contrast}%) saturate(${positionStyle.saturation}%)`,
                      transform: homeHeroPositionTransform(positionStyle),
                    }}
                  >
                    <span className={styles.cardSurface}>
                      <Artwork
                        game={game}
                        aspect={responsive.cardWidth / responsive.cardHeight}
                      />
                      <i aria-hidden="true" />
                      {isMain ? (
                        <span className={styles.previewCopy}>
                          <small>{[game.category, ...(game.genres ?? [])].filter(Boolean).slice(0, 3).join(" · ")}</small>
                          <strong>{game.shortTitle ?? game.title}</strong>
                          <p>{game.description}</p>
                          <em>
                            {typeof game.rating === "number" ? `${game.rating.toFixed(1)} ★` : ""}
                            {game.developer ? `${typeof game.rating === "number" ? " · " : ""}${game.developer}` : ""}
                          </em>
                          <b>Ver juego</b>
                        </span>
                      ) : (
                        <span className={styles.sideLabel}>
                          <strong>{game.shortTitle ?? game.title}</strong>
                          <small>{game.category}</small>
                        </span>
                      )}
                      <em className={styles.positionLabel}>
                        {positionList.find((entry) => entry.id === positionId)?.label}
                      </em>
                    </span>
                  </button>
                );
              })}
            </div>

            {result.length > 1 && (
              <>
                <button type="button" className={`${styles.nav} ${styles.left}`} onClick={() => move(-1)}>
                  <ChevronLeft />
                </button>
                <button type="button" className={`${styles.nav} ${styles.right}`} onClick={() => move(1)}>
                  <ChevronRight />
                </button>
                <div className={styles.dots}>
                  {result.map((game, index) => (
                    <button
                      type="button"
                      key={game.slug}
                      data-active={index === active % result.length}
                      onClick={() => setActive(index)}
                    />
                  ))}
                </div>
              </>
            )}

            {compare && <label className={styles.before}>ANTES · configuración guardada</label>}
          </section>

          <section className={styles.dock}>
            <div>
              <span>Aplicar cambios a:</span>
              {positionList.map((positionItem) => (
                <button
                  type="button"
                  key={positionItem.id}
                  data-active={target === positionItem.id}
                  onClick={() => setTarget(positionItem.id)}
                >
                  {positionItem.label}
                </button>
              ))}
            </div>
            <div>
              <span>{state.slugs.length} tarjetas activas</span>
              <button
                type="button"
                disabled={!state.slugs.length}
                onClick={() =>
                  commit((current) => {
                    current.slugs.pop();
                    return current;
                  })
                }
              >
                <Minus size={14} /> Tarjeta
              </button>
              <button
                type="button"
                disabled={!candidates.length || state.slugs.length >= HOME_HERO_MAX_SLIDES}
                onClick={() =>
                  commit((current) => {
                    current.slugs.push(candidates[0]!.slug);
                    return current;
                  })
                }
              >
                <Plus size={14} /> Tarjeta
              </button>
            </div>
          </section>

          <section className={styles.infoNotice}>
            <strong>El contenido del Hero se toma del juego.</strong>
            <span>
              Título, categoría y géneros, descripción, valoración, desarrollador, lanzamiento, plataformas y versión se muestran sólo cuando existen. Este editor controla selección, orden, geometría y comportamiento; no inventa ni sobreescribe información del juego.
            </span>
          </section>

          <section className={styles.block}>
            <Heading over="PRESETS DE ESTILO" title="Punto de partida visual" note="Determinísticos y totalmente personalizables" />
            <div className={styles.presets}>
              {presets.map((name, index) => (
                <button
                  type="button"
                  key={name}
                  data-active={state.presentation.preset === name.toLowerCase()}
                  onClick={() =>
                    commit((current) => {
                      current.presentation = applyPreset(name, current.presentation);
                      return current;
                    })
                  }
                >
                  <span data-kind={index}><i /><i /><i /></span>
                  <b>{name}</b>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <Heading over="TRANSICIÓN" title="Movimiento entre estados" note="La web pública usa exactamente esta transición" />
            <div className={styles.transitions}>
              {transitions.map((name) => {
                const value = name.toLowerCase() as HomeHeroPresentation["transition"];
                return (
                  <button
                    type="button"
                    key={name}
                    data-active={state.presentation.transition === value}
                    onClick={() => setTransition(value)}
                  >
                    <span><i /><i /></span>
                    {name}
                  </button>
                );
              })}
            </div>
            <div className={styles.timeline}>
              <button type="button" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <span>{state.presentation.durationMs} ms · {state.presentation.easing}</span>
              <div><i style={{ animationDuration: `${state.presentation.durationMs}ms`, animationPlayState: playing ? "running" : "paused" }} /></div>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  requestAnimationFrame(() => setPlaying(true));
                }}
              >
                Probar transición
              </button>
            </div>
          </section>

          <section className={styles.block}>
            <Heading over="CONTENIDO" title="Tarjetas del carrusel" note={`Máximo ${HOME_HERO_MAX_SLIDES} juegos`} />
            <div className={styles.library}>
              <div className={styles.selectedList}>
                {state.slugs.map((slug, index) => {
                  const game = bySlug.get(slug);
                  if (!game) return null;
                  return (
                    <article key={slug}>
                      <b>{index + 1}</b>
                      <div>
                        <strong>{game.title}</strong>
                        <small>{game.category}</small>
                      </div>
                      <span className={styles.rowActions}>
                        <button
                          type="button"
                          title="Subir"
                          disabled={index === 0}
                          onClick={() =>
                            commit((current) => {
                              [current.slugs[index - 1], current.slugs[index]] = [current.slugs[index], current.slugs[index - 1]];
                              return current;
                            })
                          }
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          title="Bajar"
                          disabled={index === state.slugs.length - 1}
                          onClick={() =>
                            commit((current) => {
                              [current.slugs[index + 1], current.slugs[index]] = [current.slugs[index], current.slugs[index + 1]];
                              return current;
                            })
                          }
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          title="Quitar"
                          onClick={() =>
                            commit((current) => {
                              current.slugs.splice(index, 1);
                              return current;
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </article>
                  );
                })}
              </div>

              <aside>
                <label>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar juego…"
                  />
                </label>
                {candidates.map((game) => (
                  <button
                    type="button"
                    key={game.slug}
                    disabled={state.slugs.length >= HOME_HERO_MAX_SLIDES}
                    onClick={() =>
                      commit((current) => {
                        current.slugs.push(game.slug);
                        return current;
                      })
                    }
                  >
                    <span>{game.title}<small>{game.category}</small></span>
                    <Plus size={15} />
                  </button>
                ))}
              </aside>
            </div>
          </section>
        </main>

        <aside className={styles.inspector}>
          <header>
            <div>
              <span>PROPIEDADES</span>
              <strong>{positionList.find((positionItem) => positionItem.id === target)?.label}</strong>
            </div>
            <button
              type="button"
              onClick={() =>
                commit((current) => {
                  if (target === "all") {
                    current.presentation.positions.all = clone(baseline.presentation.positions.all);
                    for (const id of HOME_HERO_VISUAL_POSITIONS) {
                      current.presentation.positions[id] = clone(baseline.presentation.positions[id]);
                    }
                  } else {
                    current.presentation.positions[target] = clone(baseline.presentation.positions[target]);
                  }
                  return current;
                })
              }
              title="Restaurar posición"
            >
              <RotateCcw size={14} />
            </button>
          </header>

          <div>
            {accordion("structure", "Estructura", "01", <>
              <Range label="Tarjetas visibles" value={responsive.visibleCards} min={3} max={5} change={(value) => setResponsive("visibleCards", value)} />
              <Range label="Ancho" value={responsive.cardWidth} min={260} max={1200} unit="px" change={(value) => setResponsive("cardWidth", value)} />
              <Range label="Alto" value={responsive.cardHeight} min={260} max={700} unit="px" change={(value) => setResponsive("cardHeight", value)} />
              <Range label="Separación" value={responsive.gap} min={0} max={100} unit="px" change={(value) => setResponsive("gap", value)} />
              <Range label="Perspectiva" value={responsive.perspective} min={400} max={2400} step={50} unit="px" change={(value) => setResponsive("perspective", value)} />
            </>)}

            {accordion("transform", "Transformación 3D", "02", <>
              {([
                ["Scale", "scale", .4, 1.6, .01, ""],
                ["Rotate X", "rotateX", -60, 60, 1, "°"],
                ["Rotate Y", "rotateY", -60, 60, 1, "°"],
                ["Rotate Z", "rotateZ", -30, 30, 1, "°"],
                ["Translate X", "translateX", -300, 300, 1, "px"],
                ["Translate Y", "translateY", -200, 200, 1, "px"],
                ["Depth / Z", "translateZ", -500, 500, 1, "px"],
              ] as const).map(([label, key, min, max, step, unit]) => (
                <Range key={key} label={label} value={selected[key]} min={min} max={max} step={step} unit={unit} change={(value) => setPosition(key, value)} />
              ))}
            </>)}

            {accordion("appearance", "Apariencia", "03", <>
              {([
                ["Opacidad", "opacity", 0, 100, "%"],
                ["Blur", "blur", 0, 20, "px"],
                ["Brillo", "brightness", 20, 180, "%"],
                ["Contraste", "contrast", 50, 180, "%"],
                ["Saturación", "saturation", 0, 200, "%"],
              ] as const).map(([label, key, min, max, unit]) => (
                <Range key={key} label={label} value={selected[key]} min={min} max={max} unit={unit} change={(value) => setPosition(key, value)} />
              ))}
              <Range label="Radio" value={shown.radius} min={0} max={48} unit="px" change={(value) => setPresentation("radius", value)} />
              <Range label="Sombra" value={shown.shadow} min={0} max={100} unit="%" change={(value) => setPresentation("shadow", value)} />
              <Range label="Glow" value={shown.glow} min={0} max={100} unit="%" change={(value) => setPresentation("glow", value)} />
              <Range label="Overlay" value={shown.overlay} min={0} max={90} unit="%" change={(value) => setPresentation("overlay", value)} />
              <Range label="Borde" value={shown.borderWidth} min={0} max={6} unit="px" change={(value) => setPresentation("borderWidth", value)} />
            </>)}

            {accordion("behavior", "Comportamiento", "04", <>
              {([
                ["Autoplay", "autoplay"],
                ["Loop infinito", "loop"],
                ["Pausa al hacer hover", "pauseOnHover"],
                ["Drag con mouse", "drag"],
                ["Navegación táctil", "touch"],
                ["Teclado", "keyboard"],
                ["Rueda del mouse", "wheel"],
              ] as const).map(([label, key]) => (
                <Switch key={key} label={label} value={shown[key]} change={(value) => setPresentation(key, value)} />
              ))}
            </>)}

            {accordion("responsive", "Responsive", "05", <>
              <p className={styles.help}>Cada dispositivo conserva ancho, alto, separación, perspectiva y cantidad de tarjetas propios.</p>
              {devices.map((entry) => (
                <button
                  type="button"
                  className={styles.breakpoint}
                  data-active={device === entry.id}
                  key={entry.id}
                  onClick={() => setDevice(entry.id)}
                >
                  {entry.label}
                  <small>
                    {shown.responsive[entry.id].cardWidth}×{shown.responsive[entry.id].cardHeight} · {shown.responsive[entry.id].visibleCards}
                  </small>
                </button>
              ))}
            </>)}

            {accordion("advanced", "Avanzado", "06", <>
              <Range label="Duración" value={shown.durationMs} min={150} max={2000} step={10} unit="ms" change={(value) => setPresentation("durationMs", value)} />
              <label className={styles.select}>
                <span>Easing</span>
                <select value={shown.easing} onChange={(event) => setPresentation("easing", event.target.value as HomeHeroPresentation["easing"])}>
                  {["ease", "ease-in", "ease-out", "ease-in-out", "linear"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className={styles.select}>
                <span>Composición</span>
                <select value={shown.composition} onChange={(event) => setPresentation("composition", event.target.value as HomeHeroPresentation["composition"])}>
                  <option value="studio">Studio</option>
                  <option value="cinema">Cinema</option>
                  <option value="focus">Focus</option>
                </select>
              </label>
              <label className={styles.select}>
                <span>Curaduría</span>
                <select value={state.mode} onChange={(event) => commit((current) => { current.mode = event.target.value as HomeCurationMode; return current; })}>
                  <option value="manual">Manual</option>
                  <option value="hybrid">Asistida</option>
                  <option value="automatic">Automática</option>
                </select>
              </label>
              <label className={styles.select}>
                <span>Intervalo automático</span>
                <select value={state.presentation.autoplayMs} onChange={(event) => setPresentation("autoplayMs", Number(event.target.value) as HomeHeroPresentation["autoplayMs"])}>
                  <option value="0">Manual</option>
                  <option value="4000">4 segundos</option>
                  <option value="6500">6,5 segundos</option>
                  <option value="8000">8 segundos</option>
                </select>
              </label>
              <label className={styles.select}>
                <span>Dirección</span>
                <select value={state.presentation.direction} onChange={(event) => setPresentation("direction", event.target.value as HomeHeroPresentation["direction"])}>
                  <option value="forward">Hacia adelante</option>
                  <option value="reverse">Hacia atrás</option>
                </select>
              </label>
              <Link className={styles.mediaLink} href={activeGame ? `/admin/juegos/${encodeURIComponent(activeGame.slug)}?seccion=multimedia` : "/admin/juegos"}>
                Editar multimedia y recorte del juego activo
              </Link>
            </>)}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Heading({
  over,
  title,
  note,
}: {
  over: string;
  title: string;
  note?: string;
}) {
  return (
    <header className={styles.heading}>
      <div><span>{over}</span><strong>{title}</strong></div>
      {note && <small>{note}</small>}
    </header>
  );
}
