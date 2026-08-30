import styles from "../../app/admin/admin.module.css";

const notices = {
  guardado: {
    kind: "success",
    message:
      "Borrador guardado. La web pública todavía no fue modificada.",
  },
  restaurado: {
    kind: "success",
    message:
      "Revisión restaurada como un borrador nuevo y recuperable.",
  },
  "imagen-subida": {
    kind: "success",
    message:
      "Imagen WebP almacenada y guardada en el borrador. Aún no fue publicada.",
  },
  conflicto: {
    kind: "warning",
    message:
      "Otra pestaña guardó una versión más reciente. Revisa los datos actuales antes de volver a guardar.",
  },
  "galeria-llena": {
    kind: "warning",
    message:
      "La galería ya contiene ocho capturas. Retira una ruta antes de añadir otra imagen.",
  },
  datos: {
    kind: "error",
    message:
      "Hay datos inválidos. Revisa los límites y formatos del formulario.",
  },
  asset: {
    kind: "error",
    message:
      "Una de las imágenes indicadas no existe en el almacén permitido. Corrige la ruta antes de guardar.",
  },
  "imagen-invalida": {
    kind: "error",
    message:
      "La imagen no pudo almacenarse. Usa un WebP estático de hasta 6 MB, sin EXIF, XMP, perfil ICC ni animación.",
  },
  solicitud: {
    kind: "error",
    message:
      "La solicitud fue rechazada por seguridad. Vuelve a abrir el editor.",
  },
  "no-encontrado": {
    kind: "warning",
    message:
      "El registro editorial ya no está disponible.",
  },
} as const;

export default function EditorStateNotice({
  state,
}: {
  state?: string;
}) {
  if (!state || !(state in notices)) return null;

  const notice = notices[
    state as keyof typeof notices
  ];
  const variant =
    notice.kind === "success"
      ? styles.editorNoticeSuccess
      : notice.kind === "warning"
        ? styles.editorNoticeWarning
        : styles.editorNoticeError;

  return (
    <div
      className={`${styles.editorNotice} ${variant}`}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      {notice.message}
    </div>
  );
}
