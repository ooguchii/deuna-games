import https from "node:https";
import process from "node:process";

import {
  representativeGameSlug,
} from "./browser-page-manifest.mjs";

const baseUrl = new URL(
  process.env.DEUNA_VISUAL_BASE_URL ??
    "https://127.0.0.1:3443"
);
const adminUsername =
  process.env.DEUNA_VISUAL_ADMIN_USERNAME?.trim();
const adminPassword =
  process.env.DEUNA_VISUAL_ADMIN_PASSWORD;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

if (
  baseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname)
) {
  throw new Error(
    "El lifecycle editorial de juego sólo puede ejecutarse contra el runtime HTTPS local aislado."
  );
}

if (!adminUsername || !adminPassword) {
  throw new Error(
    "Faltan DEUNA_VISUAL_ADMIN_USERNAME/DEUNA_VISUAL_ADMIN_PASSWORD."
  );
}

function request(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);

  if (url.origin !== baseUrl.origin) {
    throw new Error(
      `El lifecycle rechazó un destino fuera del origen visual: ${url.origin}.`
    );
  }

  const body = options.body ?? "";
  const headers = { ...(options.headers ?? {}) };

  if (body) {
    headers["content-length"] = String(
      Buffer.byteLength(body, "utf8")
    );
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: options.method ?? "GET",
        headers,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks = [];
        let size = 0;

        response.on("data", (chunk) => {
          size += chunk.length;

          if (size > MAX_RESPONSE_BYTES) {
            req.destroy(
              new Error(
                `La respuesta de ${url.pathname} superó ${MAX_RESPONSE_BYTES} bytes.`
              )
            );
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function formHeaders(referer, cookie) {
  return {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    origin: baseUrl.origin,
    referer: new URL(referer, baseUrl).href,
    "sec-fetch-site": "same-origin",
    ...(cookie ? { cookie } : {}),
  };
}

function sessionCookie(setCookie) {
  const values = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  const cookies = values
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter(Boolean);

  if (cookies.length === 0) {
    throw new Error(
      "El login del lifecycle no devolvió una cookie de sesión."
    );
  }

  return cookies.join("; ");
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#([0-9]+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function visibleText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstH1(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return "";
  return decodeHtml(match[1].replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attributeValue(tag, attribute) {
  const pattern = new RegExp(
    `\\b${attribute}="([^"]*)"`,
    "i"
  );
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1]) : null;
}

function inputValues(html, name) {
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const matches = [];

  for (const input of inputs) {
    if (attributeValue(input, "name") !== name) continue;
    const value = attributeValue(input, "value");
    if (value === null) {
      throw new Error(
        `El input ${name} existe pero no expone un value SSR.`
      );
    }
    matches.push(value);
  }

  if (matches.length === 0) {
    throw new Error(`No se encontró el input SSR ${name}.`);
  }

  return matches;
}

function singleInputValue(html, name) {
  const unique = [...new Set(inputValues(html, name))];

  if (unique.length !== 1) {
    throw new Error(
      `${name} no tiene un único valor coherente (${unique.length} variantes).`
    );
  }

  return unique[0];
}

function positiveInputNumber(html, name) {
  const value = Number(singleInputValue(html, name));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} no es válido: ${value}.`);
  }

  return value;
}

function selectOptionValues(html, name) {
  const selects = html.match(/<select\b[\s\S]*?<\/select>/gi) ?? [];

  for (const select of selects) {
    const opening = select.match(/^<select\b[^>]*>/i)?.[0] ?? "";
    if (attributeValue(opening, "name") !== name) continue;

    return (select.match(/<option\b[^>]*>/gi) ?? [])
      .map((option) => attributeValue(option, "value"))
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim());
  }

  return [];
}

function redirectLocation(response, label) {
  if (response.status !== 303) {
    throw new Error(
      `${label} respondió ${response.status}; se esperaba 303.`
    );
  }

  const location = response.headers.location;
  if (!location) {
    throw new Error(`${label} no devolvió Location.`);
  }

  const url = new URL(location, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new Error(
      `${label} intentó redirigir fuera del origen visual: ${url.origin}.`
    );
  }

  return url;
}

function parseJson(response, label) {
  if (response.status !== 200) {
    throw new Error(`${label} respondió ${response.status}.`);
  }

  try {
    return JSON.parse(response.body);
  } catch {
    throw new Error(`${label} no devolvió JSON válido.`);
  }
}

function requirePage(response, label, status = 200) {
  if (response.status !== status) {
    throw new Error(
      `${label} respondió ${response.status}; se esperaba ${status}.`
    );
  }
  return response;
}

function currentRestoreAction(html) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  const candidates = [];

  for (const form of forms) {
    const opening = form.match(/^<form\b[^>]*>/i)?.[0] ?? "";
    const action = attributeValue(opening, "action");

    if (
      !action ||
      !action.startsWith("/api/admin/content/publications/") ||
      !action.endsWith("/restore")
    ) {
      continue;
    }

    const buttons = form.match(/<button\b[^>]*>/gi) ?? [];
    const disabled = buttons.some((button) =>
      /\bdisabled(?:\s|=|>)/i.test(button)
    );

    if (disabled) candidates.push(action);
  }

  if (candidates.length !== 1) {
    throw new Error(
      `No se pudo identificar una única publicación actual (${candidates.length} candidatas).`
    );
  }

  return candidates[0];
}

async function mediaSnapshot(slug, cookie) {
  return parseJson(
    await request(
      `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`,
      { headers: { cookie } }
    ),
    `Biblioteca multimedia de ${slug}`
  );
}

async function postAdminForm(pathname, referer, cookie, fields, label) {
  const response = await request(pathname, {
    method: "POST",
    headers: formHeaders(referer, cookie),
    body: new URLSearchParams(fields).toString(),
  });

  return redirectLocation(response, label);
}

async function publicationPage(slug, cookie) {
  return requirePage(
    await request(
      `/admin/juegos/${encodeURIComponent(slug)}/publicacion`,
      { headers: { cookie } }
    ),
    `Publicación de ${slug}`
  ).body;
}

const suffix = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
const slug = `visual-lifecycle-${suffix}`.slice(0, 160);
const initialTitle = `Lifecycle privado ${suffix}`;
const markerA = `Lifecycle publicado A ${suffix}`;
const markerB = `Lifecycle borrador B ${suffix}`;
const updateVersion = `2.0.0-e2e-${suffix}`.slice(0, 80);
const updateSummary = `Actualización sintética E2E ${suffix}`;
const editorPath = `/admin/juegos/${encodeURIComponent(slug)}`;
const publicPath = `/juegos/${encodeURIComponent(slug)}`;

const loginResponse = await request(
  "/api/admin/auth/login",
  {
    method: "POST",
    headers: formHeaders("/admin/login"),
    body: new URLSearchParams({
      username: adminUsername,
      password: adminPassword,
    }).toString(),
  }
);
const loginRedirect = redirectLocation(
  loginResponse,
  "El login HTTP del lifecycle de juego"
);
if (loginRedirect.pathname !== "/admin") {
  throw new Error(
    `El login terminó en ${loginRedirect.pathname}; se esperaba /admin.`
  );
}
const cookie = sessionCookie(loginResponse.headers["set-cookie"]);

const newGamePage = requirePage(
  await request("/admin/juegos/nuevo", { headers: { cookie } }),
  "Alta de juego"
).body;
const categories = selectOptionValues(newGamePage, "category");
if (categories.length === 0) {
  throw new Error(
    "El alta de juego no expone ninguna clasificación editorial disponible."
  );
}
const category = categories[0];

const fixtureMedia = await mediaSnapshot(representativeGameSlug, cookie);
const fixtureCandidates = [
  fixtureMedia.assignments?.coverImage,
  fixtureMedia.assignments?.heroImage,
  fixtureMedia.assignments?.cardImage,
  fixtureMedia.assignments?.detailImage,
  ...(Array.isArray(fixtureMedia.assignments?.screenshots)
    ? fixtureMedia.assignments.screenshots
    : []),
  ...(Array.isArray(fixtureMedia.resources)
    ? fixtureMedia.resources.map((resource) => resource?.src)
    : []),
].filter(
  (value) =>
    typeof value === "string" &&
    value.startsWith("/images/")
);
const sourceImage = [...new Set(fixtureCandidates)][0];
if (!sourceImage) {
  throw new Error(
    `El fixture ${representativeGameSlug} no expone una imagen bundled reutilizable para el lifecycle.`
  );
}

const createRedirect = await postAdminForm(
  "/api/admin/content/games",
  "/admin/juegos/nuevo",
  cookie,
  {
    slug,
    title: initialTitle,
    description:
      "Borrador sintético aislado para verificar el contrato editorial completo de un juego.",
    category,
    version: "1.0.0-e2e",
    badge: "",
    imageAlt: `Arte sintético de ${initialTitle}`,
  },
  "La creación del juego sintético"
);
if (
  createRedirect.pathname !== editorPath ||
  createRedirect.searchParams.get("estado") !== "creado"
) {
  throw new Error(
    `El alta no terminó en estado=creado: ${createRedirect.href}.`
  );
}

requirePage(
  await request(publicPath),
  "Juego privado antes de publicar",
  404
);

let editorPage = requirePage(
  await request(`${editorPath}?seccion=ficha`, { headers: { cookie } }),
  "Editor del juego recién creado"
).body;
let revision = positiveInputNumber(editorPage, "expectedRevision");
const createdRevision = revision;

const informationRedirect = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/information`,
  `${editorPath}?seccion=ficha`,
  cookie,
  {
    expectedRevision: String(revision),
    title: markerA,
    description:
      "Primera revisión sintética preparada para demostrar que editar y publicar son operaciones separadas.",
    shortTitle: "",
    highlightedTitle: "",
    developer: "",
    publisher: "",
    releaseDate: "",
    version: "1.0.0-e2e",
    badge: "",
    imageAlt: `Arte sintético de ${markerA}`,
  },
  "El guardado de Información"
);
if (
  informationRedirect.pathname !== editorPath ||
  informationRedirect.searchParams.get("estado") !== "guardado" ||
  informationRedirect.searchParams.get("seccion") !== "ficha"
) {
  throw new Error(
    `Información no terminó en estado=guardado: ${informationRedirect.href}.`
  );
}

editorPage = requirePage(
  await request(`${editorPath}?seccion=ficha`, { headers: { cookie } }),
  "Editor después de guardar Información"
).body;
revision = positiveInputNumber(editorPage, "expectedRevision");
if (revision <= createdRevision) {
  throw new Error(
    `Guardar Información no avanzó revisión (${createdRevision} -> ${revision}).`
  );
}
if (singleInputValue(editorPage, "title") !== markerA) {
  throw new Error(
    "El título A no quedó persistido en el borrador del juego."
  );
}

const mediaRedirect = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/media`,
  `${editorPath}?seccion=multimedia`,
  cookie,
  {
    expectedRevision: String(revision),
    coverImage: sourceImage,
    heroImage: sourceImage,
    screenshotsText: sourceImage,
  },
  "La asignación multimedia base"
);
if (
  mediaRedirect.pathname !== editorPath ||
  mediaRedirect.searchParams.get("estado") !== "guardado"
) {
  throw new Error(
    `Multimedia base no terminó en estado=guardado: ${mediaRedirect.href}.`
  );
}

let media = await mediaSnapshot(slug, cookie);
revision = media.revision;
if (!Number.isInteger(revision) || revision <= 0) {
  throw new Error("La biblioteca multimedia no devolvió una revisión válida.");
}
const availableSource = Array.isArray(media.resources) &&
  media.resources.some(
    (resource) =>
      resource?.kind === "image" &&
      resource.src === sourceImage
  );
if (!availableSource) {
  throw new Error(
    "La imagen asignada no apareció en la Biblioteca multimedia del borrador."
  );
}

for (const target of ["card-image", "detail-image"]) {
  const assigned = await postAdminForm(
    `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`,
    `${editorPath}?seccion=multimedia`,
    cookie,
    {
      expectedRevision: String(revision),
      target,
      resource: sourceImage,
    },
    `La asignación ${target}`
  );
  if (assigned.searchParams.get("estado") !== "recurso-asignado") {
    throw new Error(
      `${target} no terminó en recurso-asignado: ${assigned.href}.`
    );
  }
  media = await mediaSnapshot(slug, cookie);
  revision = media.revision;
}

for (const target of ["cover", "hero", "card", "detail"]) {
  const modeRedirect = await postAdminForm(
    `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`,
    `${editorPath}?seccion=multimedia`,
    cookie,
    {
      expectedRevision: String(revision),
      target: `${target}-mode`,
      resource: "image",
    },
    `El modo Imagen de ${target}`
  );

  if (modeRedirect.searchParams.get("estado") !== "recurso-asignado") {
    throw new Error(
      `${target} no terminó en modo Imagen: ${modeRedirect.href}.`
    );
  }

  media = await mediaSnapshot(slug, cookie);
  revision = media.revision;
  const modeKey = `${target}Mode`;

  if (media.assignments?.[modeKey] !== "image") {
    throw new Error(
      `${target} no persistió el modo Imagen en Biblioteca multimedia.`
    );
  }
}

async function confirmCrop(target, aspect, resource) {
  const fields = {
    expectedRevision: String(revision),
    target,
    viewportX: "0.5",
    viewportY: "0.5",
    viewportZoom: "1",
    ...(aspect !== null ? { viewportAspect: aspect } : {}),
    ...(target === "gallery"
      ? {
          resource,
          viewportAspectRatio: "",
        }
      : {}),
  };
  const redirect = await postAdminForm(
    `/api/admin/content/games/${encodeURIComponent(slug)}/image-layout`,
    `${editorPath}?seccion=multimedia`,
    cookie,
    fields,
    `La confirmación de crop ${target}`
  );

  if (
    redirect.searchParams.get("estado") !==
    "imagen-encuadre-guardado"
  ) {
    throw new Error(
      `${target} no confirmó su encuadre: ${redirect.href}.`
    );
  }

  media = await mediaSnapshot(slug, cookie);
  revision = media.revision;
}

await confirmCrop("cover", "4:5");
await confirmCrop("hero", "3:1");
await confirmCrop("card", "3:2");
await confirmCrop("detail", null);
await confirmCrop("gallery", "16:9", sourceImage);

media = await mediaSnapshot(slug, cookie);
revision = media.revision;
if (media.requirements?.ready !== true) {
  throw new Error(
    `El juego sintético no quedó listo en Multimedia: ${JSON.stringify(media.requirements)}.`
  );
}

const previewA = requirePage(
  await request(
    `${editorPath}/vista-previa`,
    { headers: { cookie } }
  ),
  "Vista previa A"
);
if (!visibleText(previewA.body).includes(markerA)) {
  throw new Error(
    "La vista previa no renderizó el título A desde el borrador real."
  );
}
requirePage(
  await request(publicPath),
  "Juego todavía privado después del preview",
  404
);

let publicationHtml = await publicationPage(slug, cookie);
const publishRevisionA = positiveInputNumber(
  publicationHtml,
  "expectedRevision"
);
if (publishRevisionA !== revision) {
  throw new Error(
    `Publicación ve revisión ${publishRevisionA}, pero Multimedia terminó en ${revision}.`
  );
}
const publicationBeforeFirst = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);

const firstPublish = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/publish`,
  `${editorPath}/publicacion`,
  cookie,
  { expectedRevision: String(revision) },
  "La primera publicación"
);
if (firstPublish.searchParams.get("estado") !== "publicado") {
  throw new Error(
    `La primera publicación no terminó en publicado: ${firstPublish.href}.`
  );
}

publicationHtml = await publicationPage(slug, cookie);
const publicationA = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);
if (publicationA <= publicationBeforeFirst) {
  throw new Error(
    `La primera publicación no avanzó (${publicationBeforeFirst} -> ${publicationA}).`
  );
}
const restorePublicationA = currentRestoreAction(publicationHtml);

const publicA = requirePage(
  await request(publicPath),
  "Juego público A"
);
if (!firstH1(publicA.body).includes(markerA)) {
  throw new Error(
    `La web pública no mostró el snapshot A. H1=${JSON.stringify(firstH1(publicA.body))}.`
  );
}

editorPage = requirePage(
  await request(`${editorPath}?seccion=ficha`, { headers: { cookie } }),
  "Editor antes del borrador B"
).body;
revision = positiveInputNumber(editorPage, "expectedRevision");
const revisionA = revision;

const informationB = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/information`,
  `${editorPath}?seccion=ficha`,
  cookie,
  {
    expectedRevision: String(revision),
    title: markerB,
    description:
      "Segunda revisión sintética. Debe permanecer privada hasta una nueva publicación explícita.",
    shortTitle: "",
    highlightedTitle: "",
    developer: "",
    publisher: "",
    releaseDate: "",
    version: "1.0.0-e2e",
    badge: "",
    imageAlt: `Arte sintético de ${markerB}`,
  },
  "El guardado del borrador B"
);
if (informationB.searchParams.get("estado") !== "guardado") {
  throw new Error(
    `El borrador B no terminó en guardado: ${informationB.href}.`
  );
}

editorPage = requirePage(
  await request(`${editorPath}?seccion=ficha`, { headers: { cookie } }),
  "Editor después del borrador B"
).body;
revision = positiveInputNumber(editorPage, "expectedRevision");
if (revision <= revisionA) {
  throw new Error(
    `El borrador B no avanzó revisión (${revisionA} -> ${revision}).`
  );
}
const revisionB = revision;

const previewB = requirePage(
  await request(`${editorPath}/vista-previa`, { headers: { cookie } }),
  "Vista previa B"
);
if (!visibleText(previewB.body).includes(markerB)) {
  throw new Error(
    "La vista previa no reflejó el borrador B."
  );
}

const publicStillA = requirePage(
  await request(publicPath),
  "Web pública mientras B sigue en borrador"
);
const publicStillAH1 = firstH1(publicStillA.body);
if (
  !publicStillAH1.includes(markerA) ||
  publicStillAH1.includes(markerB)
) {
  throw new Error(
    `Guardar B filtró el borrador a la web pública: ${JSON.stringify(publicStillAH1)}.`
  );
}

const secondPublish = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/publish`,
  `${editorPath}/publicacion`,
  cookie,
  { expectedRevision: String(revisionB) },
  "La publicación del snapshot B"
);
if (secondPublish.searchParams.get("estado") !== "publicado") {
  throw new Error(
    `La publicación B no terminó en publicado: ${secondPublish.href}.`
  );
}

