# Worker aislado para importaciones multimedia

Las páginas públicas de DeUna no necesitan acceso saliente a Internet para servir previews. Los visitantes reciben únicamente los WebM/VP9 locales ya generados.

En producción, las importaciones desde URL directa y YouTube se separan del proceso Next.js que atiende la web. El servicio principal conserva `IPAddressDeny=any` y sólo puede comunicarse por loopback. Un worker Node mínimo escucha en `127.0.0.1:3101`, descarga una sola fuente a la vez y devuelve el archivo temporal por HTTP local autenticado.

## Por qué existe

- evita abrir Internet al runtime que atiende visitantes;
- impide que yt-dlp o una descarga remota consuman recursos sin límites;
- mantiene la carga pública independiente de YouTube;
- permite aplicar `Nice`, cuota de CPU, memoria y tareas al proceso de importación;
- no entrega al worker credenciales PostgreSQL ni sesiones del panel;
- no conserva videos fuente después de terminar la operación.

## Dependencias

El servidor necesita Node.js 24, FFmpeg y yt-dlp. FFmpeg final sigue siendo usado por la aplicación para generar el WebM editorial. yt-dlp sólo pertenece al worker/flujo de YouTube.

En Debian/Ubuntu se puede comenzar con:

```bash
sudo apt update
sudo apt install -y ffmpeg yt-dlp
ffmpeg -version
yt-dlp --version
command -v yt-dlp
```

YouTube cambia con frecuencia. Si la distribución entrega una versión antigua de yt-dlp y empieza a fallar, actualizarlo desde una fuente oficial/confiable y ajustar `DEUNA_YTDLP_PATH` a la ruta instalada.

## Instalación del worker

Desde la copia privada del repositorio:

```bash
sudo bash ops/deploy/install-media-import-worker.sh
```

El instalador:

- copia sólo `media-import-worker.mjs` a `/usr/local/lib/deuna-games/`;
- instala la unidad systemd de ejemplo;
- crea `/etc/deuna-games/media-import.env` sólo si todavía no existe;
- nunca sobrescribe un archivo de secretos existente;
- no habilita el worker automáticamente.

Generar un token aleatorio de 32 bytes:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Guardar exactamente el mismo valor en:

```text
/etc/deuna-games/media-import.env
DEUNA_MEDIA_IMPORT_WORKER_TOKEN=<TOKEN>
```

Y en:

```text
/etc/deuna-games/runtime.env
DEUNA_MEDIA_IMPORT_WORKER_TOKEN=<MISMO_TOKEN>
DEUNA_MEDIA_IMPORT_WORKER_URL=http://127.0.0.1:3101/source
```

No enviar el token por chat, no guardarlo en Git y no reutilizar contraseñas de usuario/PostgreSQL.

En `media-import.env` verificar además la ruta real de yt-dlp, por ejemplo:

```text
DEUNA_YTDLP_PATH=/usr/bin/yt-dlp
```

Luego:

```bash
sudo systemctl enable --now deuna-games-media-import.service
sudo systemctl status deuna-games-media-import.service
```

El worker debe escuchar sólo en `127.0.0.1:3101`; no agregarlo a Nginx ni abrir el puerto en el firewall.

## Límites deliberados

La unidad de ejemplo aplica:

```text
Nice=10
CPUQuota=35%
MemoryHigh=256M
MemoryMax=384M
TasksMax=48
PrivateTmp=true
```

El worker además aplica por código:

- una única importación simultánea;
- cuerpo de control máximo de 8 KiB;
- fuente temporal máxima de 64 MiB;
- URL directa sólo HTTPS, sin credenciales ni puertos alternativos;
- DNS validado contra redes privadas/no enrutables y máximo 3 redirecciones;
- YouTube restringido a hosts/IDs reconocidos;
- `yt-dlp --no-playlist`;
- un fragmento concurrente;
- red limitada a 6 MB/s;
- fuente de YouTube limitada a 480p cuando está disponible;
- sólo el tramo IN/OUT solicitado, máximo 30 s;
- máximo 64 MiB de descarga;
- proceso sin `shell` y temporales eliminados al terminar.

La conversión WebM final usa como máximo 2 threads de encoder VP9 y 1 thread de filtros.

## Desarrollo local

El worker no es obligatorio durante desarrollo. Si `DEUNA_MEDIA_IMPORT_WORKER_URL` está vacío:

- la URL directa se descarga desde el proceso local con las mismas protecciones SSRF;
- YouTube usa `yt-dlp` local al confirmar el recorte.

Por eso para probar en WSL basta con que `ffmpeg` y `yt-dlp` estén en `PATH`.

## Flujo de YouTube

```text
Panel privado
  ↓
iframe youtube-nocookie (sólo para mirar y elegir IN/OUT)
  ↓
confirmar recorte
  ↓
Next.js → 127.0.0.1 worker (token)
  ↓
yt-dlp obtiene sólo el tramo seleccionado
  ↓
worker devuelve temporal por loopback
  ↓
FFmpeg acotado → WebM/VP9 local
  ↓
borrador editorial
  ↓
publicación
  ↓
tarjetas públicas cargan sólo WebM local tras 1 s de hover
```

El iframe de YouTube nunca aparece en Home, Juegos ni otras superficies públicas. La CSP general continúa con `frame-src 'none'`; únicamente `/admin` permite `https://www.youtube-nocookie.com`.
