import styles from "../../app/admin/admin.module.css";

const notices = {
  creado: {
    kind: "success",
    message:
      "Juego creado como borrador privado. Revisa sus datos y pulsa Publicar cuando esté listo para aparecer en la web.",
  },
  "actualizacion-creada": {
    kind: "success",
    message:
      "Actualización creada como borrador privado. Revisa sus datos y pulsa Publicar cuando deba aparecer en la web.",
  },
  duplicado: {
    kind: "warning",
    message:
      "Ese identificador ya existe. Usa uno distinto o edita el contenido existente.",
  },
  "juego-no-encontrado": {
    kind: "warning",
    message:
      "El juego relacionado no existe en el espacio editorial. Créalo o corrige el identificador antes de continuar.",
  },
  guardado: {
    kind: "success",
    message:
      "Borrador guardado. La web pública todavía no fue modificada.",
  },
  "catalogo-guardado": {
    kind: "success",
    message:
      "Catálogos guardados y versionados. Ningún juego ni página pública fue modificado.",
  },
  "catalogo-en-uso": {
    kind: "warning",
    message:
      "No se guardó el cambio porque quitaría o renombraría un término que todavía usa algún juego. Desactívalo si ya no quieres ofrecerlo para nuevas fichas.",
  },
  clasificacion: {
    kind: "error",
    message:
      "La clasificación no coincide con los Catálogos actuales. Selecciona categorías, géneros y etiquetas activas; los valores antiguos ya asignados se conservan hasta que decidas reemplazarlos.",
  },
  restaurado: {
    kind: "success",
    message:
      "Revisión restaurada como un borrador nuevo y recuperable.",
  },
  "imagen-subida": {
    kind: "success",
    message:
      "Imagen normalizada a WebP seguro, almacenada y guardada en el borrador. Aún no fue publicada.",
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
      "La imagen no pudo almacenarse. Vuelve a prepararla desde Multimedia; el panel puede convertir PNG, JPEG, AVIF o WebP y ajustar tamaño/calidad antes de guardar.",
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
