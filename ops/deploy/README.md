# Despliegue privado y reversible en VPS

Esta guía prepara el panel sin exponerlo durante la instalación. Está pensada para Debian 12 o Ubuntu 24.04 con Nginx, PostgreSQL y WireGuard en el mismo VPS. Antes de ejecutar comandos reales hay que adaptar dominio, usuario SSH, subred VPN, certificados y rutas.

No publiques contraseñas, claves privadas, archivos `.env`, dumps ni capturas que las muestren. Las dos contraseñas de PostgreSQL y la contraseña propietaria se crean directamente en una terminal privada del VPS; no deben enviarse por chat ni guardarse en Git.

## Orden seguro

1. Mantener `DEUNA_ADMIN_ENABLED=false`.
2. Confirmar que el VPS tiene acceso SSH seguro y actualizaciones instaladas.
3. Instalar PostgreSQL, Nginx, Node.js 24, WireGuard y FFmpeg desde fuentes confiables.
4. Crear los roles y la base PostgreSQL sólo en loopback.
5. Aplicar migraciones, importar contenido y crear la única cuenta propietaria.
6. Preparar el estado multimedia persistente y ejecutar los preflight.
7. Instalar una release nueva sin eliminar la release anterior.
8. Probar Next.js en `127.0.0.1:3000` y después Nginx con HTTPS.
9. Confirmar desde fuera de la VPN que `/admin` y `/api/admin/` responden `403`.
10. Confirmar desde la VPN que `/admin` abre el inicio de sesión.
11. Cambiar `DEUNA_ADMIN_ENABLED=true`, reiniciar y repetir ambas pruebas.

El panel no se habilita antes del paso 11. Si una verificación falla, se mantiene cerrado.

FFmpeg sólo se usa al cargar o reemplazar un preview de tarjeta desde el panel. La navegación pública y la reproducción de los WebM ya generados no dependen de FFmpeg.

## 1. Estructura del servidor

Usar una cuenta de servicio sin login interactivo, releases separadas y estado persistente fuera de las releases:

```text
/srv/deuna-games/
  current -> /srv/deuna-games/releases/<RELEASE>
  releases/
  source-private/
/var/lib/deuna-games/
  editorial-media/
/etc/deuna-games/runtime.env
```

`source-private/` contiene temporalmente las migraciones y herramientas administrativas. No es servido por Nginx y no debe ser legible por el usuario del proceso web. `current/` contiene solamente el artefacto mínimo generado por `npm run build:secure`.

`/var/lib/deuna-games/editorial-media/` contiene WebP, SVG de taxonomía y WebM editoriales aceptados por el panel. Está fuera de `current/` deliberadamente: cambiar de release o volver atrás no debe borrar imágenes ni previews ya publicados.

La release anterior se conserva para poder volver atrás cambiando el enlace `current`; no se borra automáticamente.

## 2. PostgreSQL local

PostgreSQL debe escuchar en `127.0.0.1`, `::1` o un socket Unix. El puerto 5432 no se abre en el firewall público.

Desde `source-private/`, ejecutar como superusuario local el ejemplo revisado:

```bash
sudo -u postgres psql -f ops/postgresql/bootstrap-admin.sql.example
sudo -u postgres psql
```

Dentro de `psql`, definir contraseñas diferentes y extensas sin escribirlas en scripts:

```text
\password deuna_migrator
\password deuna_runtime
\q
```

Crear `.env.admin-migration.local` desde `ops/postgresql/admin-migration.env.example` y `.env.local` desde `ops/systemd/runtime.env.example`. Ambos deben ser archivos privados y no versionados. Mantener `DEUNA_ADMIN_ENABLED=false`.

Ejecutar en este orden:

```bash
npm ci --no-audit --no-fund
npm run db:migrate
npm run admin:import-content
npm run admin:create-owner
npm run admin:preflight
```

Si es necesario reemplazar la contraseña propietaria, ejecutar desde esta misma copia privada:

