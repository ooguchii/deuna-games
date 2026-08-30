"use client";

import {
  Plus,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  GameTaxonomy,
  GameTaxonomyKind,
  GameTaxonomyTerm,
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
      "Clasificación principal y amplia que organiza el catálogo público.",
    singular: "categoría",
  },
  {
    kind: "genres",
    title: "Géneros",
    description:
      "Clasificaciones específicas que un juego podrá combinar en su ficha.",
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

export default function GameTaxonomyEditor({
  initialTaxonomy,
  revision,
  usage,
}: {
  initialTaxonomy: GameTaxonomy;
  revision: number;
  usage: Usage;
}) {
  const [taxonomy, setTaxonomy] = useState(initialTaxonomy);
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

    updateTerms(section.kind, (current) => [
      ...current,
      { key, label, active: true },
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
            Guardar aquí sólo modifica esta estructura administrativa. Ningún juego ni página pública cambia hasta que conectemos y guardemos cada ficha de forma explícita.
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
                  {terms.map((term) => {
                    const used = usage[section.kind][term.key] ?? 0;

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

                        <span className={styles.usage}>
                          {used === 0
                            ? "Sin uso"
                            : `${used} ${used === 1 ? "juego" : "juegos"}`}
                        </span>

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
          Los términos usados por juegos no se pueden borrar ni renombrar desde aquí; sí pueden quedar inactivos para no ofrecerlos en futuras fichas.
        </p>
        <button type="submit">
          Guardar catálogos
        </button>
      </div>
    </form>
  );
}
