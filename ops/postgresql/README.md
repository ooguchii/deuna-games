# PostgreSQL privado para administración y cuentas

La aplicación usa la base `deuna_games`. PostgreSQL debe escuchar sólo en loopback o en una interfaz privada; el puerto 5432 no debe publicarse en Internet.

Se mantienen dos roles separados:

- `deuna_migrator`: propietario de la base y de los esquemas privados; es el único rol con capacidad de aplicar migraciones y restablecer permisos.
- `deuna_runtime`: conexión utilizada por Next.js con permisos mínimos y explícitos para autenticación, sesiones, cuentas públicas, personalización explícita, Rewards y las operaciones editoriales que ejecuta la aplicación.

El rol runtime no recibe privilegios globales ni capacidad de crear, migrar o alterar tablas.

## Esquemas privados

Las migraciones `001` a `011` mantienen dos límites distintos dentro de PostgreSQL:

- `deuna_admin`: Owner, administradores, sesiones administrativas, auditoría mínima e información editorial.
- `deuna_accounts`: cuentas públicas, sesiones públicas, códigos de recuperación, preferencias explícitas de juegos, Mi PC y progreso de DeUna Rewards.

No existe una FK ni una operación de aplicación que transforme una cuenta pública en administrativa. El acceso administrativo conserva su propio flujo de autenticación y autorización.

En `deuna_accounts.users` sólo son obligatorios el nombre de usuario y el hash de la contraseña. Nombre visible, biografía y correo son opcionales. El correo, cuando el usuario decide agregarlo, se cifra en la aplicación con AES-256-GCM antes de persistirse como `email_encrypted`.

Las sesiones guardan únicamente el hash del token aleatorio. Los códigos de recuperación guardan únicamente su hash. No se persisten IP, ubicación, user-agent, huellas de dispositivo ni historial de navegación asociado a la cuenta.

`deuna_accounts.game_preferences` guarda únicamente decisiones explícitas por juego: favorito, estado de biblioteca y seguimiento de actualizaciones. Para el seguimiento conserva desde cuándo se sigue el título y hasta qué momento el usuario marcó sus avisos como vistos; los avisos se derivan de las actualizaciones editoriales publicadas y no se duplican por usuario.

`deuna_accounts.hardware_profiles` guarda sólo IDs de CPU y GPU seleccionados desde el catálogo, RAM y modo de memoria. No almacena renderer detectado, sistema operativo detectado, navegador ni otros metadatos del dispositivo. El perfil se usa con el mismo motor de FPS que el Finder.

`deuna_accounts.reward_profiles` guarda únicamente el agregado necesario para DeUna Rewards: XP total, saldo de créditos, racha actual, mejor racha y momento del último reclamo. `deuna_accounts.reward_events` es el ledger mínimo de recompensas y conserva sólo tipo de evento, clave idempotente, variación de XP/créditos y fecha. No admite metadata genérica, URL, ruta, referrer, clics, vistas, tiempo de uso, user-agent, dispositivo ni ubicación.

Los eventos de Rewards son apéndice de recompensas, no historial de actividad. El runtime puede insertarlos y consultarlos, pero no editarlos ni borrarlos. Los hitos y bonuses idempotentes usan `UNIQUE (user_id, event_type, event_key)` para impedir una segunda acreditación del mismo premio. Mientras no exista un sistema de canje, PostgreSQL sólo acepta los tres tipos de premio implementados (`daily_claim`, `weekly_bonus`, `milestone`), no admite descuentos de créditos y valida también las combinaciones de importe definidas por la economía de Rewards.

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

Para un entorno local ya instalado, `npm run admin:update-local` aplica migraciones pendientes, sincroniza el contenido fuente y ejecuta los preflight de sólo lectura. Antes de cualquier migración persistente puede generarse una copia verificada fuera del repositorio con `npm run admin:backup-local`.

El salto específico de una instalación `010` a `011_account_rewards.sql` está documentado en [`UPGRADE-011-REWARDS.md`](./UPGRADE-011-REWARDS.md), incluyendo backup, verificación, migración, prueba funcional y conducta ante fallos. No debe aplicarse 011 sin completar primero ese procedimiento.

Next.js no carga `.env.admin-migration.local`. Ese archivo no debe entregarse al proceso web ni copiarse dentro de `deploy/`; puede retirarse del VPS entre operaciones y recuperarse desde un gestor privado de secretos cuando vuelva a ser necesario.

