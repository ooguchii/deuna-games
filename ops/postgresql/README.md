# PostgreSQL privado para administración y cuentas

La aplicación usa la base `deuna_games`. PostgreSQL debe escuchar sólo en loopback o en una interfaz privada; el puerto 5432 no debe publicarse en Internet.

Se mantienen dos roles separados:

- `deuna_migrator`: propietario de la base y de los esquemas privados; es el único rol con capacidad de aplicar migraciones y restablecer permisos.
- `deuna_runtime`: conexión utilizada por Next.js con permisos mínimos y explícitos para autenticación, sesiones, cuentas públicas, personalización explícita y las operaciones editoriales que ejecuta la aplicación.

El rol runtime no recibe privilegios globales ni capacidad de crear, migrar o alterar tablas.

## Esquemas privados

Las migraciones `001` a `010` mantienen dos límites distintos dentro de PostgreSQL:

- `deuna_admin`: Owner, administradores, sesiones administrativas, auditoría mínima e información editorial.
- `deuna_accounts`: cuentas públicas, sesiones públicas, códigos de recuperación, preferencias explícitas de juegos y Mi PC.

No existe una FK ni una operación de aplicación que transforme una cuenta pública en administrativa. El acceso administrativo conserva su propio flujo de autenticación y autorización.

En `deuna_accounts.users` sólo son obligatorios el nombre de usuario y el hash de la contraseña. Nombre visible, biografía y correo son opcionales. El correo, cuando el usuario decide agregarlo, se cifra en la aplicación con AES-256-GCM antes de persistirse como `email_encrypted`.

Las sesiones guardan únicamente el hash del token aleatorio. Los códigos de recuperación guardan únicamente su hash. No se persisten IP, ubicación, user-agent, huellas de dispositivo ni historial de navegación asociado a la cuenta.

`deuna_accounts.game_preferences` guarda únicamente decisiones explícitas por juego: favorito, estado de biblioteca y seguimiento de actualizaciones. Para el seguimiento conserva desde cuándo se sigue el título y hasta qué momento el usuario marcó sus avisos como vistos; los avisos se derivan de las actualizaciones editoriales publicadas y no se duplican por usuario.

`deuna_accounts.hardware_profiles` guarda sólo IDs de CPU y GPU seleccionados desde el catálogo, RAM y modo de memoria. No almacena renderer detectado, sistema operativo detectado, navegador ni otros metadatos del dispositivo. El perfil se usa con el mismo motor de FPS que el Finder.

## Preparación

1. Ejecutar `bootstrap-admin.sql.example` como superusuario local.
2. Establecer contraseñas extensas mediante `\password` en `psql`. No escribir contraseñas en scripts ni en el repositorio.
3. Copiar `.env.example` a `.env.local`, completar sólo las variables del proceso web y fijar `DEUNA_ADMIN_ORIGIN` al origen HTTPS exacto usado desde la VPN.
4. Generar `DEUNA_ACCOUNT_DATA_KEY` como 32 bytes aleatorios codificados en base64url. La clave real no debe versionarse ni reutilizar una contraseña.
5. Copiar `admin-migration.env.example` como `.env.admin-migration.local` en la raíz privada y completar únicamente la contraseña del migrador. La contraseña runtime no se duplica allí.
6. Ejecutar `npm run db:migrate`.
7. Ejecutar `npm run admin:import-content`. El importador es idempotente: actualiza la fuente versionada sin sobrescribir un borrador modificado y nunca elimina registros ausentes.
8. Ejecutar `npm run admin:create-owner` desde una terminal interactiva si todavía no existe la cuenta propietaria.
9. Ejecutar `npm run admin:preflight` y corregir cualquier bloqueo antes de habilitar el panel.
10. Configurar y probar la VPN y Nginx antes de cambiar `DEUNA_ADMIN_ENABLED` a `true` en producción.

Para un entorno local ya instalado, `npm run admin:update-local` aplica migraciones pendientes, sincroniza el contenido fuente y ejecuta los preflight de sólo lectura.

Next.js no carga `.env.admin-migration.local`. Ese archivo no debe entregarse al proceso web ni copiarse dentro de `deploy/`; puede retirarse del VPS entre operaciones y recuperarse desde un gestor privado de secretos cuando vuelva a ser necesario.

