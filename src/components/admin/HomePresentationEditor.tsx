"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  HomeCopy,
  HomeSectionConfig,
  ResolvedHomeConfig,
} from "@/data/home-config";

import styles from "./HomePresentationEditor.module.css";

const PRESENTATION_DRAFT_KEY =
  "deuna:home-presentation-draft:latest";
const subscribeStorage = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

const sectionLabels: Record<HomeSectionConfig["id"], string> = {
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

type EditableHomeCopy = Omit<HomeCopy, "hero">;
type PresentationDraft = {
  revision: number;
  sections: HomeSectionConfig[];
  copy: EditableHomeCopy;
};

function editableCopyFromConfig(
  copy: HomeCopy
): EditableHomeCopy {
  const editable = structuredClone(copy) as unknown as Record<
    string,
    unknown
  >;
  delete editable.hero;
  return editable as EditableHomeCopy;
}

function buildPayload(
  sections: HomeSectionConfig[],
  copy: EditableHomeCopy
) {
  return JSON.stringify({ sections, copy });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSameShape(value: unknown, template: unknown): boolean {
  if (template === null) return value === null;

  if (Array.isArray(template)) {
    return (
      Array.isArray(value) &&
      value.length === template.length &&
      template.every((item, index) =>
        hasSameShape(value[index], item)
      )
    );
  }

  if (isRecord(template)) {
    if (!isRecord(value)) return false;

    const templateKeys = Object.keys(template);
    const valueKeys = Object.keys(value);
    if (templateKeys.length !== valueKeys.length) return false;

    return templateKeys.every(
      (key) =>
        Object.hasOwn(value, key) &&
        hasSameShape(value[key], template[key])
    );
  }

  return typeof value === typeof template;
}

function clearRecoveryDraft() {
  try {
    sessionStorage.removeItem(PRESENTATION_DRAFT_KEY);
  } catch {
    // El guardado del servidor sigue siendo la fuente de verdad.
  }
}

function readRecoveryRaw() {
  try {
    return sessionStorage.getItem(PRESENTATION_DRAFT_KEY);
  } catch {
    return null;
  }
}

function parseRecoveryDraft(
  raw: string | null,
  baselineSections: HomeSectionConfig[],
  baselineCopy: EditableHomeCopy
): PresentationDraft | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.revision !== "number" ||
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 0 ||
      !Array.isArray(parsed.sections) ||
      !hasSameShape(parsed.copy, baselineCopy)
    ) {
      return null;
    }

    const allowedIds = new Set(
      baselineSections.map((section) => section.id)
    );
    const seenIds = new Set<HomeSectionConfig["id"]>();
    const sections: HomeSectionConfig[] = [];

    for (const item of parsed.sections) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !allowedIds.has(item.id as HomeSectionConfig["id"]) ||
        typeof item.visible !== "boolean"
      ) {
        return null;
      }

      const id = item.id as HomeSectionConfig["id"];
      if (seenIds.has(id)) return null;

      seenIds.add(id);
      sections.push({ id, visible: item.visible });
    }

    if (
      sections.length !== baselineSections.length ||
      seenIds.size !== allowedIds.size
    ) {
      return null;
    }

    return {
      revision: parsed.revision,
      sections,
      copy: structuredClone(parsed.copy) as EditableHomeCopy,
    };
  } catch {
    return null;
  }
}