El proceso de migración valida el checksum de cada archivo SQL y falla si una migración aplicada fue alterada. Después de migrar vuelve a establecer los permisos mínimos del rol runtime. Cada migración SQL se ejecuta dentro de una transacción propia y se registra sólo después del `COMMIT`; ante un error el migrador hace `ROLLBACK`.

El preflight comprueba conexión local, separación de roles, ausencia de privilegios globales, cierre de `PUBLIC`, permisos exactos por tabla/columna/secuencia, migraciones y checksums, exactamente un Owner activo y coherencia del contenido editorial. No muestra contraseñas ni modifica datos.

El runtime recibe `DELETE` sólo donde una operación autónoma de la cuenta lo necesita:

- `deuna_accounts.recovery_codes`, porque la rotación invalida el paquete anterior antes de generar uno nuevo;
- `deuna_accounts.users`, para permitir que el propio usuario elimine físicamente su cuenta;
- `deuna_accounts.game_preferences`, para quitar un juego o todas sus señales de Mi DeUna;
- `deuna_accounts.hardware_profiles`, para eliminar la PC guardada.

No se concede `DELETE` sobre `reward_profiles` ni `reward_events`, y tampoco `UPDATE` sobre `reward_events`. El ledger de Rewards sólo desaparece cuando el usuario elimina físicamente su cuenta y PostgreSQL ejecuta la cascada.

El borrado del usuario elimina por `ON DELETE CASCADE` sus sesiones, códigos de recuperación, preferencias de juegos, hardware guardado, perfil de Rewards y ledger de recompensas. No se concede `DELETE` sobre sesiones, tablas administrativas ni contenido editorial, y el preflight bloquea cualquier permiso de tabla adicional no previsto. Los permisos de `INSERT` y `UPDATE` siguen limitados a las columnas exactas que necesita la aplicación; el runtime no puede reasignar datos a otra cuenta.

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

DeUna Rewards mantiene esa misma regla: una recompensa puede depender de un reclamo explícito o de hitos derivados de datos que el usuario ya decidió guardar, pero no de clics, tiempo de pantalla, páginas vistas o metadata del dispositivo. La racha usa exclusivamente la fecha del último reclamo de recompensa.

La página pública `/privacidad` documenta el comportamiento técnico verificable de Mi DeUna y Rewards. Permanece `noindex` antes del lanzamiento porque todavía deben completarse fuera del código la identificación jurídica del responsable, el canal de contacto de privacidad, la jurisdicción aplicable y el plazo concreto de retención de backups.

La barrera `npm run check:account-privacy` verifica automáticamente que el esquema y el código no incorporen campos o mecanismos de seguimiento prohibidos y que se mantengan las garantías de cifrado, hashes, recuperación, separación, personalización mínima, Rewards sin telemetría y baja autónoma. La integración PostgreSQL de CI prueba además permisos runtime reales, inmutabilidad del ledger de Rewards y cascadas de borrado en una base limpia con todas las migraciones. `npm run check:account-rewards` verifica además la economía, la autoridad del servidor, la resiliencia frente a fallos secundarios y la transparencia visible al usuario.

## Copias de seguridad

`npm run admin:backup-local` crea una copia PostgreSQL en formato custom dentro de `~/.deuna/backups/`, fuera del repositorio, fija permisos `0600` y valida el archivo mediante `pg_restore --list`. Si no puede crear y verificar la copia, el comando bloquea el procedimiento.

La copia debe cifrarse antes de salir del VPS o del equipo que la generó. Debe incluir `deuna_admin` y `deuna_accounts` si se necesita restaurar cuentas, publicaciones, progreso de Rewards e historial. La copia hereda la sensibilidad de los datos cifrados y de los hashes que contiene; nunca debe guardarse dentro del directorio público, el repositorio Git ni el artefacto `deploy/`.

`DEUNA_ACCOUNT_DATA_KEY` debe respaldarse por separado en un gestor privado de secretos. Sin esa clave no será posible descifrar los correos opcionales existentes tras una restauración.

El almacenamiento de multimedia editorial persistente vive fuera de las releases y se documenta en `ops/deploy/README.md`; no debe confundirse con una copia de seguridad de PostgreSQL.
