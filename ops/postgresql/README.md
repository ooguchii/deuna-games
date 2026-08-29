# PostgreSQL privado para administración

El panel utiliza una base `deuna_games` en el mismo VPS. PostgreSQL debe escuchar sólo en loopback o en una interfaz privada; el puerto 5432 no debe publicarse en Internet.

Se mantienen dos roles:

- `deuna_migrator`: propietario del esquema y único rol con capacidad de aplicar migraciones.
- `deuna_runtime`: conexión utilizada por Next.js; recibe sólo los permisos mínimos de lectura y escritura requeridos para autenticación.

## Preparación

1. Ejecutar `bootstrap-admin.sql.example` como superusuario local.
2. Establecer contraseñas extensas mediante `\password` en `psql`. No escribir contraseñas en scripts ni en el repositorio.
3. Copiar `.env.example` a `.env.local`, completar sólo las variables del proceso web y fijar `DEUNA_ADMIN_ORIGIN` al origen HTTPS exacto usado desde la VPN.
4. Copiar `admin-migration.env.example` como `.env.admin-migration.local` en la raíz privada y completar únicamente la contraseña del migrador. La contraseña runtime no se duplica allí.
5. Ejecutar `npm.cmd run db:migrate`.
6. Ejecutar `npm.cmd run admin:import-content`. El importador es idempotente: actualiza la fuente sin sobrescribir borradores modificados y nunca elimina registros ausentes.
7. Ejecutar `npm.cmd run admin:create-owner` desde una terminal interactiva.
8. Ejecutar `npm.cmd run admin:preflight` y corregir cualquier bloqueo sin habilitar todavía el panel.
9. Configurar y probar la VPN y Nginx antes de cambiar `DEUNA_ADMIN_ENABLED` a `true`.

Next.js no carga `.env.admin-migration.local`. Ese archivo no debe entregarse al proceso web ni copiarse dentro de `deploy/`; puede retirarse del VPS entre operaciones y recuperarse desde un gestor privado de secretos.

El proceso de migración valida el checksum de cada archivo SQL y falla si una migración aplicada fue alterada. Después de migrar, actualiza los permisos mínimos del rol runtime.

El preflight posterior es de sólo lectura y vuelve a comprobar los checksums, la separación de roles, el cierre de `PUBLIC`, los permisos exactos del runtime, la única cuenta propietaria y el contenido editorial activo. Debe aprobar tanto con las credenciales del migrador como con las del runtime.

## Privacidad

Las tablas administrativas no contienen IP, ubicación, user-agent, identificadores de publicidad ni navegación de visitantes. Los únicos eventos conservados corresponden al acceso de la cuenta propietaria y a futuros cambios editoriales.

## Área editorial

`editorial_items` conserva por separado la fuente importada y el borrador de trabajo. `editorial_revisions` agrega una versión inmutable por importación o guardado. Si los archivos cambian mientras existe un borrador modificado, la importación actualiza la fuente pero preserva el borrador y declara un conflicto para revisión manual.

## Copias de seguridad

La copia debe cifrarse antes de salir del VPS. Debe incluir el esquema `deuna_admin` y nunca guardarse dentro del directorio público, el repositorio Git o el artefacto `deploy/`.
