import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";

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
  "version-por-actualizacion": {
    kind: "warning",
    message:
      "La ficha no se guardó porque intentaste cambiar la versión de un juego ya publicado. Haz ese cambio desde Actualizar para que versión, descargas y aviso público permanezcan sincronizados.",
  },
  "actualizacion-publicada": {
    kind: "success",
    message:
      "Actualización publicada. La ficha conserva su misma URL y ya usa la nueva versión y las nuevas fuentes de descarga; el aviso quedó registrado en Actualizaciones.",
  },
  "actualizacion-juego-no-publicado": {
    kind: "warning",
    message:
      "Este juego todavía no está publicado. Completa primero su publicación inicial; las actualizaciones están reservadas para versiones posteriores de un juego ya visible.",
  },
  "actualizacion-cambios-pendientes": {
    kind: "warning",
    message:
      "El juego tiene otros cambios sin publicar. Por seguridad no se mezclaron con la actualización. Publica o restaura esos cambios y vuelve a intentarlo.",
  },
  "actualizacion-misma-version": {
    kind: "warning",
    message:
      "La nueva versión coincide con la versión pública actual. Para mantenimiento de mirrors o enlaces sin una versión nueva, usa Descargas; para anunciar una versión nueva, indica aquí su nuevo número.",
  },
  "actualizacion-sin-descarga": {
    kind: "error",
    message:
      "La actualización necesita al menos una fuente de descarga válida, visible y marcada como Disponible.",
  },
  "actualizacion-duplicada": {
    kind: "warning",
    message:
      "Ya existe un aviso registrado para esa versión de este juego. Revisa el historial antes de intentar publicarla nuevamente.",
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
  "recurso-subido": {
    kind: "success",
    message:
      "Recurso almacenado de forma segura en la biblioteca compartida. Todavía no modifica ningún destino hasta que lo asignes.",
  },
  "recurso-asignado": {
    kind: "success",
    message:
      "Recurso asignado desde la biblioteca compartida sin duplicar ni recodificar el archivo físico.",
  },
  "recurso-invalido": {
    kind: "error",
    message:
      "Ese recurso ya no está disponible o no supera la validación del almacén editorial. Recarga Multimedia y selecciona otro archivo.",
  },
  "preview-subido": {
    kind: "success",
    message:
      "Preview convertido a WebM/VP9 sin audio y guardado en el borrador. Las tarjetas públicas no cambiarán hasta publicar el juego.",
  },
  "preview-quitado": {
    kind: "success",
    message:
      "Preview retirado del borrador. Al publicar, las tarjetas volverán a mostrar únicamente la portada.",
  },
  ffmpeg: {
    kind: "error",
    message:
      "FFmpeg no está disponible en este servidor. Instálalo o configura DEUNA_FFMPEG_PATH y reinicia DeUna antes de convertir previews.",
  },
  "video-pesado": {
    kind: "error",
    message:
      "El preview no pudo quedar dentro del límite de peso incluso después de la recompresión. Prueba un fragmento con menos movimiento o menor resolución.",
  },
  "video-invalido": {
    kind: "error",
    message:
      "El archivo no pudo validarse o decodificarse como video. Usa MP4, WebM, MOV, M4V, MKV o AVI de hasta 64 MB.",
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
  const Icon =
    notice.kind === "success"
      ? CheckCircle2
      : notice.kind === "warning"
        ? AlertTriangle
        : CircleAlert;

  return (
    <div
      className={`${styles.editorNotice} ${variant} admin-editor-notice`}
      data-kind={notice.kind}
      role={notice.kind === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      <span>{notice.message}</span>
    </div>
  );
}
