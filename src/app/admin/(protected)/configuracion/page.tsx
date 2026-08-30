import { notFound } from "next/navigation";

import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import PublicationPanel from "@/components/admin/PublicationPanel";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getSiteConfigPublicationState,
} from "@/lib/admin/publication-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminConfigurationPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [item, parameters] = await Promise.all([
    getEditorialItem("site_config", "site"),
    searchParams,
  ]);

  if (!item) notFound();

  let publicationState = null;

  try {
    publicationState =
      await getSiteConfigPublicationState();
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de la configuración."
    );
  }

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const config = item.payload;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>CONFIGURACIÓN · REVISIÓN {item.revision}</span>
          <h1>Identidad pública</h1>
          <p>
            Nombre, descripción, idioma y color se guardan primero como borrador. El dominio, secretos, VPN y configuración del servidor permanecen fuera del editor.
          </p>
        </div>
        <span className={styles.draftState}>
          {publicationState?.hasUnpublishedChanges
            ? "Cambios sin publicar"
            : item.status === "synced"
              ? "Sin cambios"
              : "Borrador guardado"}
        </span>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.editorPanel}>
        <form
          className={styles.editorForm}
          method="post"
          action="/api/admin/content/configuration"
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={item.revision}
          />

          <label>
            <span>Nombre</span>
            <input
              name="name"
              defaultValue={config.name}
              maxLength={100}
              required
            />
          </label>

          <label>
            <span>Nombre corto</span>
            <input
              name="shortName"
              defaultValue={config.shortName}
              maxLength={100}
              required
            />
          </label>

          <label className={styles.fieldWide}>
            <span>Descripción</span>
            <textarea
              name="description"
              defaultValue={config.description}
              maxLength={500}
              rows={5}
              required
            />
          </label>

          <label>
            <span>Idioma neutral</span>
            <select
              name="language"
              defaultValue={config.language}
              required
            >
              <option value="es">Español neutral</option>
            </select>
          </label>

          <label>
            <span>Color del tema</span>
            <input
              name="themeColor"
              defaultValue={config.themeColor}
              pattern="#[0-9A-Fa-f]{6}"
              maxLength={7}
              required
            />
          </label>

          <div className={styles.formActions}>
            <p>
              Guardar no publica. La identidad activa permanece intacta hasta pulsar Publicar.
            </p>
            <button type="submit">
              Guardar borrador
            </button>
          </div>
        </form>
      </section>

      <section className={styles.editorPanel}>
        {publicationState ? (
          <PublicationPanel
            state={publicationState}
            requestState={state}
            publishAction="/api/admin/content/configuration/publish"
            restoreActionBase="/api/admin/content/configuration-publications"
          />
        ) : (
          <p>
            La infraestructura de publicación todavía no está disponible en esta base. El borrador permanece intacto hasta aplicar la migración editorial correspondiente.
          </p>
        )}
      </section>

      <EditorialHistory
        revisions={item.revisions}
        currentRevision={item.revision}
      />
    </>
  );
}
