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
  logoEditorStyles,
  logoUploadRoute,
  logoStorage,
  logoReader,
  safeSvg,
  publicMediaRoute,
  nextConfig,
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
  source("src/components/admin/SiteBrandLogoEditor.module.css"),
  source("src/app/api/admin/content/configuration/logo-upload/route.ts"),
  source("src/lib/media/taxonomy-icon-upload.ts"),
  source("src/lib/media/site-brand-logo.ts"),
  source("src/lib/media/safe-svg-icon.ts"),
  source("src/app/media/editorial/[slug]/[filename]/route.ts"),
  source("next.config.ts"),
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
    configRoute.includes("hasExactAdminFormFields") &&
    configRoute.includes('"logoAsset"') &&
    configRoute.includes('"logoColorMode"') &&
    configRoute.includes('"logoCustomColor"') &&
    configRoute.includes("readStoredSiteBrandLogo(input.logoAsset)"),
  "El formulario real debe transportar el contrato del logo y el servidor debe rechazar assets inexistentes o corruptos aunque el path tenga forma válida."
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

const canonicalLogoModeFields =
  logoEditor.match(/name="logoColorMode"/g) ?? [];

assert(
  canonicalLogoModeFields.length === 3 &&
    logoEditor.includes('type="radio"') &&
    logoEditor.includes('value="original"') &&
    logoEditor.includes('value="brand"') &&
    logoEditor.includes('value="custom"') &&
    !logoEditor.includes('name="logo-color-mode-ui"'),
  "El modo de color debe serializarse mediante un único grupo radio canónico logoColorMode con original/marca/personalizado; no puede agregar campos UI paralelos."
);

assert(
  logoEditor.includes("useEffect") &&
    logoEditor.includes('closest("form")') &&
    logoEditor.includes('form.addEventListener("submit", blockSubmit)') &&
    logoEditor.includes("control.disabled = true") &&
    logoEditor.includes("disabledBeforeUpload"),
  "Mientras el SVG se valida, el formulario de Identidad debe bloquear también submit por botón o Enter para no guardar el logo anterior por carrera."
);

assert(
  logoEditor.includes("hidden") &&
    logoEditor.includes('aria-label="Archivo SVG del logo"') &&
    logoEditor.includes("styles.radioTarget") &&
    logoEditor.includes("styles.radioInput") &&
    logoEditorStyles.includes(".editor .fileInput") &&
    logoEditorStyles.includes(".radioTarget") &&
    logoEditorStyles.includes(".radioTarget > .radioInput") &&
    logoEditorStyles.includes("width: 44px") &&
    logoEditorStyles.includes("height: 44px"),
  "El selector de archivo no debe participar del layout ni del árbol interactivo visible y los modos de color deben conservar targets reales de 44 px."
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
    safeSvg.includes("inspectSafeSiteBrandLogoSvg") &&
    safeSvg.includes("siteBrandAllowedElements") &&
    safeSvg.includes("forbiddenSiteBrandElements") &&
    safeSvg.includes("safeEmbeddedRaster") &&
    safeSvg.includes("styleSheetIsSafe"),
  "El logo debe guardarse saneado, estático, escalable con viewBox, por hash e inmutable; el contrato amplio de SVG no puede habilitar contenido activo o recursos externos."
);

assert(
  logoReader.includes("resolveEditorialMediaDiskPath") &&
    logoReader.includes("inspectSafeSiteBrandLogoSvg") &&
    logoReader.includes("inspection.digest !== expectedDigest") &&
    logoReader.includes("recolorSafeSiteBrandLogoSvg") &&
    logoReader.includes("stored.content"),
  "La lectura del logo debe revalidar archivo, symlink, límites, seguridad y correspondencia contenido↔hash antes de usarlo, conservando además la versión original para el modo multicolor."
);

