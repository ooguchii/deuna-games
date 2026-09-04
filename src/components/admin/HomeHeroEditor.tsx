"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Monitor, Plus, Search, Smartphone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import type { HomeCurationMode, HomeHeroPresentation, ResolvedHomeConfig } from "@/data/home-config";
import { HOME_HERO_MAX_SLIDES } from "@/lib/home/hero-contract";
import { resolveHomeCollectionGames } from "@/lib/home/ranking";
import type { Game } from "@/types/game";

import styles from "./HomeHeroEditor.module.css";

const modes: Array<{ value: HomeCurationMode; label: string; detail: string }> = [
  { value: "manual", label: "Manual", detail: "Muestra exactamente los juegos y el orden que elegís." },
  { value: "hybrid", label: "Asistido", detail: "Respeta tus juegos y completa los lugares disponibles." },
  { value: "automatic", label: "Automático", detail: "El sistema elige y ordena todo el carrusel." },
];

const compositions: Array<{ value: HomeHeroPresentation["composition"]; label: string; detail: string }> = [
  { value: "studio", label: "Studio", detail: "Equilibrado, con adelantos visibles." },
  { value: "cinema", label: "Cinemático", detail: "Más recto y de mayor impacto visual." },
  { value: "focus", label: "Enfoque", detail: "Prioriza el juego principal y su lectura." },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Artwork({ game, aspect, hero = false }: { game: Game; aspect: number; hero?: boolean }) {
  const src = hero ? game.heroImage ?? game.coverImage : game.coverImage;
  if (!src) return <span className={styles.noArtwork}>Sin imagen</span>;
  return <AdminMediaThumbnail kind="image" src={src} mode="destination" viewport={hero && game.heroImage ? game.imageMedia?.hero : game.imageMedia?.cover} frameAspect={aspect} sizes={hero ? "1000px" : "160px"} label={`${hero ? "Hero" : "Portada"} de ${game.title}`} />;
}

export default function HomeHeroEditor({ config, games, publicGames, revision }: { config: ResolvedHomeConfig; games: Game[]; publicGames: Game[]; revision: number }) {
  const [mode, setMode] = useState<HomeCurationMode>(config.curation.hero.mode);
  const [slugs, setSlugs] = useState([...config.heroSlugs]);
  const [presentation, setPresentation] = useState({ ...config.heroPresentation });
  const [copy, setCopy] = useState({ ...config.copy.hero });
  const [query, setQuery] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rankingNow] = useState(() => Date.now());
  const gameBySlug = useMemo(() => new Map(games.map((game) => [game.slug, game])), [games]);
  const publicSet = useMemo(() => new Set(publicGames.map((game) => game.slug)), [publicGames]);
  const selected = slugs.map((slug) => gameBySlug.get(slug)).filter((game): game is Game => Boolean(game));
  const result = useMemo(() => resolveHomeCollectionGames(publicGames, "hero", mode, slugs, HOME_HERO_MAX_SLIDES, rankingNow), [mode, publicGames, rankingNow, slugs]);
  const active = result[activeIndex % Math.max(result.length, 1)];
  const candidates = useMemo(() => {
    const needle = normalize(query.trim());
    return games.filter((game) => !slugs.includes(game.slug) && (!needle || normalize(`${game.title} ${game.category} ${game.slug}`).includes(needle))).slice(0, 8);
  }, [games, query, slugs]);
  const payload = JSON.stringify({ mode, slugs, presentation, copy });

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= slugs.length) return;
    setSlugs((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  return (
    <form method="post" action="/api/admin/content/home/hero" className={styles.root}>
      <input type="hidden" name="expectedRevision" value={revision} />
      <input type="hidden" name="heroJson" value={payload} />

      <header className={styles.editorHeader}>
        <div><span>EDITOR ÚNICO DEL HERO</span><h2>Controla el carrusel desde un solo lugar</h2><p>Elige los juegos, ordénalos, ajusta la presentación y comprueba el resultado antes de guardar.</p></div>
        <div className={styles.headerMeta}><strong>{result.length}</strong><span>juegos visibles</span><small>Revisión {revision}</small></div>
      </header>

      <div className={styles.workspace}>
        <main className={styles.previewColumn}>
          <div className={styles.previewBar}>
            <div><button type="button" data-active={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={15}/> Escritorio</button><button type="button" data-active={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={15}/> Móvil</button></div>
            <span>Vista previa del borrador</span>
          </div>
          <div className={styles.livePreview} data-device={device} data-composition={presentation.composition}>
            {active ? <>
              <article className={styles.heroMock}>
                <Artwork game={active} aspect={3} hero />
                <i />
                <div><small>{active.category}</small><strong>{active.shortTitle ?? active.title}</strong><p>{active.description}</p><span>{copy.primaryCta}</span></div>
              </article>
              <div className={styles.previewCards}>{result.slice(0, presentation.previewCount + 1).map((game, index) => <button type="button" data-active={index === activeIndex} key={game.slug} onClick={() => setActiveIndex(index)}><Artwork game={game} aspect={4 / 5}/><span>{index + 1}</span></button>)}</div>
            </> : <div className={styles.empty}>No hay juegos públicos disponibles para esta configuración.</div>}
          </div>
          {active && <div className={styles.activeGame}><span>Mostrando <strong>{active.title}</strong></span><Link href={`/admin/juegos/${encodeURIComponent(active.slug)}?seccion=multimedia`}>Editar imagen y recorte</Link></div>}
        </main>

        <aside className={styles.controls}>
          <section><div className={styles.stepTitle}><b>1</b><div><strong>Selección</strong><span>Quién aparece en el Hero</span></div></div>
            <div className={styles.modeGrid}>{modes.map((item) => <button type="button" key={item.value} data-selected={mode === item.value} onClick={() => setMode(item.value)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
          </section>
          <section><div className={styles.stepTitle}><b>2</b><div><strong>Apariencia</strong><span>Cómo se presenta el carrusel</span></div></div>
            <div className={styles.compositionGrid}>{compositions.map((item) => <button type="button" key={item.value} data-selected={presentation.composition === item.value} onClick={() => setPresentation((current) => ({ ...current, composition: item.value }))}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
            <div className={styles.selectGrid}><label><span>Adelantos</span><select value={presentation.previewCount} onChange={(event) => setPresentation((current) => ({ ...current, previewCount: Number(event.target.value) as 1 | 2 | 3 }))}><option value="1">1 tarjeta</option><option value="2">2 tarjetas</option><option value="3">3 tarjetas</option></select></label><label><span>Rotación</span><select value={presentation.autoplayMs} onChange={(event) => setPresentation((current) => ({ ...current, autoplayMs: Number(event.target.value) as HomeHeroPresentation["autoplayMs"] }))}><option value="0">Manual</option><option value="4000">4 segundos</option><option value="6500">6,5 segundos</option><option value="8000">8 segundos</option></select></label><label><span>Transición</span><select value={presentation.motion} onChange={(event) => setPresentation((current) => ({ ...current, motion: event.target.value as HomeHeroPresentation["motion"] }))}><option value="depth">Profundidad</option><option value="slide">Desplazamiento</option><option value="fade">Fundido</option></select></label></div>
          </section>
          <section><div className={styles.stepTitle}><b>3</b><div><strong>Textos globales</strong><span>Botones y accesibilidad</span></div></div>
            <div className={styles.textFields}><label><span>Título para lectores de pantalla</span><input maxLength={180} value={copy.accessibleTitle} onChange={(event) => setCopy((current) => ({ ...current, accessibleTitle: event.target.value }))}/></label><label><span>Botón principal</span><input maxLength={100} value={copy.primaryCta} onChange={(event) => setCopy((current) => ({ ...current, primaryCta: event.target.value }))}/></label><label><span>Botón secundario</span><input maxLength={100} value={copy.secondaryCta} onChange={(event) => setCopy((current) => ({ ...current, secondaryCta: event.target.value }))}/></label></div>
          </section>
        </aside>
      </div>

      {mode !== "automatic" && <section className={styles.gamesPanel}>
        <div className={styles.panelHeader}><div><span>ORDEN DEL CARRUSEL</span><h3>Juegos seleccionados</h3><p>El primero abre el Hero. Puedes usar hasta {HOME_HERO_MAX_SLIDES} juegos.</p></div><strong>{slugs.length} / {HOME_HERO_MAX_SLIDES}</strong></div>
        <div className={styles.gameColumns}><div className={styles.selectedList}>{selected.map((game, index) => <article key={game.slug} data-warning={!publicSet.has(game.slug)}><b>{index + 1}</b><Artwork game={game} aspect={4 / 5}/><div><strong>{game.title}</strong><span>{publicSet.has(game.slug) ? "Publicado" : "No publicado: no se verá"}</span></div><div className={styles.rowActions}><button type="button" disabled={index === 0} aria-label={`Subir ${game.title}`} onClick={() => move(index, -1)}><ChevronUp size={16}/></button><button type="button" disabled={index === selected.length - 1} aria-label={`Bajar ${game.title}`} onClick={() => move(index, 1)}><ChevronDown size={16}/></button><button type="button" aria-label={`Quitar ${game.title}`} onClick={() => setSlugs((current) => current.filter((slug) => slug !== game.slug))}><Trash2 size={16}/></button></div></article>)}</div>
          <div className={styles.catalog}><label className={styles.search}><Search size={16}/><input placeholder="Buscar un juego…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>{candidates.map((game) => <button type="button" key={game.slug} disabled={slugs.length >= HOME_HERO_MAX_SLIDES} onClick={() => setSlugs((current) => [...current, game.slug])}><Artwork game={game} aspect={4 / 5}/><span><strong>{game.title}</strong><small>{publicSet.has(game.slug) ? game.category : "No publicado"}</small></span><Plus size={16}/></button>)}</div></div>
      </section>}

      <footer className={styles.saveBar}><div><strong>Guarda el editor completo</strong><span>Selección, diseño y textos quedan juntos en el borrador. Inicio no cambia hasta publicar.</span></div><button type="submit"><Check size={18}/> Guardar Hero</button></footer>
    </form>
  );
}
