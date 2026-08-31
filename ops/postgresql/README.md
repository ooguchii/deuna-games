# PostgreSQL privado para administración

El panel usa la base `deuna_games`. PostgreSQL debe escuchar sólo en loopback o en una interfaz privada; el puerto 5432 no debe publicarse en Internet.

Se mantienen dos roles separados:

- `deuna_migrator`: propietario del esquema y único rol con capacidad de aplicar migraciones y actualizar permisos.
- `deuna_runtime`: conexión utilizada por Next.js con permisos mínimos y explícitos para autenticación, sesiones y las operaciones editoriales que ejecuta la aplicación.

El rol runtime no recibe privilegios globales ni capacidad de alterar el esquema.

## Preparación

1. Ejecutar `bootstrap-admin.sql.example` como superusuario local.
2. Establecer contraseñas extensas mediante `\password` en `psql`. No escribir contraseñas en scripts ni en el repositorio.
3. Copiar `.env.example` a `.env.local`, completar sólo las variables del proceso web y fijar `DEUNA_ADMIN_ORIGIN` al origen HTTPS exacto usado desde la VPN.
4. Copiar `admin-migration.env.example` como `.env.admin-migration.local` en la raíz privada y completar únicamente la contraseña del migrador. La contraseña runtime no se duplica allí.
5. Ejecutar `npm run db:migrate`.
6. Ejecutar `npm run admin:import-content`. El importador es idempotente: actualiza la fuente versionada sin sobrescribir un borrador modificado y nunca elimina registros ausentes.
7. Ejecutar `npm run admin:create-owner` desde una terminal interactiva si todavía no existe la cuenta propietaria.
8. Ejecutar `npm run admin:preflight` y corregir cualquier bloqueo antes de habilitar el panel.
9. Configurar y probar la VPN y Nginx antes de cambiar `DEUNA_ADMIN_ENABLED` a `true` en producción.

Para un entorno local ya instalado, `npm run admin:update-local` aplica migraciones pendientes, sincroniza el contenido fuente y ejecuta los preflight de sólo lectura.

Next.js no carga `.env.admin-migration.local`. Ese archivo no debe entregarse al proceso web ni copiarse dentro de `deploy/`; puede retirarse del VPS entre operaciones y recuperarse desde un gestor privado de secretos cuando vuelva a ser necesario.

El proceso de migración valida el checksum de cada archivo SQL y falla si una migración aplicada fue alterada. Después de migrar vuelve a establecer los permisos mínimos del rol runtime.

El preflight comprueba conexión local, separación de roles, ausencia de privilegios globales, cierre de `PUBLIC`, permisos exactos por tabla/columna/secuencia, migraciones y checksums, una sola cuenta propietaria y coherencia del contenido editorial. No muestra contraseñas ni modifica datos.

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

Las tablas administrativas no contienen IP, ubicación, user-agent, identificadores de publicidad ni navegación de visitantes. Los eventos y registros de auditoría corresponden exclusivamente a la operación de la cuenta propietaria y a acciones editoriales mínimas.

## Copias de seguridad

La copia debe cifrarse antes de salir del VPS. Debe incluir el esquema `deuna_admin` y el estado editorial necesario para restaurar publicaciones e historial. Nunca debe guardarse dentro del directorio público, el repositorio Git ni el artefacto `deploy/`.

El almacenamiento de multimedia editorial persistente vive fuera de las releases y se documenta en `ops/deploy/README.md`; no debe confundirse con una copia de seguridad de PostgreSQL.
