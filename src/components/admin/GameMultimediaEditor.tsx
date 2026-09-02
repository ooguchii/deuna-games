import type { ReactNode } from "react";

import GameEditorFormActions from "@/components/admin/GameEditorFormActions";
import GameMultimediaWorkspace from "@/components/admin/GameMultimediaWorkspace";

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
    <>
      <GameMultimediaWorkspace
        slug={slug}
        revision={revision}
        screenshotCount={screenshots.length}
        initialCoverImage={coverImage}
        initialHeroImage={heroImage}
        initialScreenshots={screenshots}
        videoEditor={videoEditor}
      />

      <form
        className={`${adminStyles.editorForm} ${styles.advancedForm}`}
        method="post"
        action={mediaAction}
      >
        <input type="hidden" name="expectedRevision" value={revision} />
        <details className={styles.advancedDetails}>
          <summary>Opciones avanzadas · rutas manuales</summary>
          <div className={styles.advancedFields}>
            <p className={styles.advancedIntro}>
              Mantenimiento y migraciones solamente. La biblioteca compartida es el flujo normal: valida los archivos del almacén editorial y reasigna referencias sin duplicar recursos.
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
          note="La biblioteca y las asignaciones se guardan en el borrador. Las rutas manuales quedan disponibles sólo como herramienta avanzada."
          action={mediaAction}
          continueTo="descargas"
          saveLabel="Guardar rutas multimedia"
          continueLabel="Guardar y continuar a Distribución"
        />
      </form>
    </>
  );
}
