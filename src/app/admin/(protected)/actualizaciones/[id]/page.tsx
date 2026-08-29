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
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminUpdateEditorPage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ id }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const item = await getEditorialItem(
    "game_update",
    id
  );

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const update = item.payload;
  const publishedAt = new Date(
    update.publishedAt
  )
    .toISOString()
    .slice(0, 16);

  return (
    <>
      <Link
        href="/admin/actualizaciones"
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a actualizaciones
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>ACTUALIZACIÓN · REVISIÓN {item.revision}</span>
          <h1>{update.version}</h1>
          <p>
            Juego relacionado: {update.gameSlug}. La identidad y relación no pueden cambiarse desde este formulario.
          </p>
        </div>
        <span className={styles.draftState}>
          {item.status === "synced"
            ? "Sin cambios"
            : "Borrador modificado"}
        </span>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.editorPanel}>
        <form
          className={styles.editorForm}
          method="post"
          action={`/api/admin/content/updates/${encodeURIComponent(id)}`}
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={item.revision}
          />

          <label>
            <span>Versión</span>
            <input
              name="version"
              defaultValue={update.version}
              maxLength={80}
              required
            />
          </label>

          <label>
            <span>Fecha y hora UTC</span>
            <input
              name="publishedAt"
              type="datetime-local"
              defaultValue={publishedAt}
              required
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              name="type"
              defaultValue={update.type}
              required
            >
              <option value="update">Actualización</option>
              <option value="content">Contenido</option>
              <option value="fix">Corrección</option>
              <option value="improvement">Mejora</option>
            </select>
          </label>

          <label>
            <span>Destacada</span>
            <select
              name="featured"
              defaultValue={
                update.featured ? "true" : "false"
              }
              required
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>

          <label className={styles.fieldWide}>
            <span>Resumen</span>
            <textarea
              name="summary"
              defaultValue={update.summary}
              maxLength={1500}
              rows={6}
              required
            />
          </label>

          <div className={styles.formActions}>
            <p>
              Guardar no modifica la sección pública de actualizaciones.
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
