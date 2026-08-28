# DeUna Games — baseline técnico

Este repositorio contiene la aplicación activa de DeUna Games. El objetivo de esta base es mantener el producto fácil de revisar, reproducible y libre de snapshots, reparadores y artefactos históricos dentro del código versionado.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- CSS Modules + tokens globales
- lucide-react

## Requisitos

- Node.js 20.9 o superior
- Node.js 24 recomendado y usado por CI (`.node-version`)
- npm

## Desarrollo

```powershell
npm.cmd ci
npm.cmd run dev
```

Para probar desde otro dispositivo en la red local:

```powershell
npm.cmd run mobile
```

## Verificación

Antes de integrar cambios:

```powershell
npm.cmd run check
npm.cmd run audit:deps
npm.cmd run security:scan
```

`npm run check` ejecuta lint, TypeScript, higiene del código fuente, privacidad pública, encoding UTF-8, integridad de datos, assets, rutas, variables CSS, CSS Modules, build de producción y smoke test sobre el runtime standalone construido. CI repite estas verificaciones, suma el security scan y audita dependencias en cada Pull Request hacia `master`.

### Privacidad pública

```powershell
npm.cmd run check:privacy
```

Bloquea referencias geográficas explícitas, locales regionales, timestamps con offsets de zona, rutas personales, correos personales comunes, campos estructurados de ubicación, trackers externos conocidos y formas lingüísticas regionales configuradas para el contenido público. El sitio usa `es` neutral y UTC para evitar publicar una región técnica de origen.

### Datos del catálogo

```powershell
npm.cmd run check:data
```

Valida la consistencia estructural de `games.ts` y `updates.ts`: campos obligatorios, IDs y slugs únicos, ratings dentro de rango, formato de reseñas, fechas válidas, destinos de descarga permitidos, referencias entre juegos y actualizaciones y coincidencia entre `game.version` y la actualización más reciente de cada juego.

Este control verifica consistencia interna, no la procedencia editorial de ratings, reseñas, fechas o descripciones. Esos datos deben tener una fuente o metodología definida antes de publicarse como información real.

### Assets

```powershell
npm.cmd run check:assets
```

El chequeo es bidireccional: falla si el código referencia una imagen inexistente, si `public/images` contiene una imagen sin referencia directa en `src/`, si una firma/estructura binaria no es válida o si una imagen pública conserva metadata no permitida. WebP rechaza EXIF/XMP; PNG rechaza chunks EXIF/textuales/fecha; JPEG rechaza EXIF/XMP, IPTC/Photoshop y comentarios; GIF rechaza comentarios; AVIF se revisa por metadata EXIF/XMP embebida y SVG por metadata de editores/RDF.

### Rutas internas

```powershell
npm.cmd run check:routes
```

Compara enlaces, acciones, redirects y navegaciones internas detectables contra las páginas reales de App Router, incluyendo rutas dinámicas como `/juegos/[slug]`.

### Variables CSS

```powershell
npm.cmd run check:css-vars
```

Falla ante tokens CSS usados sin definición o variables autorreferenciadas. También reconoce custom properties que React inyecta de forma intencional en runtime.

### CSS Modules

```powershell
npm.cmd run check:css-modules
```

Comprueba la relación entre clases declaradas y clases usadas en componentes para evitar estilos huérfanos o referencias inexistentes en los módulos que pueden analizarse estáticamente.

### Smoke del runtime

Después de `npm run build` se puede ejecutar:

```powershell
npm.cmd run smoke
```

Levanta temporalmente `.next/standalone/server.js` en loopback y comprueba el comportamiento HTTP del build real: Home 200 y canonical correcto, `lang="es"` neutral, ausencia de huellas regionales conocidas en HTML, filtros de `/juegos` con canonical estable + `noindex`, ficha de juego 200 con canonical propio, fallback seguro de descarga, 404 real sin canonical heredado, `robots.txt`, `sitemap.xml`, ausencia de `X-Powered-By` y headers de seguridad/privacidad esenciales. El proceso se apaga automáticamente al terminar.

