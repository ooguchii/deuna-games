#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"
REMOTE_COMPONENT="${DEUNA_YTDLP_REMOTE_COMPONENT:-ejs:github}"

if [[ ! -x "${YTDLP_BIN}" ]]; then
  YTDLP_BIN="$(command -v yt-dlp 2>/dev/null || true)"
fi

if [[ -z "${YTDLP_BIN}" || ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible. Instálalo/actualízalo o configura DEUNA_YTDLP_BINARY con su ruta real." >&2
  exit 127
fi

# El worker decide los clientes de cada proveedor. Este wrapper NO fuerza un
# player_client de YouTube: su única responsabilidad especial es resolver una
# ruta absoluta y compatible para Node y mantener un único componente EJS.
args=()
youtube_url=0
remote_component="${REMOTE_COMPONENT}"

while (( $# > 0 )); do
  case "$1" in
    --js-runtimes)
      shift
      if (( $# > 0 )); then shift; fi
      ;;
    --js-runtimes=*)
      shift
      ;;
    --remote-components)
      shift
      if (( $# > 0 )); then
        remote_component="$1"
        shift
      fi
      ;;
    --remote-components=*)
      remote_component="${1#--remote-components=}"
      shift
      ;;
    *)
      case "$1" in
        *youtube.com/*|*youtu.be/*|*youtube-nocookie.com/*)
          youtube_url=1
          ;;
      esac
      args+=("$1")
      shift
      ;;
  esac
done

YOUTUBE_ARGS=()
if (( youtube_url )); then
  if [[ ! -x "${NODE_BIN}" ]]; then
    NODE_BIN="$(command -v node 2>/dev/null || true)"
  fi

  if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
    echo "Node no está disponible; YouTube requiere un runtime JavaScript compatible." >&2
    exit 127
  fi

  NODE_MAJOR="$("${NODE_BIN}" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
  if [[ ! "${NODE_MAJOR}" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 22 )); then
    echo "Node 22 o superior es requerido por el extractor actual de YouTube/yt-dlp." >&2
    exit 78
  fi

  YOUTUBE_ARGS+=(
    "--js-runtimes" "node:${NODE_BIN}"
    "--remote-components" "${remote_component}"
  )
fi

exec "${YTDLP_BIN}" \
  "${YOUTUBE_ARGS[@]}" \
  "${args[@]}"
