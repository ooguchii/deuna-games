"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  type CSSProperties,
  useMemo,
  useState,
} from "react";

import AdminMediaThumbnail from "@/components/admin/AdminMediaThumbnail";
import type {
  HomeCopy,
  HomeHeroPresentation,
  HomeSectionConfig,
  ResolvedHomeConfig,
} from "@/data/home-config";
import type { Game } from "@/types/game";

import styles from "./HomePresentationEditor.module.css";

const sectionLabels: Record<
  HomeSectionConfig["id"],
  string
> = {
  hero: "Hero principal",
  popular: "Juegos populares",
  finder: "Compatibilidad rápida",
  classifications: "Clasificaciones destacadas",
  recent: "Añadidos recientemente",
  updates: "Últimas actualizaciones",
  lowSpec: "Según tu equipo",
  recommended: "Juegos recomendados",
  trust: "Bloque de confianza",
};

const heroChoices = {
  composition: [
    ["studio", "Studio", "Hero dominante y laterales con profundidad, inspirado en la referencia."],
    ["cinema", "Cinemático", "Lienzo más ancho y presencia visual más intensa."],
    ["focus", "Enfoque", "Composición más serena que prioriza lectura y contenido."],
  ],
  motion: [
    ["depth", "Profundidad", "Las tarjetas avanzan por capas."],
    ["slide", "Desplazamiento", "Entrada lateral limpia y directa."],
    ["fade", "Fundido", "Cambio discreto con movimiento mínimo."],
  ],
} as const;

function cloneCopy(copy: HomeCopy): HomeCopy {
  return structuredClone(copy);
}

