export const siteConfig = {
  name: "DeUna Games",
  shortName: "DeUna Games",
  description:
    "Descubre juegos para PC, consulta requisitos, versiones, actualizaciones y encuentra juegos compatibles con tu equipo.",
  language: "es",
  themeColor: "#05060b",
  footerTagline: "Hecho para encontrar tu próximo juego.",
} as const;

const fallbackUrl = "http://localhost:3000";

function validateOriginOnly(
  url: URL
) {
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" &&
      url.pathname !== "")
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL debe contener sólo el origen del sitio (por ejemplo, https://example.com), sin credenciales, ruta, query ni fragmento."
    );
  }
}

function resolveSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) {
    return fallbackUrl;
  }

  let url: URL;

  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL debe ser una URL absoluta válida."
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL sólo admite http:// o https://."
    );
  }

  validateOriginOnly(url);

  return url.origin;
}

export const siteUrl =
  resolveSiteUrl();

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteUrl}/`).toString();
}
