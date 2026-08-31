import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import PublicationPanel from "@/components/admin/PublicationPanel";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getUpdatePublicationState,
} from "@/lib/admin/publication-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

const updateSections = [
  "editar",
  "publicacion",
  "historial",
] as const;

type UpdateSection = (typeof updateSections)[number];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    estado?: string | string[];
    seccion?: string | string[];
  }>;
};

function resolveUpdateSection(
  value: string | string[] | undefined
): UpdateSection {
  const candidate = Array.isArray(value)
    ? value[0]
    : value;

  return updateSections.includes(candidate as UpdateSection)
    ? (candidate as UpdateSection)
    : "editar";
}

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

  let publicationState = null;

  try {
    publicationState =
      await getUpdatePublicationState(id);
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de la actualización."
    );
  }

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const section = resolveUpdateSection(parameters.seccion);
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

      <AdminPageHeader
        eyebrow={<>ACTUALIZACIÓN · REVISIÓN {item.revision}</>}
        title={update.version}
        description={<>Juego relacionado: {update.gameSlug}. Edita, publica o revisa el historial como tareas separadas.</>}
        action={<span className={styles.draftState}>
          {publicationState?.publicVisible === false
            ? "Oculta de la web"
            : publicationState?.hasUnpublishedChanges
              ? "Cambios sin publicar"
              : item.status === "synced"
                ? "Sin cambios"
                : "Borrador guardado"}
        </span>}
      />

      <EditorStateNotice state={state} />

      {section === "editar" && (
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
                Guardar conserva el cambio como borrador. La web pública sólo cambia al publicar.
              </p>
              <button type="submit">
                Guardar borrador
              </button>
            </div>
          </form>
        </section>
      )}

      {section === "publicacion" && (
        <section className={styles.editorPanel}>
          {publicationState ? (
            <PublicationPanel
              state={publicationState}
              requestState={state}
              publishAction={`/api/admin/content/updates/${encodeURIComponent(id)}/publish`}
              restoreActionBase="/api/admin/content/update-publications"
              hideAction={`/api/admin/content/updates/${encodeURIComponent(id)}/hide`}
            />
          ) : (
            <p>
              La infraestructura de publicación todavía no está disponible en esta base. El borrador permanece intacto hasta aplicar la migración editorial correspondiente.
            </p>
          )}
        </section>
      )}

      {section === "historial" && (
        <EditorialHistory
          revisions={item.revisions}
          currentRevision={item.revision}
        />
      )}
    </>
  );
}
