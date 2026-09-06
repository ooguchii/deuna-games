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
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

if (
  baseUrl.protocol !== "https:" ||
  !["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname)
) {
  throw new Error(
    "El smoke de guardado grande sólo puede ejecutarse contra el runtime HTTPS local aislado."
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
  const headers = {
    ...(options.headers ?? {}),
  };

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
    throw new Error(
      `No se encontró el input SSR ${name} en Resto de Inicio.`
    );
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

const loginPage = await request("/admin/login");
if (loginPage.status !== 200) {
  throw new Error(
    `El login del Admin respondió ${loginPage.status} antes del smoke de guardado.`
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

if (loginResponse.status !== 303) {
  throw new Error(
    `El login HTTP del smoke respondió ${loginResponse.status}, se esperaba 303.`
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
    `Resto de Inicio respondió ${contentPage.status} después del login HTTP.`
  );
}

const revisionValues = inputValues(
  contentPage.body,
  "expectedRevision"
);
const revisionSet = new Set(revisionValues);
if (revisionSet.size !== 1) {
  throw new Error(
    "Curaduría y Presentación no comparten la misma expectedRevision en SSR."
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
const presentationJson = singleValue(
  contentPage.body,
  "presentationJson"
);
const paddingLength = Math.max(
  0,
  TARGET_PRESENTATION_JSON_CHARS - presentationJson.length
);
const paddedPresentationJson =
  `${presentationJson}${" ".repeat(paddingLength)}`;

if (paddedPresentationJson.length > 24_000) {
  throw new Error(
    `La presentación SSR ya supera el contrato de 24.000 caracteres (${paddedPresentationJson.length}).`
  );
}

const largeBody = new URLSearchParams({
  expectedRevision: String(beforeRevision),
  curationJson,
  presentationJson: paddedPresentationJson,
}).toString();
const requestBytes = Buffer.byteLength(
  largeBody,
  "utf8"
);

if (requestBytes <= LEGACY_ADMIN_FORM_LIMIT_BYTES) {
  throw new Error(
    `El smoke no logró superar el límite histórico de 8 KiB (${requestBytes} bytes).`
  );
}

const saveResponse = await request(
  "/api/admin/content/home/content",
  {
    method: "POST",
    headers: formHeaders(contentPath, cookie),
    body: largeBody,
  }
);

if (saveResponse.status !== 303) {
  throw new Error(
    `El guardado grande respondió ${saveResponse.status}; se esperaba 303.`
  );
}

const location = saveResponse.headers.location;
if (!location) {
  throw new Error(
    "El guardado grande no devolvió Location."
  );
}
const redirectUrl = new URL(location, baseUrl);
if (
  redirectUrl.origin !== baseUrl.origin ||
  redirectUrl.pathname !== "/admin/portada" ||
  redirectUrl.searchParams.get("seccion") !== "contenido" ||
  redirectUrl.searchParams.get("estado") !== "guardado"
) {
  throw new Error(
    `El guardado grande no terminó en estado=guardado: ${redirectUrl.href}.`
  );
}

const refreshedPage = await request(
  `${redirectUrl.pathname}${redirectUrl.search}`,
  { headers: { cookie } }
);
if (refreshedPage.status !== 200) {
  throw new Error(
    `La revisión guardada no pudo releerse (${refreshedPage.status}).`
  );
}

const afterRevision = Number(
  singleValue(refreshedPage.body, "expectedRevision")
);
if (
  !Number.isInteger(afterRevision) ||
  afterRevision <= beforeRevision
) {
  throw new Error(
    `El POST grande no avanzó la revisión (${beforeRevision} -> ${afterRevision}).`
  );
}

console.log(
  `Home large-save smoke: OK (${requestBytes} bytes, revisión ${beforeRevision} -> ${afterRevision}, sólo borrador).`
);
