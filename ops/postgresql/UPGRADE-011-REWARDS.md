# Actualización controlada 010 → 011 — DeUna Rewards

Este procedimiento aplica `011_account_rewards.sql` a una instalación que ya tiene las migraciones `001`–`010`. No debe ejecutarse sobre una copia de trabajo con cambios locales sin revisar ni sin una copia PostgreSQL verificada.

## 1. Confirmar código y entorno sin mostrar secretos

Desde la raíz del repositorio:

```bash
git status
git branch --show-current
git rev-parse --short HEAD

test -f .env.local && echo ".env.local: OK" || echo ".env.local: FALTA"
test -f .env.admin-migration.local && echo ".env.admin-migration.local: OK" || echo ".env.admin-migration.local: FALTA"
grep -q '^DEUNA_ACCOUNT_DATA_KEY=.\+' .env.local && echo "DEUNA_ACCOUNT_DATA_KEY: OK" || echo "DEUNA_ACCOUNT_DATA_KEY: FALTA"
```

No imprimir `DEUNA_ACCOUNT_DATA_KEY`, contraseñas PostgreSQL ni el contenido completo de los archivos `.env`.

La rama esperada para esta etapa es `feature/secure-admin-foundation`. Antes de migrar, usar el HEAD que figure como validado en el PR y en la CI final de la etapa.

## 2. Crear una copia PostgreSQL verificada

La herramienta local usa las credenciales privadas de `.env.admin-migration.local`, llama a `pg_dump` en formato custom, guarda la copia fuera del repositorio con permisos `0600` y la valida con `pg_restore --list`.

```bash
npm run admin:backup-local
```

El comando debe terminar con:

```text
Backup local PostgreSQL: OK
```

La ruta normal es `~/.deuna/backups/`. No mover esa copia a una nube, correo, chat, repositorio o equipo externo sin cifrarla primero. En un servidor, las copias deben cifrarse antes de salir del host.

Si falta `pg_dump` o `pg_restore`, si la copia es demasiado pequeña o si no puede verificarse, **no continuar con la migración**.

## 3. Aplicar 011 y restablecer permisos mínimos

```bash
npm run admin:update-local
```

Ese comando:

1. aplica únicamente migraciones pendientes;
2. registra el checksum de cada migración;
3. vuelve a establecer los permisos mínimos del rol runtime;
4. sincroniza el contenido editorial fuente;
5. ejecuta el preflight de migración y el preflight local.

Cada archivo SQL se ejecuta dentro de su propia transacción. Si `011_account_rewards.sql` falla antes del `COMMIT`, el migrador ejecuta `ROLLBACK` y no registra una 011 parcial.

No modificar una migración que ya figure aplicada. Si el migrador informa un checksum diferente, detenerse y revisar el estado antes de cualquier acción adicional.

## 4. Verificación funcional después de 011

Iniciar la aplicación normalmente y revisar `/cuenta` con una cuenta de prueba. Confirmar:

- `Hoy en DeUna` aparece en el resumen;
- la sección `Recompensas` muestra nivel, XP, créditos, racha y ciclo de 7 días;
- una cuenta que ya cumplía hitos recibe cada hito previo una sola vez;
- el primer reclamo diario acredita el importe mostrado;
- un segundo reclamo inmediato queda bloqueado por el cooldown;
- guardar un juego y configurar Mi PC siguen funcionando independientemente de Rewards;
- `/privacidad` explica los datos de Mi DeUna y las reglas de Rewards;
- en móvil no aparece desbordamiento horizontal ni controles inaccesibles.

Para probar la eliminación completa, usar una cuenta descartable: después de eliminarla no deben quedar sesiones, códigos, personalización, perfil Rewards ni eventos Rewards asociados. La CI PostgreSQL también verifica esa cascada automáticamente.

## 5. Si algo falla

Si `admin:update-local` falla durante la propia migración, no reintentar a ciegas: conservar la salida del error, no editar 011 y revisar primero el estado. La transacción protege contra una aplicación SQL parcial.

Si 011 se aplicó pero falla un preflight posterior, no restaurar automáticamente la base ni borrar tablas Rewards manualmente. El preflight está diseñado para detectar permisos o configuración incoherentes sin modificar datos; corregir la causa y volver a ejecutarlo.

La copia previa existe como punto de recuperación, pero una restauración completa es una operación destructiva y debe decidirse sólo después de identificar qué etapa falló.

## 6. Antes de habilitar cuentas al público

La implementación técnica no sustituye la información jurídica del servicio. Antes del lanzamiento público deben definirse y publicarse, como mínimo, la identificación del responsable, un canal de privacidad, la jurisdicción aplicable y el plazo concreto de retención/rotación de backups. La página `/privacidad` permanece `noindex` mientras esa información esté pendiente.
