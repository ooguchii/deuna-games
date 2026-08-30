"use client";

import {
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { GameDownloadSource } from "@/types/game";

import styles from "./GameDownloadEditor.module.css";

type GameDownloadEditorProps = {
  initialSources: GameDownloadSource[];
};

const MAX_EDITOR_SOURCES = 6;

function emptySource(
  sources: GameDownloadSource[]
): GameDownloadSource {
  let index = sources.length + 1;
  let id = `source-${index}`;
  const used = new Set(
    sources.map((source) => source.id)
  );

  while (used.has(id)) {
    index += 1;
    id = `source-${index}`;
  }

  return {
    id,
    name: "",
    href: "",
    label: "",
  };
}

export default function GameDownloadEditor({
  initialSources,
}: GameDownloadEditorProps) {
  const [sources, setSources] = useState<
    GameDownloadSource[]
  >(() =>
    initialSources
      .slice(0, MAX_EDITOR_SOURCES)
      .map((source) => ({
        ...source,
      }))
  );

  const serialized = useMemo(
    () =>
      JSON.stringify(
        sources.map((source) => ({
          id: source.id.trim(),
          name: source.name.trim(),
          href: source.href.trim(),
          ...(source.label?.trim()
            ? { label: source.label.trim() }
            : {}),
        }))
      ),
    [sources]
  );

  function updateSource(
    index: number,
    field: keyof GameDownloadSource,
    value: string
  ) {
    setSources((current) =>
      current.map((source, sourceIndex) =>
        sourceIndex === index
          ? { ...source, [field]: value }
          : source
      )
    );
  }

  function removeSource(index: number) {
    setSources((current) =>
      current.filter(
        (_, sourceIndex) => sourceIndex !== index
      )
    );
  }

  function addSource() {
    setSources((current) =>
      current.length >= MAX_EDITOR_SOURCES
        ? current
        : [...current, emptySource(current)]
    );
  }

  return (
    <div className={styles.root}>
      <input
        type="hidden"
        name="sourcesJson"
        value={serialized}
      />

      <div className={styles.heading}>
        <div>
          <strong>Fuentes de descarga</strong>
          <span>
            Hasta 6 destinos por ahora. Se aceptan rutas internas o HTTPS sin credenciales.
          </span>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={addSource}
          disabled={sources.length >= MAX_EDITOR_SOURCES}
        >
          <Plus size={15} aria-hidden="true" />
          Agregar fuente
        </button>
      </div>

      {sources.length === 0 ? (
        <div className={styles.empty}>
          Este juego todavía no tiene fuentes de descarga configuradas.
        </div>
      ) : (
        <div className={styles.list}>
          {sources.map((source, index) => (
            <fieldset
              key={index}
              className={styles.source}
            >
              <legend>Fuente {index + 1}</legend>

              <label>
                <span>Identificador</span>
                <input
                  value={source.id}
                  onChange={(event) =>
                    updateSource(
                      index,
                      "id",
                      event.target.value
                    )
                  }
                  maxLength={160}
                  pattern="[a-z0-9][a-z0-9._-]*"
                  placeholder="mediafire"
                  required
                />
              </label>

              <label>
                <span>Nombre visible</span>
                <input
                  value={source.name}
                  onChange={(event) =>
                    updateSource(
                      index,
                      "name",
                      event.target.value
                    )
                  }
                  maxLength={100}
                  placeholder="MediaFire"
                  required
                />
              </label>

              <label className={styles.hrefField}>
                <span>Dirección</span>
                <input
                  value={source.href}
                  onChange={(event) =>
                    updateSource(
                      index,
                      "href",
                      event.target.value
                    )
                  }
                  maxLength={2048}
                  placeholder="https://... o /ruta-interna"
                  required
                />
              </label>

              <label>
                <span>Texto del botón</span>
                <input
                  value={source.label ?? ""}
                  onChange={(event) =>
                    updateSource(
                      index,
                      "label",
                      event.target.value
                    )
                  }
                  maxLength={240}
                  placeholder="Ir al enlace"
                />
              </label>

              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeSource(index)}
                aria-label={`Eliminar fuente ${index + 1}`}
              >
                <Trash2 size={15} aria-hidden="true" />
                Eliminar
              </button>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
