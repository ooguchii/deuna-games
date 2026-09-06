export const HOME_CURATION_JSON_MAX_CHARS = 20_000;
export const HOME_PRESENTATION_JSON_MAX_CHARS = 24_000;

// Las copias locales agregan metadatos de recuperación (por ejemplo revision)
// alrededor del payload que finalmente valida el servidor. Este margen sólo
// cubre ese envelope; no amplía los límites editoriales de las rutas POST.
const HOME_RECOVERY_ENVELOPE_MAX_CHARS = 512;

export const HOME_CURATION_RECOVERY_MAX_CHARS =
  HOME_CURATION_JSON_MAX_CHARS + HOME_RECOVERY_ENVELOPE_MAX_CHARS;
export const HOME_PRESENTATION_RECOVERY_MAX_CHARS =
  HOME_PRESENTATION_JSON_MAX_CHARS + HOME_RECOVERY_ENVELOPE_MAX_CHARS;