publicationHtml = await publicationPage(slug, cookie);
const publicationB = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);
if (publicationB <= publicationA) {
  throw new Error(
    `La publicación B no avanzó (${publicationA} -> ${publicationB}).`
  );
}

const publicB = requirePage(
  await request(publicPath),
  "Juego público B"
);
if (!firstH1(publicB.body).includes(markerB)) {
  throw new Error(
    "La web pública no reflejó el snapshot B."
  );
}

const restoreA = await postAdminForm(
  restorePublicationA,
  `${editorPath}/publicacion`,
  cookie,
  {
    expectedPublicationNumber: String(publicationB),
  },
  "La restauración del snapshot A"
);
if (
  restoreA.searchParams.get("estado") !==
  "publicacion-restaurada"
) {
  throw new Error(
    `Restaurar A no terminó en publicacion-restaurada: ${restoreA.href}.`
  );
}

publicationHtml = await publicationPage(slug, cookie);
const publicationRestoredA = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);
if (publicationRestoredA <= publicationB) {
  throw new Error(
    `Restaurar no creó una publicación nueva (${publicationB} -> ${publicationRestoredA}).`
  );
}

const publicRestoredA = requirePage(
  await request(publicPath),
  "Juego después de restaurar A"
);
if (!firstH1(publicRestoredA.body).includes(markerA)) {
  throw new Error(
    "Restaurar A no cambió el snapshot público al contenido histórico esperado."
  );
}

