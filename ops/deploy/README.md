# Despliegue privado y reversible en VPS

Esta guía prepara el panel sin exponerlo durante la instalación. Está pensada para Debian 12 o Ubuntu 24.04 con Nginx, PostgreSQL y WireGuard en el mismo VPS. Antes de ejecutar comandos reales hay que adaptar dominio, usuario SSH, subred VPN, certificados y rutas.

No publiques contraseñas, claves privadas, archivos `.env`, dumps ni capturas que las muestren. Las dos contraseñas de PostgreSQL y la contraseña propietaria se crean directamente en una terminal privada del VPS; no deben enviarse por chat ni guardarse en Git.

## Orden seguro

1. Mantener `DEUNA_ADMIN_ENABLED=false`.
2. Confirmar que el VPS tiene acceso SSH seguro y actualizaciones instaladas.
3. Instalar PostgreSQL, Nginx, Node.js 24 y WireGuard desde fuentes confiables.
4. Crear los roles y la base PostgreSQL sólo en loopback.
5. Aplicar migraciones, importar contenido y crear la única cuenta propietaria.
6. Ejecutar los preflight de migración y runtime.
7. Instalar una release nueva sin eliminar la release anterior.
8. Probar Next.js en `127.0.0.1:3000` y después Nginx con HTTPS.
9. Confirmar desde fuera de la VPN que `/admin` y `/api/admin/` responden `403`.
10. Confirmar desde la VPN que `/admin` abre el inicio de sesión.
11. Cambiar `DEUNA_ADMIN_ENABLED=true`, reiniciar y repetir ambas pruebas.

El panel no se habilita antes del paso 11. Si una verificación falla, se mantiene cerrado.

## 1. Estructura del servidor

Usar una cuenta de servicio sin login interactivo y releases separadas:

```text
/srv/deuna-games/
  current -> /srv/deuna-games/releases/<RELEASE>
  releases/
  source-private/
/etc/deuna-games/runtime.env
```

`source-private/` contiene temporalmente las migraciones y herramientas administrativas. No es servido por Nginx y no debe ser legible por el usuario del proceso web. `current/` contiene solamente el artefacto mínimo generado por `npm run build:secure`.

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

`admin:preflight` es de sólo lectura. Comprueba conexión local, separación de roles, ausencia de privilegios globales, cierre de `PUBLIC`, permisos exactos por columna, migraciones y checksums, una sola cuenta propietaria y el contenido importado. No muestra contraseñas ni modifica datos.

Después del preflight se puede retirar `.env.admin-migration.local` del VPS y recuperarlo desde un gestor privado de secretos sólo cuando exista otra migración.

## 3. Entorno del servicio

Copiar y adaptar `ops/systemd/runtime.env.example` como `/etc/deuna-games/runtime.env`. Instalarlo con propietario `root`, grupo `root` y modo `0600`. No copiar allí `DEUNA_DATABASE_MIGRATION_PASSWORD`.

Antes de habilitar el panel, los valores esenciales son:

```text
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://<DOMINIO-REAL>
DEUNA_ADMIN_ENABLED=false
DEUNA_ADMIN_ORIGIN=https://<ORIGEN-EXACTO-DEL-PANEL>
DEUNA_DATABASE_HOST=127.0.0.1
DEUNA_DATABASE_USER=deuna_runtime
```

No usar marcadores, localhost ni dominios de ejemplo en la release real.

## 4. Release mínima

En el equipo de construcción, con el dominio HTTPS real:

```powershell
$env:NEXT_PUBLIC_SITE_URL="https://<DOMINIO-REAL>"
npm.cmd ci
npm.cmd run build:secure
```

Subir la carpeta `deploy` completa a una carpeta nueva dentro de `releases/`. No subir el repositorio completo al directorio servido y no reutilizar una carpeta de release existente.

Antes de cambiar `current`, verificar que la release incluye `server.js`, `.next/` y `public/`, y que no contiene `.env`, herramientas administrativas, migraciones ni repositorio `.git`.

## 5. systemd y Nginx

Adaptar `ops/systemd/deuna-games.service.example` al usuario y rutas definitivos. El proceso debe escuchar sólo en `127.0.0.1:3000`, leer `/etc/deuna-games/runtime.env` y mantener las restricciones de red y sistema de archivos del ejemplo.

Adaptar `ops/nginx/deuna-games.conf.example`:

- reemplazar dominio y rutas de certificados;
- reemplazar `10.8.0.0/24` únicamente si WireGuard usa otra subred privada;
- mantener `deny all` en todas las rutas administrativas;
- mantener desactivados `access_log` y el registro persistente de errores;
- no agregar `X-Real-IP` ni `X-Forwarded-For`;
- probar la configuración con `sudo nginx -t` antes de recargar.

No activar HSTS hasta confirmar que HTTPS funciona correctamente y será permanente.

## 6. Prueba de frontera

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
- cerrar sesión revoca la sesión y vuelve al login.

## 7. Vuelta atrás

Si el servicio nuevo falla, no se corrige sobre la carpeta activa. Se vuelve a apuntar `current` a la release anterior y se reinicia systemd. Las migraciones no se revierten automáticamente: son compatibles hacia adelante y una migración ya aplicada nunca se edita.

Mantener `DEUNA_ADMIN_ENABLED=false` durante cualquier recuperación. No borrar la base, el esquema, releases ni copias de seguridad para intentar reparar un despliegue.

## Datos necesarios antes de ejecutar en el VPS

Para convertir esta guía en comandos exactos hacen falta únicamente:

- distribución y versión del VPS;
- dominio público que usará DeUna Games;
- puerto SSH y nombre del usuario con `sudo`;
- confirmar si WireGuard ya existe y, si existe, su subred privada;
- confirmar si PostgreSQL, Nginx y Node.js ya están instalados.

No hacen falta contraseñas ni claves privadas en el chat.