```bash
npm run admin:change-password
```

El comando no muestra ni registra la contraseña, revoca las sesiones existentes y deja un evento mínimo de auditoría sin IP ni datos del dispositivo.

`admin:preflight` es de sólo lectura. Comprueba conexión local, separación de roles, ausencia de privilegios globales, cierre de `PUBLIC`, permisos exactos por columna, migraciones y checksums, una sola cuenta propietaria y el contenido importado. No muestra contraseñas ni modifica datos.

Después del preflight se puede retirar `.env.admin-migration.local` del VPS y recuperarlo desde un gestor privado de secretos sólo cuando exista otra migración.

## 3. Estado multimedia persistente

Antes de habilitar cargas desde el panel, crear el almacén persistente con el preparador incluido en la copia privada:

```bash
sudo bash ops/deploy/prepare-editorial-media.sh
```

El script falla si `/var/lib/deuna-games` o `editorial-media` son enlaces simbólicos o archivos regulares. Crea ambos directorios con propietario `deuna-games:deuna-games` y modo `0750`.

Si el usuario o grupo del servicio se cambian respecto del ejemplo, definirlos únicamente para ese comando:

```bash
sudo DEUNA_SERVICE_USER=<USUARIO-SERVICIO> \
     DEUNA_SERVICE_GROUP=<GRUPO-SERVICIO> \
     bash ops/deploy/prepare-editorial-media.sh
```

No apuntar `DEUNA_EDITORIAL_MEDIA_ROOT` a `current/`, `releases/`, `public/`, `/tmp` ni a la raíz del sistema. La multimedia editorial debe sobrevivir a un nuevo deploy y a una reversión de release.

Los previews de tarjetas se almacenan sólo después de convertir el archivo fuente a WebM/VP9, sin audio, con duración máxima de 30 segundos y límite público de 3 MB. El archivo fuente temporal se elimina al finalizar la conversión.

## 4. Entorno del servicio

Copiar y adaptar `ops/systemd/runtime.env.example` como `/etc/deuna-games/runtime.env`. Instalarlo con propietario `root`, grupo `root` y modo `0600`. No copiar allí `DEUNA_DATABASE_MIGRATION_PASSWORD`.

Antes de habilitar el panel, los valores esenciales son:

```text
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://<DOMINIO-REAL>
DEUNA_ADMIN_ENABLED=false
DEUNA_ADMIN_ORIGIN=https://<ORIGEN-EXACTO-DEL-PANEL>
DEUNA_EDITORIAL_MEDIA_ROOT=/var/lib/deuna-games/editorial-media
DEUNA_FFMPEG_PATH=/usr/bin/ffmpeg
DEUNA_DATABASE_HOST=127.0.0.1
DEUNA_DATABASE_USER=deuna_runtime
```

No usar marcadores, localhost ni dominios de ejemplo en la release real. Si `ffmpeg` está disponible en el `PATH` de la unidad systemd, `DEUNA_FFMPEG_PATH` puede quedar vacío; indicar una ruta absoluta evita depender del entorno interactivo del usuario SSH.

En desarrollo local, si `DEUNA_EDITORIAL_MEDIA_ROOT` no está definido, la aplicación usa de forma deliberada un directorio privado bajo el home del usuario y fuera del repositorio. En producción no existe ese fallback: la variable es obligatoria.

## 5. Release mínima

En el equipo de construcción, con el dominio HTTPS real:

```powershell
$env:NEXT_PUBLIC_SITE_URL="https://<DOMINIO-REAL>"
npm.cmd ci
npm.cmd run build:secure
```

Subir la carpeta `deploy` completa a una carpeta nueva dentro de `releases/`. No subir el repositorio completo al directorio servido y no reutilizar una carpeta de release existente.

Antes de cambiar `current`, verificar que la release incluye `server.js`, `.next/` y `public/`, y que no contiene `.env`, herramientas administrativas, migraciones ni repositorio `.git`.

