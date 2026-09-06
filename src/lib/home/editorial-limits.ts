const URL_ENCODED_MAX_BYTES_PER_JSON_CHAR = 9;
const EXPECTED_REVISION_MAX_CHARS = 10;

export const HOME_CURATION_MAX_JSON_CHARS = 20_000;
export const HOME_PRESENTATION_MAX_JSON_CHARS = 24_000;

function fixedFieldMaxBytes(
  name: string,
  valueMaxChars: number
) {
  return name.length + 1 + valueMaxChars;
}

function jsonFieldMaxBytes(
  name: string,
  valueMaxChars: number
) {
  /*
   * URLSearchParams usa application/x-www-form-urlencoded. Una unidad UTF-16
   * puede convertirse como máximo en 3 bytes UTF-8 y cada byte no seguro puede
   * representarse como %XX (3 bytes ASCII): 3 * 3 = 9. Es un techo deliberado,
   * no una estimación de contenido típico.
   */
  return (
    name.length +
    1 +
    valueMaxChars * URL_ENCODED_MAX_BYTES_PER_JSON_CHAR
  );
}

const expectedRevisionFieldMaxBytes = fixedFieldMaxBytes(
  "expectedRevision",
  EXPECTED_REVISION_MAX_CHARS
);

export const HOME_CURATION_MAX_FORM_BYTES =
  expectedRevisionFieldMaxBytes +
  1 +
  jsonFieldMaxBytes(
    "curationJson",
    HOME_CURATION_MAX_JSON_CHARS
  );

export const HOME_PRESENTATION_MAX_FORM_BYTES =
  expectedRevisionFieldMaxBytes +
  1 +
  jsonFieldMaxBytes(
    "presentationJson",
    HOME_PRESENTATION_MAX_JSON_CHARS
  );

export const HOME_CONTENT_MAX_FORM_BYTES =
  expectedRevisionFieldMaxBytes +
  1 +
  jsonFieldMaxBytes(
    "curationJson",
    HOME_CURATION_MAX_JSON_CHARS
  ) +
  1 +
  jsonFieldMaxBytes(
    "presentationJson",
    HOME_PRESENTATION_MAX_JSON_CHARS
  );
