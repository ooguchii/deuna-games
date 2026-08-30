import styles from "../../app/admin/admin.module.css";

type GameMediaUploadFormProps = {
  slug: string;
  revision: number;
  screenshotCount: number;
};

export default function GameMediaUploadForm({
  slug,
  revision,
  screenshotCount,
}: GameMediaUploadFormProps) {
  return (
    <form
      className={styles.editorForm}
      method="post"
      encType="multipart/form-data"
      action={`/api/admin/content/games/${encodeURIComponent(slug)}/media-upload`}
    >
      <input
        type="hidden"
        name="expectedRevision"
        value={revision}
      />

      <label>
        <span>Destino de la imagen</span>
        <select name="kind" defaultValue="cover" required>
          <option value="cover">Portada</option>
          <option value="hero">Imagen hero</option>
          <option
            value="screenshot"
            disabled={screenshotCount >= 8}
          >
            Captura de galería
          </option>
        </select>
      </label>

      <label>
        <span>Archivo WebP</span>
        <input
          name="image"
          type="file"
          accept="image/webp,.webp"
          required
        />
      </label>

      <div className={styles.formActions}>
        <p>
          Sólo WebP estático de hasta 6 MB. Se rechazan animaciones, perfiles ICC y metadatos EXIF/XMP. La carga se guarda en el borrador, no se publica automáticamente.
        </p>
        <button type="submit">
          Subir y guardar
        </button>
      </div>
    </form>
  );
}