El directorio `/var/lib/deuna-games/editorial-media/` no forma parte del artefacto `deploy/` y no debe copiarse, reemplazarse ni vaciarse durante una release.

## 6. systemd y Nginx

Adaptar `ops/systemd/deuna-games.service.example` al usuario y rutas definitivos. El proceso debe escuchar sólo en `127.0.0.1:3000`, leer `/etc/deuna-games/runtime.env` y mantener las restricciones de red y sistema de archivos del ejemplo.

El ejemplo usa `StateDirectory=deuna-games` y permite escritura únicamente en el caché de Next y `/var/lib/deuna-games`. No ampliar `ReadWritePaths` a todo `/srv/deuna-games`.

Adaptar `ops/nginx/deuna-games.conf.example`:

- reemplazar dominio y rutas de certificados;
- reemplazar `10.8.0.0/24` únicamente si WireGuard usa otra subred privada;
- mantener `deny all` en todas las rutas administrativas;
- conservar la excepción de `66m` únicamente en `/api/admin/content/games/<slug>/preview-upload`; el resto del API administrativo mantiene límites pequeños;
- mantener desactivados `access_log` y el registro persistente de errores;
- no agregar `X-Real-IP` ni `X-Forwarded-For`;
- probar la configuración con `sudo nginx -t` antes de recargar.

No activar HSTS hasta confirmar que HTTPS funciona correctamente y será permanente.

## 7. Prueba de frontera

Con `DEUNA_ADMIN_ENABLED=false`, primero verificar salud pública. Después realizar las dos pruebas siguientes sobre el dominio real:

| Lugar de la prueba | Ruta | Resultado obligatorio |
|---|---|---|
| Equipo fuera de la VPN | `/admin` | `403` o inaccesible por red privada |
| Equipo fuera de la VPN | `/api/admin/auth/login` | `403` |
| Equipo conectado a la VPN | `/admin` | Respuesta privada con `no-store` y `noindex` |

Una respuesta `404` generada por la aplicación no demuestra el cierre de Nginx. Cuando el dominio es públicamente resoluble, la prueba externa correcta es `403`.

Sólo cuando la frontera sea correcta, cambiar a `DEUNA_ADMIN_ENABLED=true`, reiniciar el servicio y confirmar:

- fuera de la VPN continúa `403`;
- dentro de la VPN aparece el formulario de acceso;
- una contraseña incorrecta no revela si el usuario existe;
- la contraseña correcta crea una cookie `HttpOnly`, `Secure` y `SameSite=Strict`;
- cerrar sesión revoca la sesión y vuelve al login;
- una imagen WebP válida puede subirse desde Multimedia y queda accesible bajo `/media/editorial/...`;
- un video fuente admitido puede convertirse desde Multimedia a un WebM de preview y el archivo fuente no queda en el almacén persistente;
- el WebM público responde como `video/webm`, admite `Range` y queda por debajo del límite editorial;
- cambiar `current` a otra release no elimina imágenes ni previews ya publicados.

## 8. Vuelta atrás

Si el servicio nuevo falla, no se corrige sobre la carpeta activa. Se vuelve a apuntar `current` a la release anterior y se reinicia systemd. Las migraciones no se revierten automáticamente: son compatibles hacia adelante y una migración ya aplicada nunca se edita.

Mantener `DEUNA_ADMIN_ENABLED=false` durante cualquier recuperación. No borrar la base, el esquema, releases, `/var/lib/deuna-games/editorial-media/` ni copias de seguridad para intentar reparar un despliegue.

## Datos necesarios antes de ejecutar en el VPS

Para convertir esta guía en comandos exactos hacen falta únicamente:

- distribución y versión del VPS;
- dominio público que usará DeUna Games;
- puerto SSH y nombre del usuario con `sudo`;
- confirmar si WireGuard ya existe y, si existe, su subred privada;
- confirmar si PostgreSQL, Nginx, Node.js y FFmpeg ya están instalados.

No hacen falta contraseñas ni claves privadas en el chat.
