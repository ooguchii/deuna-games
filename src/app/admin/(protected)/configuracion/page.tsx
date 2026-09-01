import { notFound } from "next/navigation";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import PublicationPanel from "@/components/admin/PublicationPanel";
import SiteBackgroundManager from "@/components/admin/SiteBackgroundManager";
import SiteIdentityPreview from "@/components/admin/SiteIdentityPreview";
import { getEditorialItem } from "@/lib/admin/content-service";
import { getSiteConfigPublicationState } from "@/lib/admin/publication-service";
import { verifyAdminSession } from "@/lib/admin/session";
import { siteConfig as sourceSiteConfig } from "@/lib/site";

import styles from "../../admin.module.css";
import configStyles from "./configuration.module.css";

export const dynamic = "force-dynamic";

const sections = [
  "identidad",
  "apariencia",
  "publicacion",
  "historial",
] as const;

type ConfigurationSection = (typeof sections)[number];

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
    seccion?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSection(
  value: string | string[] | undefined
): ConfigurationSection {
  const candidate = single(value);

  return sections.includes(candidate as ConfigurationSection)
    ? (candidate as ConfigurationSection)
    : "identidad";
}

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
    publicationState = await getSiteConfigPublicationState();
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de la configuración."
    );
  }

  const state = single(parameters.estado);
  const section = resolveSection(parameters.seccion);
  const config = {
    ...sourceSiteConfig,
    ...item.payload,
    footerTagline:
      item.payload.footerTagline ?? sourceSiteConfig.footerTagline,
    brandColor:
      item.payload.brandColor ?? sourceSiteConfig.brandColor,
  };
  const status = publicationState?.hasUnpublishedChanges
    ? "Cambios sin publicar"
    : item.status === "synced"
      ? "Sin cambios"
      : "Borrador guardado";

  return (
    <>
      <AdminPageHeader
        eyebrow={<>CONFIGURACIÓN · REVISIÓN {item.revision}</>}
        title="Identidad pública"
        description="Administra la identidad y la apariencia pública sin modificar el dominio, los secretos, la VPN ni la configuración del servidor. Todo se guarda primero como borrador."
        action={<span className={styles.draftState}>{status}</span>}
      />

      <EditorStateNotice state={state} />

      {section === "identidad" && (
        <div className={configStyles.workspace}>
          <section className={`${styles.editorPanel} ${configStyles.formPanel}`}>
            <div className={configStyles.sectionIntro}>
              <span>DATOS GENERALES</span>
              <h2>Nombre y presentación</h2>
              <p>Estos datos se guardan como borrador hasta que decidas publicarlos.</p>
            </div>

            <form className={styles.editorForm} method="post" action="/api/admin/content/configuration?seccion=identidad">
              <input type="hidden" name="expectedRevision" value={item.revision} />
              <input type="hidden" name="themeColor" value={config.themeColor} />
              <input type="hidden" name="brandColor" value={config.brandColor} />

              <label>
                <span>Nombre</span>
                <input name="name" defaultValue={config.name} maxLength={100} required />
              </label>
              <label>
                <span>Nombre corto</span>
                <input name="shortName" defaultValue={config.shortName} maxLength={100} required />
              </label>
              <label className={styles.fieldWide}>
                <span>Descripción</span>
                <textarea name="description" defaultValue={config.description} maxLength={500} rows={5} required />
              </label>
              <label className={styles.fieldWide}>
                <span>Lema del pie de página</span>
                <input name="footerTagline" defaultValue={config.footerTagline} maxLength={180} required />
                <small>Se muestra junto al copyright; los enlaces del pie permanecen protegidos.</small>
              </label>
              <label className={styles.fieldWide}>
                <span>Idioma</span>
                <select name="language" defaultValue={config.language} required>
                  <option value="es">Español neutral</option>
                </select>
                <small>La interfaz pública actual está disponible en español.</small>
              </label>
              <div className={styles.formActions}>
                <p>Guardar no publica. La identidad activa permanece intacta hasta pulsar Publicar.</p>
                <button type="submit">Guardar borrador</button>
              </div>
            </form>
          </section>

          <SiteIdentityPreview {...config} />
        </div>
      )}

      {section === "apariencia" && (
        <>
          <div className={configStyles.workspace}>
            <section className={`${styles.editorPanel} ${configStyles.formPanel}`}>
              <div className={configStyles.sectionIntro}>
                <span>APARIENCIA</span>
                <h2>Paleta global</h2>
                <p>El fondo define navegador y superficies; la marca unifica logo, botones, enlaces y foco.</p>
              </div>

              <form className={styles.editorForm} method="post" action="/api/admin/content/configuration?seccion=apariencia">
                <input type="hidden" name="expectedRevision" value={item.revision} />
                <input type="hidden" name="name" value={config.name} />
                <input type="hidden" name="shortName" value={config.shortName} />
                <input type="hidden" name="description" value={config.description} />
                <input type="hidden" name="footerTagline" value={config.footerTagline} />
                <input type="hidden" name="language" value={config.language} />

                <div className={`${configStyles.colorFields} ${styles.fieldWide}`}>
                  <label className={configStyles.colorField}>
                    <div>
                      <strong>Fondo y navegador</strong>
                      <span>{config.themeColor}</span>
                    </div>
                    <input type="color" name="themeColor" defaultValue={config.themeColor} aria-label="Color de fondo y navegador" required />
                  </label>
                  <label className={configStyles.colorField}>
                    <div>
                      <strong>Color de marca</strong>
                      <span>{config.brandColor}</span>
                    </div>
                    <input type="color" name="brandColor" defaultValue={config.brandColor} aria-label="Color de marca" required />
                  </label>
                </div>

                <div className={styles.formActions}>
                  <p>La paleta se aplicará a todo el sitio y el panel sólo después de publicar.</p>
                  <button type="submit">Guardar apariencia</button>
                </div>
              </form>
            </section>

            <SiteIdentityPreview {...config} />
          </div>

          <SiteBackgroundManager
            revision={item.revision}
            brandColor={config.brandColor}
            customAssets={config.backgroundLibrary ?? []}
            pageBackgrounds={config.pageBackgrounds ?? {}}
          />
        </>
      )}

      {section === "publicacion" && (
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
      )}

      {section === "historial" && (
        <EditorialHistory revisions={item.revisions} currentRevision={item.revision} />
      )}
    </>
  );
}
