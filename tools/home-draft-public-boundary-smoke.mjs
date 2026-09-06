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

const LEGACY_ADMIN_FORM_LIMIT_BYTES = 8 * 1024;
const TARGET_PRESENTATION_JSON_CHARS = 12_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

if (
  baseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname)
) {
  throw new Error(
    "El smoke de frontera borrador/público sólo puede ejecutarse contra el runtime HTTPS local aislado."
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

function decodeHtmlAttribute(value) {
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
    if (!nameMatch || decodeHtmlAttribute(nameMatch[1]) !== name) {
      continue;
    }
    const valueMatch = input.match(/\bvalue="([^"]*)"/i);
    if (!valueMatch) {
      throw new Error(
        `El input ${name} existe pero no expone un value SSR.`
      );
    }
    matches.push(decodeHtmlAttribute(valueMatch[1]));
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

const marker =
  `Visual draft boundary ${Date.now().toString(36)}-${process.pid}`;
const publicBefore = await request("/");
if (publicBefore.status !== 200) {
  throw new Error(
    `La Home pública respondió ${publicBefore.status} antes del smoke.`
  );
}
if (publicBefore.body.includes(marker)) {
  throw new Error(
    "La marca efímera ya existía en la Home pública antes del guardado."
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
  "El login HTTP del smoke de frontera"
);
if (loginRedirect.pathname !== "/admin") {
  throw new Error(
    `El login terminó en ${loginRedirect.pathname}, se esperaba /admin.`
  );
}
const cookie = sessionCookie(
  loginResponse.headers["set-cookie"]
);

const contentPath = "/admin/portada?seccion=contenido";
const contentPage = await request(contentPath, {
  headers: { cookie },
});
if (contentPage.status !== 200) {
  throw new Error(
    `Resto de Inicio respondió ${contentPage.status}.`
  );
}

const revisionValues = inputValues(
  contentPage.body,
  "expectedRevision"
);
if (new Set(revisionValues).size !== 1) {
  throw new Error(
    "Curaduría y Presentación no comparten expectedRevision."
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
    "Presentación no expone copy.hero.accessibleTitle en el SSR del Admin."
  );
}
presentation.copy.hero.accessibleTitle = marker;

const semanticPresentationJson = JSON.stringify(presentation);
const paddingLength = Math.max(
  0,
  TARGET_PRESENTATION_JSON_CHARS - semanticPresentationJson.length
);
const paddedPresentationJson =
  `${semanticPresentationJson}${" ".repeat(paddingLength)}`;
if (paddedPresentationJson.length > 24_000) {
  throw new Error(
    `La presentación de prueba supera 24.000 caracteres (${paddedPresentationJson.length}).`
  );
}

const body = new URLSearchParams({
  expectedRevision: String(beforeRevision),
  curationJson,
  presentationJson: paddedPresentationJson,
}).toString();
const requestBytes = Buffer.byteLength(body, "utf8");
if (requestBytes <= LEGACY_ADMIN_FORM_LIMIT_BYTES) {
  throw new Error(
    `La prueba semántica no superó 8 KiB (${requestBytes} bytes).`
  );
}

const saveResponse = await request(
  "/api/admin/content/home/content",
  {
    method: "POST",
    headers: formHeaders(contentPath, cookie),
    body,
  }
);
const redirect = redirectLocation(
  saveResponse,
  "El guardado semántico grande de Inicio"
);
if (
  redirect.pathname !== "/admin/portada" ||
  redirect.searchParams.get("seccion") !== "contenido" ||
  redirect.searchParams.get("estado") !== "guardado"
) {
  throw new Error(
    `El guardado semántico no terminó en estado=guardado: ${redirect.href}.`
  );
}

const refreshedPage = await request(
  `${redirect.pathname}${redirect.search}`,
  { headers: { cookie } }
);
if (refreshedPage.status !== 200) {
  throw new Error(
    `El borrador semántico no pudo releerse (${refreshedPage.status}).`
  );
}
const afterRevision = Number(
  singleValue(refreshedPage.body, "expectedRevision")
);
const persistedPresentation = JSON.parse(
  singleValue(refreshedPage.body, "presentationJson")
);
if (
  !Number.isInteger(afterRevision) ||
  afterRevision <= beforeRevision
) {
  throw new Error(
    `El guardado semántico no avanzó revisión (${beforeRevision} -> ${afterRevision}).`
  );
}
if (
  persistedPresentation?.copy?.hero?.accessibleTitle !== marker
) {
  throw new Error(
    "El título temporal no quedó persistido en el borrador de Inicio."
  );
}

const publicAfter = await request("/");
if (publicAfter.status !== 200) {
  throw new Error(
    `La Home pública respondió ${publicAfter.status} después del guardado.`
  );
}
if (publicAfter.body.includes(marker)) {
  throw new Error(
    "La Home pública filtró contenido del borrador sin publicación explícita."
  );
}

console.log(
  `Home draft/public boundary smoke: OK (${requestBytes} bytes, revisión ${beforeRevision} -> ${afterRevision}, cambio real persistido sólo en borrador).`
);
