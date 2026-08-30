"use client";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  useMemo,
  useState,
} from "react";

import TaxonomyIcon from "@/components/taxonomy/TaxonomyIcon";
import {
  taxonomyIconOptions,
  taxonomyToneOptions,
  withTaxonomyVisualDefaults,
} from "@/lib/games/taxonomy-presentation";
import type {
  GameTaxonomy,
  GameTaxonomyIcon,
  GameTaxonomyKind,
  GameTaxonomyTerm,
  GameTaxonomyTone,
} from "@/types/game-taxonomy";

import styles from "./GameTaxonomyEditor.module.css";

type Usage = Record<
  GameTaxonomyKind,
  Record<string, number>
>;

type Section = {
  kind: GameTaxonomyKind;
  title: string;
  description: string;
  singular: string;
};

const sections: Section[] = [
  {
    kind: "categories",
    title: "Categorías",
    description:
      "Clasificación principal. Su icono, color y orden se reutilizan en Inicio y en el catálogo público.",
    singular: "categoría",
  },
  {
    kind: "genres",
    title: "Géneros",
    description:
      "Clasificaciones específicas. Su identidad visual se reutiliza donde el género sea visible públicamente.",
    singular: "género",
  },
  {
    kind: "tags",
    title: "Etiquetas",
    description:
      "Atributos descriptivos como Mundo abierto, Cooperativo o Ciencia ficción.",
    singular: "etiqueta",
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function keyFromLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function availableKey(
  base: string,
  terms: GameTaxonomyTerm[]
) {
  const used = new Set(terms.map((term) => term.key));
  const safeBase = base || "termino";
  if (!used.has(safeBase)) return safeBase;

  for (let index = 2; index < 10_000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${safeBase.slice(
      0,
      160 - suffix.length
    )}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }

  return "";
}

function visualizedTaxonomy(
  taxonomy: GameTaxonomy
): GameTaxonomy {
  return {
    categories: taxonomy.categories.map(withTaxonomyVisualDefaults),
    genres: taxonomy.genres.map(withTaxonomyVisualDefaults),
    tags: taxonomy.tags,
  };
}

export default function GameTaxonomyEditor({
  initialTaxonomy,
  revision,
  usage,
}: {
  initialTaxonomy: GameTaxonomy;
  revision: number;
  usage: Usage;
}) {
  const [taxonomy, setTaxonomy] = useState(() =>
    visualizedTaxonomy(initialTaxonomy)
  );
  const [draftLabels, setDraftLabels] = useState<
    Record<GameTaxonomyKind, string>
  >({
    categories: "",
    genres: "",
    tags: "",
  });
  const [feedback, setFeedback] = useState("");

  const serialized = useMemo(
    () => JSON.stringify(taxonomy),
    [taxonomy]
  );

  function updateTerms(
    kind: GameTaxonomyKind,
    update: (terms: GameTaxonomyTerm[]) => GameTaxonomyTerm[]
  ) {
    setTaxonomy((current) => ({
      ...current,
      [kind]: update(current[kind]),
    }));
  }

  function addTerm(section: Section) {
    const label = draftLabels[section.kind].trim();
    if (!label) return;

    const terms = taxonomy[section.kind];
    if (
      terms.some(
        (term) => normalize(term.label) === normalize(label)
      )
    ) {
      setFeedback(
        `Ya existe una ${section.singular} con ese nombre o uno equivalente.`
      );
      return;
    }

    const key = availableKey(keyFromLabel(label), terms);
    if (!key) {
      setFeedback(
        "No se pudo generar un identificador único para el término."
      );
      return;
    }

    const base: GameTaxonomyTerm = {
      key,
      label,
      active: true,
    };
    const term =
      section.kind === "tags"
        ? base
        : withTaxonomyVisualDefaults(base, terms.length);

    updateTerms(section.kind, (current) => [
      ...current,
      term,
    ]);
    setDraftLabels((current) => ({
      ...current,
      [section.kind]: "",
    }));
    setFeedback("");
  }

  function renameTerm(
    kind: GameTaxonomyKind,
    key: string,
    label: string
  ) {
    updateTerms(kind, (terms) =>
      terms.map((term) =>
        term.key === key
          ? { ...term, label }
          : term
      )
    );
  }

  function setVisual(
    kind: GameTaxonomyKind,
    key: string,
    field: "icon" | "tone",
    value: GameTaxonomyIcon | GameTaxonomyTone
  ) {
    updateTerms(kind, (terms) =>
      terms.map((term) =>
        term.key === key
          ? { ...term, [field]: value }
          : term
      )
    );
  }

  function moveTerm(
    kind: GameTaxonomyKind,
    index: number,
    direction: -1 | 1
  ) {
    updateTerms(kind, (terms) => {
      const target = index + direction;
      if (target < 0 || target >= terms.length) return terms;

      const next = [...terms];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleTerm(
    kind: GameTaxonomyKind,
    key: string
  ) {
    updateTerms(kind, (terms) =>
      terms.map((term) =>
        term.key === key
          ? { ...term, active: !term.active }
          : term
      )
    );
  }

  function removeTerm(
    kind: GameTaxonomyKind,
    key: string
  ) {
    if ((usage[kind][key] ?? 0) > 0) return;
    updateTerms(kind, (terms) =>
      terms.filter((term) => term.key !== key)
    );
  }

  return (
    <form
      method="post"
      action="/api/admin/content/catalogs/games"
      className={styles.root}
    >
      <input
        type="hidden"
        name="expectedRevision"
        value={revision}
      />
      <input
        type="hidden"
        name="taxonomyJson"
        value={serialized}
      />

      <div className={styles.summary}>
        <div>
          <strong>Datos maestros del catálogo</strong>
          <p>
            Ésta es la identidad única de categorías y géneros. Nombre, icono, color y orden se reutilizan en todas las superficies públicas que correspondan a juegos publicados.
          </p>
        </div>
        <span>Revisión {revision}</span>
      </div>

      {feedback && (
        <div className={styles.feedback} role="status">
          {feedback}
        </div>
      )}

      <div className={styles.sections}>
        {sections.map((section) => {
          const terms = taxonomy[section.kind];
          const active = terms.filter((term) => term.active).length;
          const hasVisuals = section.kind !== "tags";

          return (
            <section key={section.kind} className={styles.panel}>
              <header className={styles.panelHeader}>
                <div>
                  <span>CATÁLOGO</span>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
                <div className={styles.counts}>
                  <strong>{active}</strong>
                  <span>activos · {terms.length} total</span>
                </div>
              </header>

              <div className={styles.addRow}>
                <input
                  value={draftLabels[section.kind]}
                  onChange={(event) =>
                    setDraftLabels((current) => ({
                      ...current,
                      [section.kind]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTerm(section);
                    }
                  }}
                  maxLength={80}
                  placeholder={`Nueva ${section.singular}`}
                  aria-label={`Nueva ${section.singular}`}
                />
                <button
                  type="button"
                  onClick={() => addTerm(section)}
                >
                  <Plus size={15} aria-hidden="true" />
                  Agregar
                </button>
              </div>

              {terms.length === 0 ? (
                <p className={styles.empty}>
                  Todavía no hay términos en este catálogo.
                </p>
              ) : (
                <div className={styles.termList}>
                  {terms.map((term, index) => {
                    const used = usage[section.kind][term.key] ?? 0;
                    const tone = taxonomyToneOptions.find(
                      (option) => option.key === term.tone
                    );

                    return (
                      <div key={term.key} className={styles.termRow}>
                        <div className={styles.termMain}>
                          <input
                            value={term.label}
                            readOnly={used > 0}
                            onChange={(event) =>
                              renameTerm(
                                section.kind,
                                term.key,
                                event.target.value
                              )
                            }
                            maxLength={80}
                            aria-label={`Nombre de ${term.label}`}
                          />
                          <code>{term.key}</code>
                        </div>

                        {hasVisuals && term.icon && term.tone && (
                          <div className={styles.visualEditor}>
                            <span
                              className={styles.visualPreview}
                              style={
                                {
                                  "--taxonomy-accent": tone?.color ?? "#ff1554",
                                } as CSSProperties
                              }
                            >
                              <TaxonomyIcon icon={term.icon} size={23} />
                            </span>

                            <label>
                              <span>Icono</span>
                              <select
                                value={term.icon}
                                onChange={(event) =>
                                  setVisual(
                                    section.kind,
                                    term.key,
                                    "icon",
                                    event.target.value as GameTaxonomyIcon
                                  )
                                }
                              >
                                {taxonomyIconOptions.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span>Color</span>
                              <select
                                value={term.tone}
                                onChange={(event) =>
                                  setVisual(
                                    section.kind,
                                    term.key,
                                    "tone",
                                    event.target.value as GameTaxonomyTone
                                  )
                                }
                              >
                                {taxonomyToneOptions.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        <span className={styles.usage}>
                          {used === 0
                            ? "Sin uso"
                            : `${used} ${used === 1 ? "juego" : "juegos"}`}
                        </span>

                        <div className={styles.orderButtons}>
                          <button
                            type="button"
                            disabled={index === 0}
                            aria-label={`Subir ${term.label}`}
                            onClick={() =>
                              moveTerm(section.kind, index, -1)
                            }
                          >
                            <ArrowUp size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={index === terms.length - 1}
                            aria-label={`Bajar ${term.label}`}
                            onClick={() =>
                              moveTerm(section.kind, index, 1)
                            }
                          >
                            <ArrowDown size={14} aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          type="button"
                          className={
                            term.active
                              ? styles.activeButton
                              : styles.inactiveButton
                          }
                          onClick={() =>
                            toggleTerm(section.kind, term.key)
                          }
                        >
                          {term.active ? "Activo" : "Inactivo"}
                        </button>

                        <button
                          type="button"
                          className={styles.removeButton}
                          disabled={used > 0}
                          title={
                            used > 0
                              ? "Un término usado por juegos se conserva; puedes desactivarlo."
                              : "Eliminar término sin uso"
                          }
                          aria-label={`Eliminar ${term.label}`}
                          onClick={() =>
                            removeTerm(section.kind, term.key)
                          }
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.actions}>
        <p>
          El orden que definas aquí será también el orden público. Los términos usados no se borran ni renombran, pero sí puedes cambiar su icono, color, posición o estado sin duplicar configuraciones.
        </p>
        <button type="submit">
          Guardar catálogos
        </button>
      </div>
    </form>
  );
}
