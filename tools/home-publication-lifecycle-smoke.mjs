import https from "node:https";
import process from "node:process";

const baseUrl = new URL(
  process.env.DEUNA_VISUAL_BASE_URL ??
    "https://127.0.0.1:3443"
);
const adminUsername =
  process.env.DEUNA_VISUAL_ADMIN_USERNAME?.trim();
const adminPassword =
  process.env.DEUNA_VISUAL_ADMIN_PASSWORD;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

if (
  baseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname)
) {
  throw new Error(
    "El smoke del ciclo editorial de Inicio sólo puede ejecutarse contra el runtime HTTPS local aislado."
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
      `El smoke rechazó un destino fuera del origen visual: ${url.origin}.`
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
      "El login del smoke no devolvió una cookie de sesión."
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

function inputValues(html, name) {
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const matches = [];

  for (const input of inputs) {
    const nameMatch = input.match(/\bname="([^"]*)"/i);
    if (!nameMatch || decodeHtml(nameMatch[1]) !== name) {
      continue;
    }
    const valueMatch = input.match(/\bvalue="([^"]*)"/i);
    if (!valueMatch) {
      throw new Error(
        `El input ${name} existe pero no expone un value SSR.`
      );
    }
    matches.push(decodeHtml(valueMatch[1]));
  }

  if (matches.length === 0) {
    throw new Error(`No se encontró el input SSR ${name}.`);
  }
  return matches;
}

function singleValue(html, name) {
  const values = inputValues(html, name);
  const unique = [...new Set(values)];
  if (unique.length !== 1) {
    throw new Error(
      `${name} no tiene un único valor coherente (${unique.length} variantes).`
    );
  }
  return unique[0];
}