### Seguridad

```powershell
npm.cmd run security:scan
```

El auditor es Node y funciona de forma equivalente en Windows y CI. Busca archivos sensibles o históricos trackeados, posibles secretos hardcodeados, rutas personales en código público, archivos riesgosos dentro de `public/` y cadenas sensibles. También ejecuta la auditoría de dependencias de producción salvo que se invoque internamente con `--skip-npm-audit`.

Para retirar EXIF/XMP de los WebP sin recomprimirlos y normalizar sus flags `VP8X`:

```powershell
npm.cmd run images:strip-metadata
```

### ESLint

El proyecto mantiene ESLint 9 mientras la cadena estable de plugins incluida por `eslint-config-next` no tenga soporte completo y sin conflictos para ESLint 10. No usar `--force`, overrides de peers ni paquetes canary sólo para eliminar el aviso de fin de soporte: la actualización debe hacerse cuando el grafo estable sea compatible y `npm ci` + lint + CI pasen sin excepciones.

## Variables de entorno

Copiar `.env.example` a `.env.local` cuando haga falta configurar el entorno. Nunca versionar `.env.local` ni secretos.

`NEXT_PUBLIC_SITE_URL` es una URL pública usada para metadata, sitemap y URLs absolutas. Debe contener sólo el origen del sitio, sin credenciales, ruta, query ni fragmento. En producción debe configurarse con el dominio HTTPS real.

## Build seguro de deploy

`build:secure` genera el artefacto desde un staging neutral y usa la misma cadena de build + smoke que CI. Antes de ejecutarlo debe existir un `NEXT_PUBLIC_SITE_URL` HTTPS público real; el comando rechaza localhost, loopback, `.invalid`, `.test`, `.example`, `.localhost` y los hosts reservados `example.com`, `example.net` y `example.org` para evitar publicar canonicals de prueba.

En PowerShell, reemplaza el marcador por el origen HTTPS real antes de ejecutar:

```powershell
$env:NEXT_PUBLIC_SITE_URL="https://<TU-DOMINIO-HTTPS-REAL>"
npm.cmd run build:secure
```

El resultado final queda en:

```text
deploy/
```

Subir únicamente el contenido de `deploy/`. El proceso vuelve a auditar datos, código, privacidad, runtime construido y artefacto final, y falla si detecta inconsistencias del catálogo, errores de runtime/SEO/headers, archivos prohibidos, secretos conocidos, rutas locales reales o huellas geográficas configuradas.

## Estructura

```text
src/app/          rutas y metadata de Next.js
src/components/   componentes visuales y funcionales
src/data/         catálogo y datos de contenido
src/lib/          lógica reutilizable
src/theme/        Theme System V2
src/types/        tipos compartidos
public/           assets públicos
ops/              ejemplos de infraestructura/deploy
tools/            herramientas mantenidas de build, seguridad e integridad
```

## Convenciones

- `src/theme/deuna-theme.css` es la fuente activa de la paleta visual.
- `UniversalGameCard` concentra las variantes de tarjetas de juegos.
- No guardar paquetes de auditoría, snapshots, ZIPs, backups ni scripts de reparación consumidos dentro del repositorio.
- Las páginas con filtros/query deben mantener una URL canónica estable y evitar indexar combinaciones arbitrarias.
- No agregar enlaces internos a rutas inexistentes ni assets públicos sin referencia real.
- Una actualización sólo puede aparecer como descargable si el juego tiene un destino de descarga real y validado.
- Los ratings, reseñas, fechas y demás métricas editoriales deben tener una fuente o metodología definida antes de tratarse como datos públicos reales.
- Los cambios estructurales deben pasar por una rama/PR y mantener CI verde antes de llegar a `master`.