assert(
  publicMediaRoute.includes("const isSiteLogoAsset = slug === SITE_BRAND_LOGO_SLUG") &&
    publicMediaRoute.includes("(isSiteLogoAsset && !isSvg)") &&
    publicMediaRoute.includes("inspectSafeSiteBrandLogoSvg") &&
    publicMediaRoute.includes('safe.digest !== filename.slice(0, -".svg".length)') &&
    publicMediaRoute.includes("Content-Security-Policy") &&
    publicMediaRoute.includes("img-src data:") &&
    publicMediaRoute.includes("style-src 'unsafe-inline'") &&
    publicMediaRoute.includes("sandbox"),
  "El namespace del logo sólo debe servir SVG revalidado, content-addressed y aislado con CSP compatible únicamente con estilos saneados y raster data embebido."
);

const globalSecurityHeadersIndex =
  nextConfig.indexOf('source: "/(.*)"');
const editorialMediaHeadersIndex =
  nextConfig.indexOf('source: "/media/editorial/:path*"');

assert(
  nextConfig.includes("editorialMediaContentSecurityPolicy") &&
    nextConfig.includes(
      '"default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; sandbox"'
    ) &&
    globalSecurityHeadersIndex >= 0 &&
    editorialMediaHeadersIndex > globalSecurityHeadersIndex,
  "La CSP aislada de multimedia editorial debe declararse después de la regla global y permitir sólo los recursos inline ya saneados del SVG."
);

assert(
  publicConfig.includes("logoColorMode: SiteLogoColorMode") &&
    publicConfig.includes("logoCustomColor: string") &&
    publicConfig.includes("...sourceFallback()") &&
    rootLayout.includes("resolveSiteLogoColor(config)") &&
    rootLayout.includes("readStoredSiteBrandLogo(config.logoAsset)") &&
    rootLayout.includes('data-site-logo={logoAsset ? "custom" : "default"}') &&
    rootLayout.includes('data-site-logo-color-mode={config.logoColorMode}') &&
    rootLayout.includes('"--site-logo-color"') &&
    rootLayout.includes('"--site-logo-image"'),
  "La web pública debe leer sólo el snapshot publicado, propagar el modo original/marca/personalizado y caer al símbolo fuente si el asset publicado falta o deja de ser válido."
);

assert(
  logoRenderer.includes("isSiteBrandLogoAsset") &&
    logoRenderer.includes("data-logo-override") &&
    logoRenderer.includes("data-logo-color-mode") &&
    logoStyles.includes("mask-image") &&
    logoStyles.includes("background-image") &&
    logoStyles.includes('data-site-logo-color-mode="original"') &&
    logoStyles.includes(':global(html[data-site-logo="custom"])'),
  "SiteLogoMark debe ser el renderer canónico web: modo original conserva el SVG multicolor y marca/personalizado reutilizan la máscara recoloreada."
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
    identityPreview.includes("colorMode={logoColorMode}") &&
    identityPreview.includes('logoColorMode === "original"') &&
    appearanceWorkspace.includes('name="logoAsset"') &&
    appearanceWorkspace.includes('name="logoColorMode"') &&
    appearanceWorkspace.includes('name="logoCustomColor"') &&
    appearanceWorkspace.includes("asset={logoAsset ?? null}") &&
    appearanceWorkspace.includes("colorMode={logoColorMode}"),
  "Preview de Identidad y Apariencia deben conservar, serializar y renderizar el mismo logo y modo de color del borrador."
);

const socialImageBindsDataUri =
  socialImage.includes("buildSiteBrandLogoDataUri") &&
  socialImage.includes("logoDataUri") &&
  (
    socialImage.includes("src={logoDataUri}") ||
    socialImage.includes("src: logoDataUri")
  );

assert(
  socialImage.includes("resolveSiteLogoColor(identity)") &&
    socialImage.includes('identity.logoColorMode === "original"') &&
    socialImageBindsDataUri &&
    !socialImage.includes("SiteLogoMark"),
  "Open Graph/Twitter deben usar el mismo asset publicado como data URI server-side, preservando el SVG original cuando corresponde y sin depender del CSS Module de la web."
);

if (failures.length > 0) {
  console.error("\nLogo global de marca: REGRESIÓN\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "Logo global de marca: OK (contrato editorial, SVG estático amplio y seguro, publicación, renderer web único y salida social coherente)."
  );
}
