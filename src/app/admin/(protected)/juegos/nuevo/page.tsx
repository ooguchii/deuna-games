import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminNewGamePage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const parameters = await searchParams;
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  return (
    <>
      <Link
        href="/admin/juegos"
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a juegos
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>ALTA EDITORIAL</span>
          <h1>Nuevo juego</h1>
          <p>
            Crea un borrador privado con los datos mínimos. El juego no aparecerá en la web hasta que lo revises y pulses Publicar.
          </p>
        </div>
        <span className={styles.draftState}>
          <Plus size={15} aria-hidden="true" />
          Borrador oculto
        </span>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.editorPanel}>
        <form
          className={styles.editorForm}
          method="post"
          action="/api/admin/content/games"
        >
          <label>
            <span>Slug / identificador</span>
            <input
              name="slug"
              placeholder="ejemplo-mi-juego"
              minLength={1}
              maxLength={160}
              pattern="[a-z0-9][a-z0-9._-]*"
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>Título</span>
            <input
              name="title"
              maxLength={140}
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>Categoría</span>
            <input
              name="category"
              maxLength={80}
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>Versión inicial</span>
            <input
              name="version"
              maxLength={240}
              autoComplete="off"
            />
          </label>

          <label>
            <span>Insignia</span>
            <input
              name="badge"
              maxLength={240}
              autoComplete="off"
              placeholder="Opcional"
            />
          </label>

          <label>
            <span>Texto alternativo de portada</span>
            <input
              name="imageAlt"
              maxLength={240}
              autoComplete="off"
              required
            />
          </label>

          <label className={styles.fieldWide}>
            <span>Descripción</span>
            <textarea
              name="description"
              maxLength={2500}
              rows={7}
              required
            />
          </label>

          <div className={styles.formActions}>
            <p>
              Después de crear el borrador podrás añadir imágenes, requisitos, plataformas, fuentes de descarga y el resto de la ficha desde el editor normal.
            </p>
            <button type="submit">
              Crear borrador
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
