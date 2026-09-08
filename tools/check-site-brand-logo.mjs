import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [
  sourceIdentity,
  validation,
  formSchema,
  configPage,
  configRoute,
  logoEditor,
  logoUploadRoute,
  logoStorage,
  logoReader,
  safeSvg,
  publicMediaRoute,
  publicConfig,
  rootLayout,
  logoRenderer,
  logoStyles,
  siteBrand,
  headerClient,
  footer,
  accountDashboard,
  adminShell,
  identityPreview,
  appearanceWorkspace,
  socialImage,
] = await Promise.all([
  source("src/lib/site.ts"),
  source("src/lib/admin/content-validation-core.ts"),
  source("src/lib/admin/frontend-content-forms.ts"),
  source("src/app/admin/(protected)/configuracion/page.tsx"),
  source("src/app/api/admin/content/configuration/route.ts"),
  source("src/components/admin/SiteBrandLogoEditor.tsx"),
  source("src/app/api/admin/content/configuration/logo-upload/route.ts"),
  source("src/lib/media/taxonomy-icon-upload.ts"),
  source("src/lib/media/site-brand-logo.ts"),
  source("src/lib/media/safe-svg-icon.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("src/lib/site/public-site-config.ts"),
  source("src/app/layout.tsx"),
  source("src/components/brand/SiteLogoMark.tsx"),
  source("src/components/brand/SiteLogoMark.module.css"),
  source("src/components/layout/SiteBrand.tsx"),
  source("src/components/layout/HeaderClientBase.tsx"),
  source("src/components/layout/Footer.tsx"),
  source("src/app/cuenta/AccountDashboardClient.tsx"),
  source("src/components/admin/AdminShell.tsx"),
  source("src/components/admin/SiteIdentityPreview.tsx"),
  source("src/components/admin/SiteAppearanceWorkspace.tsx"),
  source("src/lib/social-image.tsx"),
]);

assert(
  sourceIdentity.includes('logoColorMode: "brand"') &&
    sourceIdentity.includes('logoCustomColor: "#ff0847"'),
  "La identidad fuente debe conservar un fallback explícito: logo original siguiendo el color de marca."
);

assert(
  validation.includes("siteBrandLogoAssetPattern") &&
    validation.includes("logoAsset:") &&
    validation.includes("logoColorMode:") &&
    validation.includes("logoCustomColor:") &&
    validation.includes('config.logoColorMode === "custom"'),
  "site_config debe validar asset, modo de color y color personalizado dentro del contrato editorial versionado."
);

assert(
  formSchema.includes("logoAsset: z.string().trim().max(400)") &&
    formSchema.includes("logoAsset: logoAsset || undefined") &&
    formSchema.includes("logoColorMode: z.enum(siteLogoColorModes)") &&
    configRoute.includes('"logoAsset"') &&
    configRoute.includes('"logoColorMode"') &&
    configRoute.includes('"logoCustomColor"') &&
    configRoute.includes("readStoredSiteBrandLogo(input.logoAsset)"),
  "El formulario real debe transportar los tres campos y el servidor debe rechazar assets inexistentes o corruptos aunque el path tenga forma válida."
);

assert(
  configPage.includes("<SiteBrandLogoEditor") &&
    configPage.includes("initialAsset={config.logoAsset}") &&
    configPage.includes("initialColorMode={config.logoColorMode}") &&
    configPage.includes("logoColorMode={config.logoColorMode}") &&
    logoEditor.includes('name="logoAsset"') &&
    logoEditor.includes('name="logoColorMode"') &&
    logoEditor.includes('name="logoCustomColor"'),
  "Configuración → Identidad debe editar el logo dentro del mismo guardado editorial y Apariencia debe recibir su estado canónico."
);

assert(
  logoUploadRoute.includes("authorizeAdminMediaRequest") &&
    logoUploadRoute.includes("hasExactAdminMediaFormFields") &&
    logoUploadRoute.includes("expectedRevision") &&
    logoUploadRoute.includes("item.revision !== revision.data") &&
    logoUploadRoute.includes("storeSiteBrandLogo"),
  "La carga del logo debe exigir sesión Admin, formulario exacto y control optimista de revisión."
);

assert(
  logoStorage.includes("SITE_BRAND_LOGO_SLUG") &&
    logoStorage.includes("sanitizeTaxonomySvgIcon") &&
    logoStorage.includes("inspectSafeSiteBrandLogoSvg") &&
    logoStorage.includes('flag: "wx"') &&
    logoStorage.includes("storeSiteBrandLogo") &&
    safeSvg.includes("hasScalableViewBox") &&
    safeSvg.includes("inspectSafeSiteBrandLogoSvg"),
  "El logo debe guardarse saneado, escalable con viewBox, por hash e inmutable dentro del almacén editorial persistente."
);

assert(
  logoReader.includes("resolveEditorialMediaDiskPath") &&
    logoReader.includes("inspectSafeSiteBrandLogoSvg") &&
    logoReader.includes("inspection.digest !== expectedDigest") &&
    logoReader.includes("recolorSafeSiteBrandLogoSvg"),
  "La lectura del logo debe revalidar archivo, symlink, límites, seguridad y correspondencia contenido↔hash antes de usarlo."
);

assert(
  publicMediaRoute.includes("const isSiteLogoAsset = slug === SITE_BRAND_LOGO_SLUG") &&
    publicMediaRoute.includes("(isSiteLogoAsset && !isSvg)") &&
    publicMediaRoute.includes("inspectSafeSiteBrandLogoSvg") &&
    publicMediaRoute.includes('safe.digest !== filename.slice(0, -".svg".length)') &&
    publicMediaRoute.includes("Content-Security-Policy"),
  "El namespace del logo sólo debe servir SVG revalidado, content-addressed y aislado; no debe abrir SVG arbitrario en otras carpetas."
);

assert(
  publicConfig.includes("logoColorMode: SiteLogoColorMode") &&
    publicConfig.includes("logoCustomColor: string") &&
    publicConfig.includes("...sourceFallback()") &&
    rootLayout.includes("resolveSiteLogoColor(config)") &&
    rootLayout.includes("readStoredSiteBrandLogo(config.logoAsset)") &&
    rootLayout.includes('data-site-logo={logoAsset ? "custom" : "default"}') &&
    rootLayout.includes('"--site-logo-color"') &&
    rootLayout.includes('"--site-logo-image"'),
  "La web pública debe leer sólo el snapshot publicado y caer al símbolo original si el asset publicado falta o deja de ser válido."
);

assert(
  logoRenderer.includes("isSiteBrandLogoAsset") &&
    logoRenderer.includes("data-logo-override") &&
    logoStyles.includes("mask-image") &&
    logoStyles.includes(':global(html[data-site-logo="custom"])'),
  "SiteLogoMark debe ser el renderer canónico web, validar overrides y recolorear el SVG sin duplicar lógica por superficie."
);

assert(
  siteBrand.includes("<SiteLogoMark") &&
    headerClient.includes("<SiteBrand") &&
    footer.includes("<SiteLogoMark") &&
    accountDashboard.includes("<SiteBrand") &&
    adminShell.includes("<SiteLogoMark"),
  "Header, Footer, Mi DeUna y Admin deben converger en SiteBrand/SiteLogoMark en lugar de mantener logos independientes."
);

assert(
  identityPreview.includes("asset={logoAsset ?? null}") &&
    identityPreview.includes("resolveSiteLogoColor") &&
    appearanceWorkspace.includes('name="logoAsset"') &&
    appearanceWorkspace.includes('name="logoColorMode"') &&
    appearanceWorkspace.includes('name="logoCustomColor"') &&
    appearanceWorkspace.includes("asset={logoAsset ?? null}"),
  "Preview de Identidad y guardado de Apariencia deben conservar y mostrar el mismo logo del borrador."
);

assert(
  socialImage.includes("resolveSiteLogoColor(identity)") &&
    socialImage.includes("buildSiteBrandLogoDataUri") &&
    socialImage.includes("<img") &&
    !socialImage.includes("SiteLogoMark"),
  "Open Graph/Twitter deben renderizar el mismo asset publicado como data URI server-side y no depender del CSS Module/mask-image de la web."
);

if (failures.length > 0) {
  console.error("\nLogo global de marca: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Logo global de marca: OK (contrato editorial, upload seguro, publicación, renderer único web y salida social segura)."
  );
}