El proceso de migración valida el checksum de cada archivo SQL y falla si una migración aplicada fue alterada. Después de migrar vuelve a establecer los permisos mínimos del rol runtime.

El preflight comprueba conexión local, separación de roles, ausencia de privilegios globales, cierre de `PUBLIC`, permisos exactos por tabla/columna/secuencia, migraciones y checksums, exactamente un Owner activo y coherencia del contenido editorial. No muestra contraseñas ni modifica datos.

El runtime recibe `DELETE` sólo donde una operación autónoma de la cuenta lo necesita:

- `deuna_accounts.recovery_codes`, porque la rotación invalida el paquete anterior antes de generar uno nuevo;
- `deuna_accounts.users`, para permitir que el propio usuario elimine físicamente su cuenta;
- `deuna_accounts.game_preferences`, para quitar un juego o todas sus señales de Mi DeUna;
- `deuna_accounts.hardware_profiles`, para eliminar la PC guardada.

El borrado del usuario elimina por `ON DELETE CASCADE` sus sesiones, códigos de recuperación, preferencias de juegos y hardware guardado. No se concede `DELETE` sobre sesiones, tablas administrativas ni contenido editorial, y el preflight bloquea cualquier permiso de tabla adicional no previsto. Los permisos de `INSERT` y `UPDATE` de personalización siguen limitados a las columnas exactas que necesita la aplicación; el runtime no puede reasignar una preferencia o un perfil a otra cuenta.

## Modelo editorial

`deuna_admin.editorial_items` mantiene estados distintos para una misma entidad editorial:

- `source_payload`: estado fuente importado desde el repositorio cuando corresponde;
- `draft_payload`: borrador de trabajo privado;
- `published_payload`: snapshot actualmente visible para los lectores públicos;
- `public_visible`: control explícito de visibilidad pública.

Guardar y publicar son operaciones separadas. La web pública lee el snapshot publicado visible, no el borrador.

`editorial_revisions` conserva revisiones inmutables del trabajo editorial. `editorial_publications` conserva el historial inmutable de snapshots publicados, incluido el número de publicación, checksum, revisión de origen y reversiones. Restaurar o volver a publicar no borra el historial anterior.

Si la fuente cambia mientras existe un borrador modificado, la importación actualiza la referencia fuente pero preserva el borrador para evitar pérdida de trabajo.

## Privacidad

Las tablas administrativas no contienen correo, IP, ubicación, user-agent, identificadores de publicidad ni navegación de visitantes. Los eventos y registros de auditoría corresponden exclusivamente a la operación administrativa mínima necesaria.

Las cuentas públicas están diseñadas con minimización por defecto. `DEUNA_ACCOUNT_DATA_KEY` protege el correo opcional y debe permanecer fuera de Git. La personalización de Mi DeUna usa sólo elecciones expresas de biblioteca, seguimiento y hardware; no crea un historial de navegación ni copia la detección cruda del navegador a PostgreSQL.

La barrera `npm run check:account-privacy` verifica automáticamente que el esquema y el código no incorporen campos o mecanismos de seguimiento prohibidos y que se mantengan las garantías de cifrado, hashes, recuperación, separación, personalización mínima y baja autónoma. La integración PostgreSQL de CI prueba además los permisos runtime reales y las cascadas de borrado en una base limpia con todas las migraciones.

## Copias de seguridad

La copia debe cifrarse antes de salir del VPS. Debe incluir `deuna_admin` y `deuna_accounts` si se necesita restaurar cuentas, publicaciones e historial. La copia hereda la sensibilidad de los datos cifrados y de los hashes que contiene; nunca debe guardarse dentro del directorio público, el repositorio Git ni el artefacto `deploy/`.

`DEUNA_ACCOUNT_DATA_KEY` debe respaldarse por separado en un gestor privado de secretos. Sin esa clave no será posible descifrar los correos opcionales existentes tras una restauración.

El almacenamiento de multimedia editorial persistente vive fuera de las releases y se documenta en `ops/deploy/README.md`; no debe confundirse con una copia de seguridad de PostgreSQL.
