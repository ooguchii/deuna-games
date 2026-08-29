import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminGameEditorPage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ slug }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const item = await getEditorialItem("game", slug);

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const game = item.payload;

  return (
    <>
      <Link href="/admin/juegos" className={styles.backLink}>
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a juegos
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>JUEGO · REVISIÓN {item.revision}</span>
          <h1>{game.title}</h1>
          <p>
            Edita solamente los datos principales. Descargas, rutas de imágenes y requisitos permanecen intactos.
          </p>
        </div>
        <span className={styles.draftState}>
          {item.status === "synced"
            ? "Sin cambios"
            : "Borrador modificado"}
        </span>
      </header>

      <EditorStateNotice state={state} />

      {!item.sourcePresent && (
        <div className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}>
          Este juego ya no está presente en los archivos fuente. Se conserva para revisión y recuperación.
        </div>
      )}

      <section className={styles.editorPanel}>
        <form
          className={styles.editorForm}
          method="post"
          action={`/api/admin/content/games/${encodeURIComponent(slug)}`}
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={item.revision}
          />

          <label className={styles.fieldWide}>
            <span>Título</span>
            <input
              name="title"
              defaultValue={game.title}
              maxLength={140}
              required
            />
          </label>

          <label className={styles.fieldWide}>
            <span>Descripción</span>
            <textarea
              name="description"
              defaultValue={game.description}
              maxLength={2500}
              rows={6}
              required
            />
          </label>

          <label>
            <span>Categoría</span>
            <input
              name="category"
              defaultValue={game.category}
              maxLength={80}
              required
            />
          </label>

          <label>
            <span>Versión</span>
            <input
              name="version"
              defaultValue={game.version ?? ""}
              maxLength={240}
            />
          </label>

          <label>
            <span>Insignia</span>
            <input
              name="badge"
              defaultValue={game.badge ?? ""}
              maxLength={240}
            />
          </label>

          <label>
            <span>Valoración (0–5)</span>
            <input
              name="rating"
              type="number"
              min="0"
              max="5"
              step="0.01"
              defaultValue={game.rating ?? ""}
            />
          </label>

          <label>
            <span>Reseñas</span>
            <input
              name="reviews"
              defaultValue={game.reviews ?? ""}
              maxLength={30}
              placeholder="12.4K"
            />
          </label>

          <label>
            <span>Texto alternativo</span>
            <input
              name="imageAlt"
              defaultValue={game.imageAlt}
              maxLength={240}
              required
            />
          </label>

          <div className={styles.formActions}>
            <p>
              Guardar no publica. La revisión anterior seguirá disponible debajo.
            </p>
            <button type="submit">
              Guardar borrador
            </button>
          </div>
        </form>
      </section>

      <EditorialHistory
        revisions={item.revisions}
        currentRevision={item.revision}
      />
    </>
  );
}
