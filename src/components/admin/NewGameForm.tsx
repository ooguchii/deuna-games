"use client";

import {
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

export default function NewGameForm({
  categories,
}: {
  categories: string[];
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [imageAlt, setImageAlt] = useState("");
  const [imageAltEdited, setImageAltEdited] = useState(false);
  const generatedSlug = useMemo(
    () => slugFromTitle(title),
    [title]
  );

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(slugFromTitle(value));
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
            <strong>Empezá con lo esencial</strong>
            <p>
              Este paso sólo crea un borrador privado. Después vas a entrar al workspace del juego para completar cada sección antes de publicarlo.
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
            <small>
              Se genera desde el título. Conviene no cambiarlo una vez creado porque forma parte de la URL y de las relaciones internas.
            </small>
          </label>

          <label>
            <span>Categoría principal</span>
            <input
              name="category"
              maxLength={80}
              autoComplete="off"
              list="game-category-options"
              placeholder="Ej. Acción"
              required
            />
            <datalist id="game-category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
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
              Lo completamos desde el título; podés hacerlo más descriptivo cuando cargues la portada.
            </small>
          </label>

          <label className={`${adminStyles.fieldWide} ${styles.descriptionField}`}>
            <span>Descripción</span>
            <textarea
              name="description"
              maxLength={2500}
              rows={7}
              placeholder="Explicá de qué trata el juego, su propuesta y lo más importante para quien abre la ficha."
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
            <button type="submit">
              Crear borrador y continuar
            </button>
          </div>
        </form>

        <div className={styles.nextPreview} aria-label="Qué sigue después de crear">
          <div>
            <ImageIcon size={17} aria-hidden="true" />
            <span>
              Después completás desarrollador, plataformas, requisitos, imágenes y descargas en pestañas separadas.
            </span>
          </div>
          <div>
            <Rocket size={17} aria-hidden="true" />
            <span>
              Publicación te mostrará un checklist y el estado exacto antes de cambiar la web.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
