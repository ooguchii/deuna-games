import type { ReactNode } from "react";

import GameEditorFormActions from "@/components/admin/GameEditorFormActions";
import GameMediaUploadForm from "@/components/admin/GameMediaUploadForm";
import GamePreviewAutoUrlEditor from "@/components/admin/GamePreviewAutoUrlEditor";

import adminStyles from "../../app/admin/admin.module.css";
import styles from "./GameMultimediaEditor.module.css";

type GameMultimediaEditorProps = {
  slug: string;
  revision: number;
  mediaAction: string;
  coverImage?: string;
  heroImage?: string;
  screenshots?: readonly string[];
  videoEditor: ReactNode;
};

function imageSlotState(value: string | undefined) {
  return value?.trim()
    ? "Configurada"
    : "Sin reemplazo editorial";
}

export default function GameMultimediaEditor({
  slug,
  revision,
  mediaAction,
  coverImage,
  heroImage,
  screenshots = [],
  videoEditor,
}: GameMultimediaEditorProps) {
  return (
    <div className={styles.workspace}>
      <div className={styles.column}>
        <section
          className={`${adminStyles.editorPanel} ${styles.panel}`}
          aria-labelledby="game-multimedia-images-heading"
        >
          <div className={adminStyles.sectionHeading}>
            <div>
              <span>MULTIMEDIA · IMÁGENES</span>
              <h2 id="game-multimedia-images-heading">
                Portada, hero y galería
              </h2>
            </div>
            <p>
              Elige el destino, carga una imagen y deja que el panel la
              normalice a WebP seguro. Las rutas manuales quedan separadas
              como una herramienta avanzada de mantenimiento.
            </p>
          </div>

          <dl
            className={styles.slotOverview}
            aria-label="Estado de las imágenes del juego"
          >
            <div>
              <dt>Portada</dt>
              <dd>{imageSlotState(coverImage)}</dd>
            </div>
            <div>
              <dt>Hero</dt>
              <dd>{imageSlotState(heroImage)}</dd>
            </div>
            <div>
              <dt>Galería</dt>
              <dd>{screenshots.length} de 8 capturas</dd>
            </div>
          </dl>

          <GameMediaUploadForm
            slug={slug}
            revision={revision}
            screenshotCount={screenshots.length}
          />

          <form
            className={`${adminStyles.editorForm} ${styles.advancedForm}`}
            method="post"
            action={mediaAction}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={revision}
            />

            <details className={styles.advancedDetails}>
              <summary>Opciones avanzadas · rutas manuales</summary>
              <div className={styles.advancedFields}>
                <p className={styles.advancedIntro}>
                  Usa estas rutas sólo para mantenimiento o migraciones.
                  Para el trabajo normal conviene utilizar el cargador de
                  imágenes de arriba, que valida y normaliza los archivos.
                </p>

                <label>
                  <span>Ruta de portada</span>
                  <input
                    name="coverImage"
                    defaultValue={coverImage ?? ""}
                    maxLength={400}
                    placeholder="Ruta local de la portada"
                  />
                </label>

                <label>
                  <span>Ruta de imagen hero</span>
                  <input
                    name="heroImage"
                    defaultValue={heroImage ?? ""}
                    maxLength={400}
                    placeholder="Ruta local de la imagen hero"
                  />
                </label>

                <label>
                  <span>Galería · una ruta por línea</span>
                  <textarea
                    name="screenshotsText"
                    defaultValue={screenshots.join("\n")}
                    maxLength={3500}
                    rows={7}
                    placeholder="Una ruta local por línea"
                  />
                </label>
              </div>
            </details>

            <GameEditorFormActions
              note="Portada, hero y galería se guardan en el borrador. Las opciones avanzadas no hace falta abrirlas para continuar."
              action={mediaAction}
              continueTo="descargas"
              saveLabel="Guardar rutas multimedia"
              continueLabel="Guardar y continuar a Distribución"
            />
          </form>
        </section>
      </div>

      <div className={`${styles.column} ${styles.videoColumn}`}>
        <GamePreviewAutoUrlEditor
          slug={slug}
          revision={revision}
        />
        {videoEditor}
      </div>
    </div>
  );
}