const previewAfterRestore = requirePage(
  await request(`${editorPath}/vista-previa`, { headers: { cookie } }),
  "Borrador después de restaurar A"
);
if (!visibleText(previewAfterRestore.body).includes(markerB)) {
  throw new Error(
    "Restaurar una publicación histórica reescribió o perdió el borrador B."
  );
}

publicationHtml = await publicationPage(slug, cookie);
const revisionAfterRestore = positiveInputNumber(
  publicationHtml,
  "expectedRevision"
);
if (revisionAfterRestore !== revisionB) {
  throw new Error(
    `Restaurar cambió la revisión del borrador (${revisionB} -> ${revisionAfterRestore}).`
  );
}

const republishB = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/publish`,
  `${editorPath}/publicacion`,
  cookie,
  { expectedRevision: String(revisionB) },
  "La republicación del borrador B"
);
if (republishB.searchParams.get("estado") !== "publicado") {
  throw new Error(
    `Republicar B no terminó en publicado: ${republishB.href}.`
  );
}

publicationHtml = await publicationPage(slug, cookie);
const publicationResyncedB = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);
if (publicationResyncedB <= publicationRestoredA) {
  throw new Error(
    `Republicar B no avanzó publicación (${publicationRestoredA} -> ${publicationResyncedB}).`
  );
}

const publicResyncedB = requirePage(
  await request(publicPath),
  "Juego B resincronizado"
);
if (!firstH1(publicResyncedB.body).includes(markerB)) {
  throw new Error(
    "Republicar el borrador B no resincronizó la web pública."
  );
}

const updateRedirect = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/publish-update`,
  `${editorPath}/actualizacion`,
  cookie,
  {
    expectedRevision: String(revisionB),
    version: updateVersion,
    type: "update",
    summary: updateSummary,
    featured: "false",
    sizeGb: "",
    fileCount: "",
    platform: "PC",
    channel: "",
    checksumSha256: "",
    sourcesJson: JSON.stringify([
      {
        id: "primary",
        name: "Descarga E2E",
        href: `${publicPath}/descargar`,
        label: "Fuente sintética aislada",
        enabled: true,
        status: "available",
      },
    ]),
  },
  "La actualización integrada"
);
if (
  updateRedirect.searchParams.get("estado") !==
  "actualizacion-publicada"
) {
  throw new Error(
    `La actualización integrada no terminó publicada: ${updateRedirect.href}.`
  );
}