export default function HomePresentationEditor({
  config,
  heroGames,
  revision,
  showHeroStudio = true,
}: {
  config: ResolvedHomeConfig;
  heroGames: Game[];
  revision: number;
  showHeroStudio?: boolean;
}) {
  const [sections, setSections] = useState<
    HomeSectionConfig[]
  >(() => config.sections.map((section) => ({ ...section })));
  const [copy, setCopy] = useState<HomeCopy>(() =>
    cloneCopy(config.copy)
  );
  const [heroPresentation, setHeroPresentation] =
    useState<HomeHeroPresentation>(() => ({
      ...config.heroPresentation,
    }));
  const [heroIndex, setHeroIndex] = useState(0);
  const [previewDevice, setPreviewDevice] =
    useState<"desktop" | "mobile">("desktop");
  const activeHeroGame = heroGames[heroIndex % Math.max(heroGames.length, 1)];
  const heroPreviews = useMemo(() => {
    if (heroGames.length <= 1) return [];
    return Array.from(
      {
        length: Math.min(
          heroPresentation.previewCount,
          heroGames.length - 1
        ),
      },
      (_, depth) => {
        const index = (heroIndex + depth + 1) % heroGames.length;
        return { game: heroGames[index], index, depth };
      }
    );
  }, [heroGames, heroIndex, heroPresentation.previewCount]);

  const serialized = useMemo(
    () => JSON.stringify({ heroPresentation, sections, copy }),
    [copy, heroPresentation, sections]
  );

  function setHeroOption<Field extends keyof HomeHeroPresentation>(
    field: Field,
    value: HomeHeroPresentation[Field]
  ) {
    setHeroPresentation((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function moveSection(
    index: number,
    direction: -1 | 1
  ) {
    setSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = current.map((section) => ({ ...section }));
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleSection(id: HomeSectionConfig["id"]) {
    setSections((current) =>
      current.map((section) =>
        section.id === id
          ? { ...section, visible: !section.visible }
          : section
      )
    );
  }

  function setCopyField<
    Section extends keyof HomeCopy,
    Field extends keyof HomeCopy[Section],
  >(
    section: Section,
    field: Field,
    value: HomeCopy[Section][Field]
  ) {
    setCopy((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function setTupleValue(
    section: "finder" | "lowSpec",
    field: "features" | "optionTitles" | "optionSubtitles",
    index: number,
    value: string
  ) {
    setCopy((current) => {
      const target = current[section] as Record<string, unknown>;
      const list = [
        ...((target[field] as readonly string[]) ?? []),
      ];
      list[index] = value;

      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: list,
        },
      } as HomeCopy;
    });
  }

  function setTrustValue(
    index: number,
    field: "title" | "text",
    value: string
  ) {
    setCopy((current) => {
      const items = current.trust.items.map((item) => ({
        ...item,
      })) as HomeCopy["trust"]["items"];
      items[index] = {
        ...items[index],
        [field]: value,
      };

      return {
        ...current,
        trust: { items },
      };
    });
  }

  return (
    <form
      method="post"
      action="/api/admin/content/home/presentation"
      className={styles.root}
    >
      <input
        type="hidden"
        name="expectedRevision"
        value={revision}
      />
      <input
        type="hidden"
        name="presentationJson"
        value={serialized}
      />

      <div className={styles.summary}>
        <div>
          <strong>Presentación pública de Inicio</strong>
          <p>
            Ordena, muestra u oculta bloques y edita su copy. La lógica de carruseles, filtros y rendimiento permanece protegida en código.
          </p>
        </div>
        <span>Revisión {revision}</span>
      </div>

      {showHeroStudio && <section className={styles.heroStudio} aria-labelledby="hero-studio-title">
        <div className={styles.copyHeader}>
          <strong id="hero-studio-title">Diseño del Hero</strong>
          <p>
            Presets seguros basados en Hero Studio. El contenido y el orden se administran en Curaduría; aquí defines cómo se presenta.
          </p>
        </div>

        <div className={styles.previewToolbar}>
          <div>
            <button
              type="button"
              data-active={previewDevice === "desktop"}
              onClick={() => setPreviewDevice("desktop")}
            >
              <Monitor size={15} aria-hidden="true" /> Escritorio
            </button>
            <button
              type="button"
              data-active={previewDevice === "mobile"}
              onClick={() => setPreviewDevice("mobile")}
            >
              <Smartphone size={15} aria-hidden="true" /> Móvil
            </button>
          </div>
          <Link href="/admin/portada?seccion=hero">Editar selección y orden</Link>
        </div>

        <div
          className={styles.studioPreview}
          data-composition={heroPresentation.composition}
          data-motion={heroPresentation.motion}
          data-device={previewDevice}
          aria-label={`Vista previa ${heroPresentation.composition}, ${heroPresentation.previewCount} tarjetas laterales`}
        >
          {activeHeroGame ? (
            <>
              <div className={styles.previewHero}>
                {activeHeroGame.heroImage ?? activeHeroGame.coverImage ? (
                  <AdminMediaThumbnail
                    kind="image"
                    src={(activeHeroGame.heroImage ?? activeHeroGame.coverImage)!}
                    mode="destination"
                    viewport={activeHeroGame.heroImage
                      ? activeHeroGame.imageMedia?.hero
                      : activeHeroGame.imageMedia?.cover}
                    frameAspect={3}
                    sizes="900px"
                    label={`Hero de ${activeHeroGame.title}`}
                  />
                ) : <span className={styles.mediaFallback}>Sin imagen</span>}
                <i aria-hidden="true" />
                <span>{activeHeroGame.category}</span>
                <strong>{activeHeroGame.shortTitle ?? activeHeroGame.title}</strong>
                <small>{config.copy.hero.primaryCta}</small>
              </div>
              <div className={styles.previewRail} aria-label="Elegir juego activo en la vista previa">
                {heroPreviews.map(({ game, index, depth }) => (
                  <button
                    key={game.id}
                    type="button"
                    style={{ "--preview-index": depth } as CSSProperties}
                    aria-label={`Previsualizar ${game.title}`}
                    onClick={() => setHeroIndex(index)}
                  >
                    {game.coverImage ? (
                      <AdminMediaThumbnail
                        kind="image"
                        src={game.coverImage}
                        mode="destination"
                        viewport={game.imageMedia?.cover}
                        frameAspect={4 / 5}
                        sizes="180px"
                        label={`Portada de ${game.title}`}
                      />
                    ) : <span className={styles.mediaFallback}>Sin portada</span>}
                    <strong>{game.shortTitle ?? game.title}</strong>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.emptyPreview}>
              Agrega al menos un juego publicado al Hero desde Curaduría.
            </p>
          )}
          <small className={styles.previewStatus}>
            {heroPresentation.motion === "depth" ? "Profundidad" : heroPresentation.motion === "slide" ? "Desplazamiento" : "Fundido"}
            {heroPresentation.autoplayMs === 0 ? " · manual" : ` · ${heroPresentation.autoplayMs / 1000} s`}
          </small>
        </div>

        {activeHeroGame && (
          <div className={styles.previewLinks}>
            <span>Mostrando: <strong>{activeHeroGame.title}</strong></span>
            <Link href={`/admin/juegos/${encodeURIComponent(activeHeroGame.slug)}?seccion=multimedia`}>
              Editar multimedia de este juego
            </Link>
          </div>
        )}

        <div className={styles.studioGroup}>
          <span>Composición</span>
          <div className={styles.choiceGrid}>
            {heroChoices.composition.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                data-selected={heroPresentation.composition === value}
                onClick={() => setHeroOption("composition", value)}
              >
                <strong>{label}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.studioColumns}>
          <label>
            <span>Tarjetas laterales</span>
            <select
              value={heroPresentation.previewCount}
              onChange={(event) => setHeroOption(
                "previewCount",
                Number(event.target.value) as HomeHeroPresentation["previewCount"]
              )}
            >
              <option value={1}>1 lateral</option>
              <option value={2}>2 laterales</option>
              <option value={3}>3 laterales</option>
            </select>
          </label>
          <label>
            <span>Rotación automática</span>
            <select
              value={heroPresentation.autoplayMs}
              onChange={(event) => setHeroOption(
                "autoplayMs",
                Number(event.target.value) as HomeHeroPresentation["autoplayMs"]
              )}
            >
              <option value={0}>Desactivada</option>
              <option value={4000}>Cada 4 segundos</option>
              <option value={6500}>Cada 6,5 segundos</option>
              <option value={8000}>Cada 8 segundos</option>
            </select>
          </label>
        </div>

        <div className={styles.studioGroup}>
          <span>Transición</span>
          <div className={styles.choiceGrid}>
            {heroChoices.motion.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                data-selected={heroPresentation.motion === value}
                onClick={() => setHeroOption("motion", value)}
              >
                <strong>{label}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </div>
      </section>}

      <section className={styles.structurePanel}>
        <p className={styles.structureIntro}>
          El orden se reutiliza directamente al renderizar Inicio. Ocultar un bloque no borra su configuración ni sus juegos seleccionados.
        </p>
        <div className={styles.sectionList}>
          {sections.map((section, index) => (
            <div key={section.id} className={styles.sectionRow}>
              <div className={styles.sectionIdentity}>
                <span className={styles.sectionOrder}>
                  {index + 1}
                </span>
                <strong>{sectionLabels[section.id]}</strong>
              </div>

              <div className={styles.orderButtons}>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`Subir ${sectionLabels[section.id]}`}
                  onClick={() => moveSection(index, -1)}
                >
                  <ArrowUp size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === sections.length - 1}
                  aria-label={`Bajar ${sectionLabels[section.id]}`}
                  onClick={() => moveSection(index, 1)}
                >
                  <ArrowDown size={15} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                className={styles.visibilityButton}
                data-visible={section.visible}
                onClick={() => toggleSection(section.id)}
              >
                {section.visible ? "Visible" : "Oculto"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.copyPanel}>
        <div className={styles.copyHeader}>
          <strong>Textos de los bloques</strong>
          <p>
            Se editan como contenido; etiquetas funcionales, accesibilidad y estados dinámicos siguen bajo control del componente.
          </p>
        </div>

        <div className={styles.copyGroups}>
          <details className={styles.copyGroup}>
            <summary>Hero principal</summary>
            <div className={styles.copyFields}>
              <label>
                <span>Título accesible</span>
                <input
                  value={copy.hero.accessibleTitle}
                  maxLength={180}
                  onChange={(event) =>
                    setCopyField(
                      "hero",
                      "accessibleTitle",
                      event.target.value
                    )
                  }
                />
              </label>
              <label>
                <span>CTA principal</span>
                <input
                  value={copy.hero.primaryCta}
                  maxLength={100}
                  onChange={(event) =>
                    setCopyField(
                      "hero",
                      "primaryCta",
                      event.target.value
                    )
                  }
                />
              </label>
              <label>
                <span>CTA secundario</span>
                <input
                  value={copy.hero.secondaryCta}
                  maxLength={100}
                  onChange={(event) =>
                    setCopyField(
                      "hero",
                      "secondaryCta",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          </details>

          {([
            ["popular", "Juegos populares"],
            ["classifications", "Clasificaciones destacadas"],
            ["recent", "Añadidos recientemente"],
          ] as const).map(([section, label]) => (
            <details key={section} className={styles.copyGroup}>
              <summary>{label}</summary>
              <div className={styles.copyFields}>
                <label>
                  <span>Título</span>
                  <input
                    value={copy[section].title}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(
                        section,
                        "title",
                        event.target.value
                      )
                    }
                  />
                </label>
                <label>
                  <span>Destacado</span>
                  <input
                    value={copy[section].highlight}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(
                        section,
                        "highlight",
                        event.target.value
                      )
                    }
                  />
                </label>
                <label data-wide="true">
                  <span>Texto del enlace</span>
                  <input
                    value={copy[section].linkLabel}
                    maxLength={100}
                    onChange={(event) =>
                      setCopyField(
                        section,
                        "linkLabel",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            </details>
          ))}

          <details className={styles.copyGroup}>
            <summary>Compatibilidad rápida</summary>
            <div className={styles.copyFields}>
              <label>
                <span>Eyebrow</span>
                <input
                  value={copy.finder.eyebrow}
                  maxLength={100}
                  onChange={(event) =>
                    setCopyField("finder", "eyebrow", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Título</span>
                <input
                  value={copy.finder.title}
                  maxLength={180}
                  onChange={(event) =>
                    setCopyField("finder", "title", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Destacado</span>
                <input
                  value={copy.finder.highlight}
                  maxLength={180}
                  onChange={(event) =>
                    setCopyField("finder", "highlight", event.target.value)
                  }
                />
              </label>
              <label>
                <span>CTA</span>
                <input
                  value={copy.finder.cta}
                  maxLength={100}
                  onChange={(event) =>
                    setCopyField("finder", "cta", event.target.value)
                  }
                />
              </label>
              <label data-wide="true">
                <span>Descripción</span>
                <textarea
                  value={copy.finder.text}
                  maxLength={900}
                  onChange={(event) =>
                    setCopyField("finder", "text", event.target.value)
                  }
                />
              </label>
              {copy.finder.features.map((feature, index) => (
                <label key={index}>
                  <span>Señal {index + 1}</span>
                  <input
                    value={feature}
                    maxLength={100}
                    onChange={(event) =>
                      setTupleValue(
                        "finder",
                        "features",
                        index,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </details>

          <details className={styles.copyGroup}>
            <summary>Últimas actualizaciones</summary>
            <div className={styles.copyFields}>
              {([
                ["title", "Título"],
                ["highlight", "Destacado"],
                ["linkLabel", "Enlace general"],
                ["badgeLabel", "Badge de tarjeta"],
                ["detailsLabel", "Acción de tarjeta"],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    value={copy.updates[field]}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(
                        "updates",
                        field,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </details>

          <details className={styles.copyGroup}>
            <summary>Según tu equipo</summary>
            <div className={styles.copyFields}>
              {([
                ["eyebrow", "Eyebrow"],
                ["title", "Título"],
                ["highlight", "Destacado"],
                ["cta", "CTA"],
                ["listTitle", "Título de lista"],
                ["listHighlight", "Destacado de lista"],
                ["listLinkLabel", "Enlace de lista"],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    value={copy.lowSpec[field]}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(
                        "lowSpec",
                        field,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
              <label data-wide="true">
                <span>Descripción</span>
                <textarea
                  value={copy.lowSpec.text}
                  maxLength={900}
                  onChange={(event) =>
                    setCopyField("lowSpec", "text", event.target.value)
                  }
                />
              </label>
              {copy.lowSpec.optionTitles.map((title, index) => (
                <label key={`option-title-${index}`}>
                  <span>Opción {index + 1} · título</span>
                  <input
                    value={title}
                    maxLength={180}
                    onChange={(event) =>
                      setTupleValue(
                        "lowSpec",
                        "optionTitles",
                        index,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
              {copy.lowSpec.optionSubtitles.map((subtitle, index) => (
                <label key={`option-subtitle-${index}`}>
                  <span>Opción {index + 1} · descripción</span>
                  <input
                    value={subtitle}
                    maxLength={900}
                    onChange={(event) =>
                      setTupleValue(
                        "lowSpec",
                        "optionSubtitles",
                        index,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </details>

          <details className={styles.copyGroup}>
            <summary>Juegos recomendados</summary>
            <div className={styles.copyFields}>
              {([
                ["eyebrow", "Eyebrow"],
                ["title", "Título"],
                ["highlight", "Destacado"],
                ["linkLabel", "Texto del enlace"],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    value={copy.recommended[field]}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(
                        "recommended",
                        field,
                        event.target.value
                      )
                    }
                  />
                </label>
              ))}
              <label data-wide="true">
                <span>Descripción</span>
                <textarea
                  value={copy.recommended.text}
                  maxLength={900}
                  onChange={(event) =>
                    setCopyField(
                      "recommended",
                      "text",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          </details>

          <details className={styles.copyGroup}>
            <summary>Bloque de confianza</summary>
            <div className={styles.copyFields}>
              {copy.trust.items.map((item, index) => (
                <div key={index}>
                  <label>
                    <span>Tarjeta {index + 1} · título</span>
                    <input
                      value={item.title}
                      maxLength={180}
                      onChange={(event) =>
                        setTrustValue(
                          index,
                          "title",
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Tarjeta {index + 1} · texto</span>
                    <textarea
                      value={item.text}
                      maxLength={900}
                      onChange={(event) =>
                        setTrustValue(
                          index,
                          "text",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>

      <div className={styles.actions}>
        <p>
          Guardar sólo modifica el borrador de Portada. El orden, visibilidad y textos públicos no cambian hasta publicar.
        </p>
        <button type="submit">
          Guardar presentación
        </button>
      </div>
    </form>
  );
}