export default function HomePresentationEditor({
  config,
  revision,
}: {
  config: ResolvedHomeConfig;
  revision: number;
}) {
  const baselineSections = useMemo(
    () => config.sections.map((section) => ({ ...section })),
    [config.sections]
  );
  const baselineCopy = useMemo(
    () => editableCopyFromConfig(config.copy),
    [config.copy]
  );
  const baselinePayload = useMemo(
    () => buildPayload(baselineSections, baselineCopy),
    [baselineCopy, baselineSections]
  );
  const [sections, setSections] = useState<HomeSectionConfig[]>(
    () => baselineSections.map((section) => ({ ...section }))
  );
  const [copy, setCopy] = useState<EditableHomeCopy>(
    () => structuredClone(baselineCopy)
  );
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const recoveryReady = useSyncExternalStore(
    subscribeStorage,
    clientReady,
    serverReady
  );
  const storedDraft = useSyncExternalStore(
    subscribeStorage,
    readRecoveryRaw,
    () => null
  );

  const serialized = useMemo(
    () => buildPayload(sections, copy),
    [copy, sections]
  );
  const dirty = serialized !== baselinePayload;
  const recovery = useMemo(() => {
    if (!storedDraft || recoveryDismissed) return null;

    const candidate = parseRecoveryDraft(
      storedDraft,
      baselineSections,
      baselineCopy
    );
    if (!candidate) return null;

    return buildPayload(
      candidate.sections,
      candidate.copy
    ) === baselinePayload
      ? null
      : candidate;
  }, [
    baselineCopy,
    baselinePayload,
    baselineSections,
    recoveryDismissed,
    storedDraft,
  ]);

  useEffect(() => {
    if (!recoveryReady || recovery) return;

    try {
      if (!dirty) {
        clearRecoveryDraft();
        return;
      }

      sessionStorage.setItem(
        PRESENTATION_DRAFT_KEY,
        JSON.stringify({
          revision,
          sections,
          copy,
        } satisfies PresentationDraft)
      );
    } catch {
      // El navegador puede bloquear storage; el formulario sigue funcionando.
    }
  }, [
    copy,
    dirty,
    recovery,
    recoveryReady,
    revision,
    sections,
  ]);

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
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
    Section extends keyof EditableHomeCopy,
    Field extends keyof EditableHomeCopy[Section],
  >(
    section: Section,
    field: Field,
    value: EditableHomeCopy[Section][Field]
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
      const list = [...((target[field] as readonly string[]) ?? [])];
      list[index] = value;
      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: list,
        },
      } as EditableHomeCopy;
    });
  }

  function setTrustValue(
    index: number,
    field: "title" | "text",
    value: string
  ) {
    setCopy((current) => {
      const items = current.trust.items.map((item) => ({ ...item })) as EditableHomeCopy["trust"]["items"];
      items[index] = { ...items[index], [field]: value };
      return { ...current, trust: { items } };
    });
  }

  return (
    <form
      method="post"
      action="/api/admin/content/home/presentation"
      className={styles.root}
      data-home-editor-dirty={dirty ? "true" : "false"}
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

      {recovery && (
        <div className={styles.recovery} role="status">
          <div>
            <strong>Cambios locales recuperables</strong>
            <span>
              {recovery.revision === revision
                ? "Hay una copia local de esta revisión que todavía no fue guardada."
                : `Hay una copia local iniciada en la revisión ${recovery.revision}. El servidor está en la revisión ${revision}.`}
            </span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setSections(
                  recovery.sections.map((section) => ({ ...section }))
                );
                setCopy(structuredClone(recovery.copy));
                setRecoveryDismissed(true);
              }}
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={() => {
                clearRecoveryDraft();
                setRecoveryDismissed(true);
              }}
            >
              Descartar copia
            </button>
          </div>
        </div>
      )}

      <div className={styles.summary}>
        <div>
          <strong>Presentación pública de Inicio</strong>
          <p>
            Ordena, muestra u oculta bloques y edita sus textos. El Hero tiene un editor propio: aquí no se modifica su contenido ni su geometría.
          </p>
        </div>
        <span data-dirty={dirty ? "true" : "false"}>
          {dirty ? "Cambios sin guardar" : `Revisión ${revision}`}
        </span>
      </div>

      <section className={styles.structurePanel}>
        <p className={styles.structureIntro}>
          El orden se reutiliza directamente al renderizar Inicio. Ocultar un bloque no borra su configuración ni sus juegos seleccionados.
        </p>
        <div className={styles.sectionList}>
          {sections.map((section, index) => (
            <div key={section.id} className={styles.sectionRow}>
              <div className={styles.sectionIdentity}>
                <span className={styles.sectionOrder}>{index + 1}</span>
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
            El Hero queda excluido: título, descripción y datos visibles salen directamente del juego. Aquí sólo editas los textos editoriales de las demás secciones.
          </p>
        </div>

        <div className={styles.copyGroups}>
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
                      setCopyField(section, "title", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Destacado</span>
                  <input
                    value={copy[section].highlight}
                    maxLength={180}
                    onChange={(event) =>
                      setCopyField(section, "highlight", event.target.value)
                    }
                  />
                </label>
                <label data-wide="true">
                  <span>Texto del enlace</span>
                  <input
                    value={copy[section].linkLabel}
                    maxLength={100}
                    onChange={(event) =>
                      setCopyField(section, "linkLabel", event.target.value)
                    }
                  />
                </label>
              </div>
            </details>
          ))}

          <details className={styles.copyGroup}>
            <summary>Compatibilidad rápida</summary>
            <div className={styles.copyFields}>
              <label><span>Eyebrow</span><input value={copy.finder.eyebrow} maxLength={100} onChange={(event) => setCopyField("finder", "eyebrow", event.target.value)} /></label>
              <label><span>Título</span><input value={copy.finder.title} maxLength={180} onChange={(event) => setCopyField("finder", "title", event.target.value)} /></label>
              <label><span>Destacado</span><input value={copy.finder.highlight} maxLength={180} onChange={(event) => setCopyField("finder", "highlight", event.target.value)} /></label>
              <label><span>CTA</span><input value={copy.finder.cta} maxLength={100} onChange={(event) => setCopyField("finder", "cta", event.target.value)} /></label>
              <label data-wide="true"><span>Descripción</span><textarea value={copy.finder.text} maxLength={900} onChange={(event) => setCopyField("finder", "text", event.target.value)} /></label>
              {copy.finder.features.map((feature, index) => (
                <label key={index}>
                  <span>Señal {index + 1}</span>
                  <input value={feature} maxLength={100} onChange={(event) => setTupleValue("finder", "features", index, event.target.value)} />
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
                  <input value={copy.updates[field]} maxLength={180} onChange={(event) => setCopyField("updates", field, event.target.value)} />
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
                  <input value={copy.lowSpec[field]} maxLength={180} onChange={(event) => setCopyField("lowSpec", field, event.target.value)} />
                </label>
              ))}
              <label data-wide="true"><span>Descripción</span><textarea value={copy.lowSpec.text} maxLength={900} onChange={(event) => setCopyField("lowSpec", "text", event.target.value)} /></label>
              {copy.lowSpec.optionTitles.map((title, index) => (
                <label key={`option-title-${index}`}>
                  <span>Opción {index + 1} · título</span>
                  <input value={title} maxLength={180} onChange={(event) => setTupleValue("lowSpec", "optionTitles", index, event.target.value)} />
                </label>
              ))}
              {copy.lowSpec.optionSubtitles.map((subtitle, index) => (
                <label key={`option-subtitle-${index}`}>
                  <span>Opción {index + 1} · descripción</span>
                  <input value={subtitle} maxLength={900} onChange={(event) => setTupleValue("lowSpec", "optionSubtitles", index, event.target.value)} />
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
                  <input value={copy.recommended[field]} maxLength={180} onChange={(event) => setCopyField("recommended", field, event.target.value)} />
                </label>
              ))}
              <label data-wide="true"><span>Descripción</span><textarea value={copy.recommended.text} maxLength={900} onChange={(event) => setCopyField("recommended", "text", event.target.value)} /></label>
            </div>
          </details>

          <details className={styles.copyGroup}>
            <summary>Bloque de confianza</summary>
            <div className={styles.copyFields}>
              {copy.trust.items.map((item, index) => (
                <div key={index}>
                  <label><span>Tarjeta {index + 1} · título</span><input value={item.title} maxLength={180} onChange={(event) => setTrustValue(index, "title", event.target.value)} /></label>
                  <label><span>Tarjeta {index + 1} · texto</span><textarea value={item.text} maxLength={900} onChange={(event) => setTrustValue(index, "text", event.target.value)} /></label>
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
        <button type="submit" disabled={!dirty}>
          {dirty ? "Guardar presentación" : "Presentación guardada"}
        </button>
      </div>
    </form>
  );
}
