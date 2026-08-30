"use client";

import {
  AlertTriangle,
  Check,
  FilePenLine,
  ImageIcon,
  Rocket,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import adminStyles from "../../app/admin/admin.module.css";
import styles from "./NewGameForm.module.css";

const slugPattern = /^[a-z0-9][a-z0-9._-]{0,159}$/;

function slugFromTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function availableSlug(
  base: string,
  existing: Set<string>
) {
  if (!base || !existing.has(base)) return base;

  for (let index = 2; index < 100_000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(
      0,
      160 - suffix.length
    )}${suffix}`;

    if (!existing.has(candidate)) return candidate;
  }

  return "";
}

export default function NewGameForm({
  classifications,
  existingSlugs,
}: {
  classifications: string[];
  existingSlugs: string[];
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [imageAlt, setImageAlt] = useState("");
  const [imageAltEdited, setImageAltEdited] = useState(false);
  const existingSlugSet = useMemo(
    () => new Set(existingSlugs),
    [existingSlugs]
  );
  const baseGeneratedSlug = useMemo(
    () => slugFromTitle(title),
    [title]
  );
  const generatedSlug = useMemo(
    () => availableSlug(baseGeneratedSlug, existingSlugSet),
    [baseGeneratedSlug, existingSlugSet]
  );
  const slugTaken = Boolean(
    slug && existingSlugSet.has(slug)
  );
  const slugValid = slugPattern.test(slug);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(
        availableSlug(
          slugFromTitle(value),
          existingSlugSet
        )
      );
    }

    if (!imageAltEdited) {
      setImageAlt(
        value.trim() ? `Portada de ${value.trim()}` : ""
      );
    }
  }

  return (
    <>
      <ol className={styles.steps} aria-label="Proceso de alta y publicación">
        <li data-active="true">
          <span>1</span>
          <div>
            <strong>Crear borrador</strong>
            <small>Datos base y slug</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Completar ficha</strong>
            <small>Datos, requisitos y multimedia</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Vista previa</strong>
            <small>Revisión antes de publicar</small>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <strong>Publicar</strong>
            <small>Snapshot público explícito</small>
          </div>
        </li>
      </ol>

      <section className={`${adminStyles.editorPanel} ${styles.panel}`}>
        <div className={styles.intro}>
          <span className={styles.introIcon}>
            <FilePenLine size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>Empieza con lo esencial</strong>
            <p>
              Este paso sólo crea un borrador privado. Después entrarás al workspace del juego para completar cada sección antes de publicarlo.
            </p>
          </div>
        </div>

        <form
          className={`${adminStyles.editorForm} ${styles.form}`}
          method="post"
          action="/api/admin/content/games"
        >
          <label className={styles.titleField}>
            <span>Título del juego</span>
            <input
              name="title"
              value={title}
              onChange={(event) =>
                handleTitleChange(event.target.value)
              }
              maxLength={140}
              autoComplete="off"
              placeholder="Ej. Hollow Knight: Silksong"
              autoFocus
              required
            />
            <small>
              Es el nombre que verá el visitante. Podrás cambiarlo después sin alterar el identificador.
            </small>
          </label>

          <label className={styles.slugField}>
            <span>Slug / identificador permanente</span>
            <div className={styles.slugControl}>
              <input
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase());
                }}
                aria-invalid={slugTaken || (Boolean(slug) && !slugValid)}
                aria-describedby="new-game-slug-status"
                placeholder="hollow-knight-silksong"
                minLength={1}
                maxLength={160}
                pattern="[a-z0-9][a-z0-9._-]*"
                autoComplete="off"
                required
              />
              {slugEdited && generatedSlug && slug !== generatedSlug && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugEdited(false);
                    setSlug(generatedSlug);
                  }}
                >
                  Usar automático
                </button>
              )}
            </div>

            <div
              id="new-game-slug-status"
              className={
                slugTaken
                  ? styles.slugStatusError
                  : slugValid
                    ? styles.slugStatusOk
                    : styles.slugStatusHint
              }
              aria-live="polite"
            >
              {slugTaken ? (
                <>
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>
                    Este identificador ya pertenece a otro juego. Elige otro o usa el automático disponible.
                  </span>
                </>
              ) : slugValid ? (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span>Identificador disponible.</span>
                </>
              ) : (
                <span>
                  Se genera desde el título. Usa sólo letras minúsculas, números, punto, guion o guion bajo.
                </span>
              )}
            </div>

            <small>
              Conviene no cambiarlo una vez creado porque forma parte de la URL y de las relaciones internas. El servidor volverá a comprobarlo al crear el borrador.
            </small>
          </label>

          <label>
            <span>Clasificación principal</span>
            <select
              name="category"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Selecciona una clasificación
              </option>
              {classifications.map((classification) => (
                <option key={classification} value={classification}>
                  {classification}
                </option>
              ))}
            </select>
            <small>
              Todas las opciones salen de una única lista administrada en Catálogos. Después podrás agregar clasificaciones adicionales al mismo juego.
            </small>
          </label>

          <label>
            <span>Versión inicial</span>
            <input
              name="version"
              maxLength={240}
              autoComplete="off"
              placeholder="Opcional"
            />
          </label>

          <label>
            <span>Insignia</span>
            <input
              name="badge"
              maxLength={240}
              autoComplete="off"
              placeholder="Opcional · NUEVO, DESTACADO..."
            />
          </label>

          <label>
            <span>Texto alternativo de portada</span>
            <input
              name="imageAlt"
              value={imageAlt}
              onChange={(event) => {
                setImageAltEdited(true);
                setImageAlt(event.target.value);
              }}
              maxLength={240}
              autoComplete="off"
              required
            />
            <small>
              Lo completamos desde el título; puedes hacerlo más descriptivo cuando cargues la portada.
            </small>
          </label>

          <label className={`${adminStyles.fieldWide} ${styles.descriptionField}`}>
            <span>Descripción</span>
            <textarea
              name="description"
              maxLength={2500}
              rows={7}
              placeholder="Explica de qué trata el juego, su propuesta y lo más importante para quien abre la ficha."
              required
            />
          </label>

          <div className={`${adminStyles.formActions} ${styles.formActions}`}>
            <div className={styles.safetyNote}>
              <Check size={16} aria-hidden="true" />
              <p>
                Crear no publica. El nuevo juego nace oculto y sólo se vuelve visible desde su pestaña Publicación.
              </p>
            </div>
            <button
              type="submit"
              disabled={
                slugTaken ||
                !slugValid ||
                classifications.length === 0
              }
            >
              Crear borrador y continuar
            </button>
          </div>
        </form>

        <div className={styles.nextPreview} aria-label="Qué sigue después de crear">
          <div>
            <ImageIcon size={17} aria-hidden="true" />
            <span>
              Después completas desarrollador, plataformas, requisitos, imágenes y descargas en pestañas separadas.
            </span>
          </div>
          <div>
            <Rocket size={17} aria-hidden="true" />
            <span>
              Publicación mostrará un checklist y el estado exacto antes de cambiar la web.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