function positiveNumberInput(html, name) {
  const value = Number(singleValue(html, name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} no es válido: ${value}.`);
  }
  return value;
}

function redirectLocation(response, label) {
  if (response.status !== 303) {
    throw new Error(
      `${label} respondió ${response.status}; se esperaba 303.`
    );
  }
  const location = response.headers.location;
  if (!location) throw new Error(`${label} no devolvió Location.`);
  const url = new URL(location, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new Error(
      `${label} intentó redirigir fuera del origen visual: ${url.origin}.`
    );
  }
  return url;
}

function publicHeading(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) {
    throw new Error("La Home pública no expone un H1 verificable.");
  }
  return decodeHtml(
    match[1].replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function currentRestoreAction(html) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  const candidates = [];

  for (const form of forms) {
    const opening = form.match(/^<form\b[^>]*>/i)?.[0] ?? "";
    const actionMatch = opening.match(/\baction="([^"]+)"/i);
    if (!actionMatch) continue;

    const action = decodeHtml(actionMatch[1]);
    if (
      !action.startsWith(
        "/api/admin/content/home-publications/"
      ) ||
      !action.endsWith("/restore")
    ) {
      continue;
    }

    const buttonTags = form.match(/<button\b[^>]*>/gi) ?? [];
    const disabled = buttonTags.some((button) =>
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

const marker =
  `Visual publication lifecycle ${Date.now().toString(36)}-${process.pid}`;
const contentPath = "/admin/portada?seccion=contenido";
const publicationPath = "/admin/portada?seccion=publicacion";

const publicBefore = await request("/");
if (publicBefore.status !== 200) {
  throw new Error(
    `La Home pública respondió ${publicBefore.status} antes del ciclo editorial.`
  );
}
const publishedHeadingBefore = publicHeading(publicBefore.body);
if (publicBefore.body.includes(marker)) {
  throw new Error(
    "La marca efímera del ciclo editorial ya existía públicamente."
  );
}

const loginBody = new URLSearchParams({
  username: adminUsername,
  password: adminPassword,
}).toString();
const loginResponse = await request(
  "/api/admin/auth/login",
  {
    method: "POST",
    headers: formHeaders("/admin/login"),
    body: loginBody,
  }
);
const loginRedirect = redirectLocation(
  loginResponse,
  "El login HTTP del ciclo editorial"
);
if (loginRedirect.pathname !== "/admin") {
  throw new Error(
    `El login terminó en ${loginRedirect.pathname}, se esperaba /admin.`
  );
}
const cookie = sessionCookie(
  loginResponse.headers["set-cookie"]
);

const contentPage = await request(contentPath, {
  headers: { cookie },
});
if (contentPage.status !== 200) {
  throw new Error(
    `Resto de Inicio respondió ${contentPage.status} antes del ciclo editorial.`
  );
}

const revisionValues = inputValues(
  contentPage.body,
  "expectedRevision"
);
if (new Set(revisionValues).size !== 1) {
  throw new Error(
    "Curaduría y Presentación no comparten expectedRevision antes de publicar."
  );
}
const beforeRevision = Number(revisionValues[0]);
if (!Number.isInteger(beforeRevision) || beforeRevision <= 0) {
  throw new Error(
    `expectedRevision no es válida: ${revisionValues[0]}.`
  );
}

const curationJson = singleValue(
  contentPage.body,
  "curationJson"
);
const presentation = JSON.parse(
  singleValue(contentPage.body, "presentationJson")
);
if (
  !presentation?.copy?.hero ||
  typeof presentation.copy.hero.accessibleTitle !== "string"
) {
  throw new Error(
    "Presentación no expone copy.hero.accessibleTitle antes del ciclo editorial."
  );
}
presentation.copy.hero.accessibleTitle = marker;

const saveBody = new URLSearchParams({
  expectedRevision: String(beforeRevision),
  curationJson,
  presentationJson: JSON.stringify(presentation),
}).toString();
const saveResponse = await request(
  "/api/admin/content/home/content",
  {
    method: "POST",
    headers: formHeaders(contentPath, cookie),
    body: saveBody,
  }
);
const saveRedirect = redirectLocation(
  saveResponse,
  "El guardado previo a publicar"
);
if (
  saveRedirect.pathname !== "/admin/portada" ||
  saveRedirect.searchParams.get("seccion") !== "contenido" ||
  saveRedirect.searchParams.get("estado") !== "guardado"
) {
  throw new Error(
    `El guardado previo no terminó en estado=guardado: ${saveRedirect.href}.`
  );
}

const savedPage = await request(
  `${saveRedirect.pathname}${saveRedirect.search}`,
  { headers: { cookie } }
);
if (savedPage.status !== 200) {
  throw new Error(
    `El borrador previo a publicar no pudo releerse (${savedPage.status}).`
  );
}
const savedRevision = positiveNumberInput(
  savedPage.body,
  "expectedRevision"
);
const persistedPresentation = JSON.parse(
  singleValue(savedPage.body, "presentationJson")
);
if (savedRevision <= beforeRevision) {
  throw new Error(
    `El guardado previo no avanzó revisión (${beforeRevision} -> ${savedRevision}).`
  );
}
if (
  persistedPresentation?.copy?.hero?.accessibleTitle !== marker
) {
  throw new Error(
    "El título temporal no quedó persistido antes de publicar."
  );
}

const publicStillOld = await request("/");
if (
  publicStillOld.status !== 200 ||
  publicStillOld.body.includes(marker) ||
  publicHeading(publicStillOld.body) !== publishedHeadingBefore
) {
  throw new Error(
    "Guardar el borrador alteró la Home pública antes de publicar."
  );
}

const publicationBefore = await request(publicationPath, {
  headers: { cookie },
});
if (publicationBefore.status !== 200) {
  throw new Error(
    `Publicación respondió ${publicationBefore.status} antes de publicar.`
  );
}
const publishRevision = positiveNumberInput(
  publicationBefore.body,
  "expectedRevision"
);
if (publishRevision !== savedRevision) {
  throw new Error(
    `Publicación ve una revisión distinta del borrador (${publishRevision} != ${savedRevision}).`
  );
}
const publicationNumberBefore = positiveNumberInput(
  publicationBefore.body,
  "expectedPublicationNumber"
);
const previousRestoreAction = currentRestoreAction(
  publicationBefore.body
);

const publishBody = new URLSearchParams({
  expectedRevision: String(savedRevision),
}).toString();
const publishResponse = await request(
  "/api/admin/content/home/publish",
  {
    method: "POST",
    headers: formHeaders(publicationPath, cookie),
    body: publishBody,
  }
);
const publishRedirect = redirectLocation(
  publishResponse,
  "La publicación de Inicio"
);
if (
  publishRedirect.pathname !== "/admin/portada" ||
  publishRedirect.searchParams.get("seccion") !== "publicacion" ||
  publishRedirect.searchParams.get("estado") !== "publicado"
) {
  throw new Error(
    `Publicar no terminó en estado=publicado: ${publishRedirect.href}.`
  );
}

const publicationAfterPublish = await request(
  `${publishRedirect.pathname}${publishRedirect.search}`,
  { headers: { cookie } }
);
if (publicationAfterPublish.status !== 200) {
  throw new Error(
    `El estado posterior a publicar no pudo releerse (${publicationAfterPublish.status}).`
  );
}
const publicationNumberAfterPublish = positiveNumberInput(
  publicationAfterPublish.body,
  "expectedPublicationNumber"
);
if (publicationNumberAfterPublish <= publicationNumberBefore) {
  throw new Error(
    `Publicar no avanzó el número de publicación (${publicationNumberBefore} -> ${publicationNumberAfterPublish}).`
  );
}

const publicPublished = await request("/");
if (publicPublished.status !== 200) {
  throw new Error(
    `La Home pública respondió ${publicPublished.status} después de publicar.`
  );
}
if (publicHeading(publicPublished.body) !== marker) {
  throw new Error(
    "La Home pública no reflejó el snapshot recién publicado."
  );
}

const draftAfterPublish = await request(contentPath, {
  headers: { cookie },
});
if (draftAfterPublish.status !== 200) {
  throw new Error(
    `El borrador no pudo releerse después de publicar (${draftAfterPublish.status}).`
  );
}
if (
  positiveNumberInput(draftAfterPublish.body, "expectedRevision") !== savedRevision ||
  JSON.parse(singleValue(draftAfterPublish.body, "presentationJson"))?.copy?.hero?.accessibleTitle !== marker
) {
  throw new Error(
    "Publicar modificó inesperadamente la revisión o el contenido del borrador."
  );
}

const restoreBody = new URLSearchParams({
  expectedPublicationNumber: String(
    publicationNumberAfterPublish
  ),
}).toString();
const restoreResponse = await request(
  previousRestoreAction,
  {
    method: "POST",
    headers: formHeaders(publicationPath, cookie),
    body: restoreBody,
  }
);
const restoreRedirect = redirectLocation(
  restoreResponse,
  "La restauración de la publicación anterior"
);
if (
  restoreRedirect.pathname !== "/admin/portada" ||
  restoreRedirect.searchParams.get("seccion") !== "publicacion" ||
  restoreRedirect.searchParams.get("estado") !== "publicacion-restaurada"
) {
  throw new Error(
    `Restaurar no terminó en estado=publicacion-restaurada: ${restoreRedirect.href}.`
  );
}

const publicationAfterRestore = await request(
  `${restoreRedirect.pathname}${restoreRedirect.search}`,
  { headers: { cookie } }
);
if (publicationAfterRestore.status !== 200) {
  throw new Error(
    `El estado posterior a restaurar no pudo releerse (${publicationAfterRestore.status}).`
  );
}
const publicationNumberAfterRestore = positiveNumberInput(
  publicationAfterRestore.body,
  "expectedPublicationNumber"
);
if (publicationNumberAfterRestore <= publicationNumberAfterPublish) {
  throw new Error(
    `Restaurar no creó una publicación nueva (${publicationNumberAfterPublish} -> ${publicationNumberAfterRestore}).`
  );
}
if (!publicationAfterRestore.body.includes("Hay cambios listos para publicar.")) {
  throw new Error(
    "Tras restaurar el snapshot anterior, el Admin no marcó el borrador divergente como pendiente de publicar."
  );
}

const publicRestored = await request("/");
if (publicRestored.status !== 200) {
  throw new Error(
    `La Home pública respondió ${publicRestored.status} después de restaurar.`
  );
}
const restoredHeading = publicHeading(publicRestored.body);
if (
  publicRestored.body.includes(marker) ||
  restoredHeading !== publishedHeadingBefore
) {
  throw new Error(
    `La restauración no recuperó el snapshot público anterior (${restoredHeading}).`
  );
}

const draftAfterRestore = await request(contentPath, {
  headers: { cookie },
});
if (draftAfterRestore.status !== 200) {
  throw new Error(
    `El borrador no pudo releerse después de restaurar (${draftAfterRestore.status}).`
  );
}
const draftRevisionAfterRestore = positiveNumberInput(
  draftAfterRestore.body,
  "expectedRevision"
);
const draftPresentationAfterRestore = JSON.parse(
  singleValue(draftAfterRestore.body, "presentationJson")
);
if (
  draftRevisionAfterRestore !== savedRevision ||
  draftPresentationAfterRestore?.copy?.hero?.accessibleTitle !== marker
) {
  throw new Error(
    "Restaurar una publicación histórica reescribió el borrador, rompiendo la separación editorial."
  );
}

console.log(
  `Home publication lifecycle smoke: OK (revisión ${beforeRevision} -> ${savedRevision}; publicación ${publicationNumberBefore} -> ${publicationNumberAfterPublish} -> ${publicationNumberAfterRestore}; publicar y restaurar no reescriben el borrador).`
);
