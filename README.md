# DeUna Games — baseline técnico

Este repositorio contiene la aplicación activa de DeUna Games. El objetivo de esta base es mantener el producto fácil de revisar, reproducible y libre de snapshots, reparadores y artefactos históricos dentro del código versionado.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- CSS Modules + tokens globales
- lucide-react

## Requisitos

- Node.js 24 o superior, usado también por CI (`.node-version`)
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

## Panel administrativo privado

La primera etapa del panel se encuentra en `/admin` e incorpora:

- acceso restringido por Nginx a la subred privada de WireGuard;
- una única cuenta propietaria, creada desde una terminal del servidor;
- contraseña derivada con `scrypt`, sal aleatoria y comparación constante;
- sesiones opacas y revocables guardadas en PostgreSQL;
- cookie `HttpOnly`, `Secure`, `SameSite=Strict`, prioridad alta y vencimiento máximo configurable de 1 a 24 horas;
- bloqueo progresivo de intentos fallidos y rate limiting adicional en Nginx;
- rate limiting efímero en memoria, sin access log, error log persistente ni reenvío de IP a Next.js;
- edición en borrador de juegos, actualizaciones y configuración pública, con validación, control de concurrencia e historial recuperable;
- `noindex`, `noarchive` y `no-store` en todas las rutas administrativas;
- ausencia deliberada de IP, user-agent, ubicación, huellas de dispositivo y actividad de visitantes en la base administrativa.

`DEUNA_ADMIN_ORIGIN` fija el origen exacto aceptado por los formularios y redirects del panel. En producción debe ser el origen HTTPS real accesible mediante la VPN; no se deriva del encabezado `Host` de la solicitud.

El panel permanece deshabilitado cuando `DEUNA_ADMIN_ENABLED` no es exactamente `true`. El área editorial permite modificar borradores en PostgreSQL, pero no publica esos cambios: la web pública continúa leyendo los archivos versionados hasta que se implemente y audite una transición explícita. Cada guardado crea una revisión inmutable y una entrada mínima de auditoría administrativa; restaurar una versión genera otra revisión y no elimina el historial.

La instalación se realiza en este orden:

```powershell
Copy-Item .env.example .env.local
Copy-Item ops/postgresql/admin-migration.env.example .env.admin-migration.local
npm.cmd run db:migrate
npm.cmd run admin:import-content
npm.cmd run admin:create-owner
npm.cmd run admin:preflight
```

`admin:preflight` ejecuta dos comprobaciones de sólo lectura: una con el rol migrador y otra con el rol runtime. Antes de permitir el encendido verifica conexión local, roles sin privilegios globales, cierre de acceso para `PUBLIC`, permisos exactos por columna y secuencia, checksums de migraciones, una sola cuenta propietaria y las cantidades importadas. No imprime contraseñas ni altera registros.

Antes de habilitar el panel se debe adaptar y probar `ops/nginx/deuna-games.conf.example`, configurar `DEUNA_ADMIN_ORIGIN`, confirmar que `/admin` responde únicamente dentro de la VPN y que PostgreSQL escucha sólo en loopback o en una interfaz privada. Las instrucciones de roles y base están en `ops/postgresql/README.md`.

`ops/systemd/deuna-games.service.example` mantiene Next.js en `127.0.0.1`, carga el entorno runtime desde `/etc/deuna-games/runtime.env`, aplica aislamiento del proceso y bloquea conexiones de red fuera de loopback. Deben adaptarse el usuario y las rutas antes de instalarlo. El archivo de entorno debe ser propiedad de `root`, modo `0600`, y no debe contener las credenciales del migrador.

Las migraciones usan checksum y no admiten que un archivo SQL ya aplicado sea reescrito. `deuna_migrator` conserva la capacidad de modificar el esquema; el proceso web usa `deuna_runtime` con permisos mínimos. Sus credenciales están separadas: `.env.local` contiene únicamente el acceso runtime, mientras `.env.admin-migration.local` contiene el acceso privilegiado y no es cargado por Next.js.

Los scripts de migración, importación y creación del propietario no forman parte del runtime público `deploy/`. Se ejecutan desde una copia privada del repositorio en el VPS antes de sustituir el artefacto de la aplicación; así el proceso web no recibe herramientas ni credenciales de migración. Cuando no haya una operación pendiente, el archivo de migración puede retirarse del servidor y restaurarse desde el gestor privado de secretos.

### Servidor local seguro en WSL2

Para probar el panel en una computadora Windows se recomienda ejecutar Next.js y PostgreSQL directamente dentro de Ubuntu sobre WSL2. Docker no es necesario para este entorno: WSL2 ya aporta el límite Linux y PostgreSQL permanece escuchando únicamente en loopback.

Requisitos comprobados por el instalador:

- Node.js 24 o superior instalado dentro de Linux;
- PostgreSQL 18 o superior con `data_checksums=on`;
- PostgreSQL limitado a `localhost`;
- `systemd`, `sudo`, OpenSSL y Git disponibles;
- repositorio ubicado en el sistema de archivos Linux, no bajo `/mnt/c`.

Desde la raíz del repositorio ejecutar:

```bash
npm run local:setup
```

El instalador es repetible y realiza las siguientes acciones:

- desactiva la telemetría de Next.js;
- instala exactamente las dependencias fijadas en `package-lock.json`;
- genera contraseñas PostgreSQL aleatorias sin mostrarlas;
- guarda cada credencial únicamente en el archivo privado que la necesita, con modo `0600`;
- crea `deuna_migrator`, `deuna_runtime` y `deuna_games` con privilegios separados;
- aplica migraciones, importa el contenido y ejecuta los preflight;
- pide de forma interactiva el nombre y la contraseña de la única cuenta propietaria.

La contraseña propietaria no muestra letras, puntos ni asteriscos mientras se escribe. Debe tener entre 16 y 128 caracteres e incluir una letra, un número y un símbolo. No debe compartirse ni guardarse en el repositorio.

Al finalizar, iniciar el servidor limitado al equipo local:

```bash
npm run dev
```

La web queda en `http://localhost:3000` y el panel en `http://localhost:3000/admin`. No ejecutar `npm run lan` mientras `.env.local` tenga `DEUNA_ADMIN_ENABLED=true`, porque ese comando escucha en todas las interfaces. El modo HTTP y la habilitación directa del panel se reservan exclusivamente para desarrollo local; el despliegue real conserva `DEUNA_ADMIN_ENABLED=false` hasta completar VPN, Nginx y HTTPS.

La secuencia completa de instalación, prueba externa/interna y vuelta atrás está en `ops/deploy/README.md`. El archivo `ops/systemd/runtime.env.example` sirve sólo como plantilla sin secretos para `/etc/deuna-games/runtime.env`.

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