publicationHtml = await publicationPage(slug, cookie);
const revisionAfterUpdate = positiveInputNumber(
  publicationHtml,
  "expectedRevision"
);
const publicationAfterUpdate = positiveInputNumber(
  publicationHtml,
  "expectedPublicationNumber"
);
if (
  revisionAfterUpdate <= revisionB ||
  publicationAfterUpdate <= publicationResyncedB
) {
  throw new Error(
    `La actualización integrada no avanzó revisión/publicación (${revisionB}/${publicationResyncedB} -> ${revisionAfterUpdate}/${publicationAfterUpdate}).`
  );
}

const publicUpdatedGame = requirePage(
  await request(publicPath),
  "Juego después de actualización integrada"
);
if (!visibleText(publicUpdatedGame.body).includes(updateVersion)) {
  throw new Error(
    "La ficha pública no reflejó la versión de la actualización integrada."
  );
}

const publicUpdates = requirePage(
  await request("/actualizaciones"),
  "Listado público de actualizaciones"
);
if (!visibleText(publicUpdates.body).includes(updateSummary)) {
  throw new Error(
    "La actualización integrada no apareció en la superficie pública de Actualizaciones."
  );
}

const hideRedirect = await postAdminForm(
  `/api/admin/content/games/${encodeURIComponent(slug)}/hide`,
  `${editorPath}/publicacion`,
  cookie,
  {
    expectedPublicationNumber: String(publicationAfterUpdate),
  },
  "El ocultamiento final del juego"
);
if (hideRedirect.searchParams.get("estado") !== "oculto") {
  throw new Error(
    `Ocultar el juego no terminó en oculto: ${hideRedirect.href}.`
  );
}

requirePage(
  await request(publicPath),
  "Juego oculto al final del lifecycle",
  404
);

const updatesAfterHide = requirePage(
  await request("/actualizaciones"),
  "Actualizaciones después de ocultar el juego"
);
if (visibleText(updatesAfterHide.body).includes(updateSummary)) {
  throw new Error(
    "Ocultar el juego dejó visible su actualización integrada en la web pública."
  );
}

console.log(
  `Game publication lifecycle smoke: OK (revisión ${createdRevision} -> ${revisionB} -> ${revisionAfterUpdate}; publicación ${publicationBeforeFirst} -> ${publicationA} -> ${publicationB} -> ${publicationRestoredA} -> ${publicationResyncedB} -> ${publicationAfterUpdate}; preview, snapshots, restauración, update integrada y ocultamiento verificados).`
);