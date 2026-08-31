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
  eyebrow: string;
  description: string;
  singular: string;
};

const sections: Section[] = [
  {
    kind: "classifications",
    title: "Clasificaciones",
    eyebrow: "CLASIFICACIÓN MAESTRA",
    description:
      "Acción, Aventura, RPG, Carreras, Puzzle y el resto viven en una única lista. Desde aquí controlas nombre, icono, color, orden y estado para toda la web.",
    singular: "clasificación",
  },
  {
    kind: "tags",
    title: "Etiquetas",
    eyebrow: "ATRIBUTOS DESCRIPTIVOS",
    description:
      "Mundo abierto, Cooperativo, Ciencia ficción y otros atributos complementarios. Se mantienen separados porque describen al juego, pero no reemplazan su clasificación.",
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
    classifications: taxonomy.classifications.map(
      withTaxonomyVisualDefaults
    ),
    tags: taxonomy.tags,
  };
}

export default function GameTaxonomyEditor({
  initialTaxonomy,
  revision,
  usage,
  section,
}: {
  initialTaxonomy: GameTaxonomy;
  revision: number;
  usage: Usage;
  section: GameTaxonomyKind;
}) {
  const [taxonomy, setTaxonomy] = useState(() =>
    visualizedTaxonomy(initialTaxonomy)
  );
  const [draftLabels, setDraftLabels] = useState<
    Record<GameTaxonomyKind, string>
  >({
    classifications: "",
    tags: "",
  });
  const [feedback, setFeedback] = useState("");

  const serialized = useMemo(
    () => JSON.stringify(taxonomy),
    [taxonomy]
  );
  const currentSection =
    sections.find((candidate) => candidate.kind === section) ?? sections[0];
  const terms = taxonomy[currentSection.kind];
  const active = terms.filter((term) => term.active).length;
  const hasVisuals = currentSection.kind === "classifications";
  const returnSection = hasVisuals ? "clasificaciones" : "etiquetas";

  function updateTerms(
    kind: GameTaxonomyKind,
    update: (terms: GameTaxonomyTerm[]) => GameTaxonomyTerm[]
  ) {
    setTaxonomy((current) => ({
      ...current,
      [kind]: update(current[kind]),
    }));
  }

  function addTerm(sectionDefinition: Section) {
    const label = draftLabels[sectionDefinition.kind].trim();
    if (!label) return;

    const currentTerms = taxonomy[sectionDefinition.kind];
    if (
      currentTerms.some(
        (term) => normalize(term.label) === normalize(label)
      )
    ) {
      setFeedback(
        `Ya existe una ${sectionDefinition.singular} con ese nombre o uno equivalente.`
      );
      return;
    }

    const key = availableKey(keyFromLabel(label), currentTerms);
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
      sectionDefinition.kind === "tags"
        ? base
        : withTaxonomyVisualDefaults(base, currentTerms.length);

    updateTerms(sectionDefinition.kind, (current) => [
      ...current,
      term,
    ]);
    setDraftLabels((current) => ({
      ...current,
      [sectionDefinition.kind]: "",
    }));
    setFeedback("");
  }

  function renameTerm(
    kind: GameTaxonomyKind,
    key: string,
    label: string
  ) {
    updateTerms(kind, (currentTerms) =>
      currentTerms.map((term) =>
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
    updateTerms(kind, (currentTerms) =>
      currentTerms.map((term) =>
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
    updateTerms(kind, (currentTerms) => {
      const target = index + direction;
      if (target < 0 || target >= currentTerms.length) return currentTerms;

      const next = [...currentTerms];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleTerm(
    kind: GameTaxonomyKind,
    key: string
  ) {
    updateTerms(kind, (currentTerms) =>
      currentTerms.map((term) =>
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
    updateTerms(kind, (currentTerms) =>
      currentTerms.filter((term) => term.key !== key)
    );
  }

  return (
    <form
      method="post"
      action={`/api/admin/content/catalogs/games?seccion=${returnSection}`}
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
          <strong>{currentSection.title}</strong>
          <p>
            {hasVisuals
              ? "Esta ventana gobierna la clasificación visible de los juegos. Un mismo nombre existe una sola vez y conserva un único contador en Inicio y Juegos."
              : "Esta ventana contiene solamente atributos descriptivos. Así puedes trabajar las etiquetas sin mezclar ni desplazar las clasificaciones principales."}
          </p>
        </div>
        <span>Revisión {revision}</span>
      </div>

      {feedback && (
        <div className={styles.feedback} role="status">
          {feedback}
        </div>
      )}

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>{currentSection.eyebrow}</span>
            <h2>{currentSection.title}</h2>
            <p>{currentSection.description}</p>
          </div>
          <div className={styles.counts}>
            <strong>{active}</strong>
            <span>activos · {terms.length} total</span>
          </div>
        </header>

        <div className={styles.addRow}>
          <input
            value={draftLabels[currentSection.kind]}
            onChange={(event) =>
              setDraftLabels((current) => ({
                ...current,
                [currentSection.kind]: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTerm(currentSection);
              }
            }}
            maxLength={80}
            placeholder={`Nueva ${currentSection.singular}`}
            aria-label={`Nueva ${currentSection.singular}`}
          />
          <button
            type="button"
            data-brand-action="true"
            onClick={() => addTerm(currentSection)}
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
          <>
            <div
              className={`${styles.columnHeader} ${
                hasVisuals ? "" : styles.columnHeaderSimple
              }`}
              aria-hidden="true"
            >
              <span>Nombre e identificador</span>
              {hasVisuals && <span>Apariencia</span>}
              <span>Uso</span>
              <span>Orden</span>
              <span>Estado</span>
              <span />
            </div>

            <div className={styles.termList}>
              {terms.map((term, index) => {
                const used = usage[currentSection.kind][term.key] ?? 0;
                const tone = taxonomyToneOptions.find(
                  (option) => option.key === term.tone
                );

                return (
                  <div
                    key={term.key}
                    className={`${styles.termRow} ${
                      hasVisuals ? "" : styles.termRowSimple
                    }`}
                  >
                    <div className={styles.termMain}>
                      <input
                        value={term.label}
                        readOnly={used > 0}
                        onChange={(event) =>
                          renameTerm(
                            currentSection.kind,
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
                              "--taxonomy-accent": tone?.color ?? "var(--brand)",
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
                                currentSection.kind,
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
                                currentSection.kind,
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
                          moveTerm(currentSection.kind, index, -1)
                        }
                      >
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === terms.length - 1}
                        aria-label={`Bajar ${term.label}`}
                        onClick={() =>
                          moveTerm(currentSection.kind, index, 1)
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
                        toggleTerm(currentSection.kind, term.key)
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
                        removeTerm(currentSection.kind, term.key)
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className={styles.actions}>
        <p>
          {hasVisuals
            ? "El orden de esta ventana es el mismo orden que se reutiliza públicamente. El contador considera cada juego una sola vez por clasificación."
            : "Las etiquetas usadas no se eliminan para proteger las fichas existentes; puedes desactivarlas y mantener el historial editorial."}
        </p>
        <button type="submit" data-brand-action="true">
          Guardar {hasVisuals ? "clasificaciones" : "etiquetas"}
        </button>
      </div>
    </form>
  );
}
