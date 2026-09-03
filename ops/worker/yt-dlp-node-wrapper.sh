#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"
REMOTE_COMPONENT="${DEUNA_YTDLP_REMOTE_COMPONENT:-ejs:github}"
PLUGIN_DIR="${DEUNA_YTDLP_PLUGIN_DIR:-}"
POT_PROVIDER_URL="${DEUNA_YTDLP_POT_PROVIDER_URL:-}"

if [[ ! -x "${YTDLP_BIN}" ]]; then
  YTDLP_BIN="$(command -v yt-dlp 2>/dev/null || true)"
fi

if [[ -z "${YTDLP_BIN}" || ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible. Instálalo/actualízalo o configura DEUNA_YTDLP_BINARY con su ruta real." >&2
  exit 127
fi

# El worker decide los clientes de cada proveedor. Este wrapper NO fuerza un
# player_client de YouTube: resuelve Node/EJS y, sólo si se configuró de forma
# explícita, habilita un PO Token Provider local para el extractor de YouTube.
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

  if [[ -n "${PLUGIN_DIR}" || -n "${POT_PROVIDER_URL}" ]]; then
    if [[ -z "${PLUGIN_DIR}" || -z "${POT_PROVIDER_URL}" ]]; then
      echo "DEUNA_YTDLP_PLUGIN_DIR y DEUNA_YTDLP_POT_PROVIDER_URL deben configurarse juntos." >&2
      exit 78
    fi
    if [[ ! -d "${PLUGIN_DIR}" ]]; then
      echo "DEUNA_YTDLP_PLUGIN_DIR no existe o no es un directorio legible." >&2
      exit 78
    fi
    if [[ ! "${POT_PROVIDER_URL}" =~ ^http://(127\.0\.0\.1|localhost|\[::1\]):[0-9]{2,5}/?$ ]]; then
      echo "El PO Token Provider debe usar HTTP sobre loopback (127.0.0.1, localhost o ::1)." >&2
      exit 78
    fi

    YOUTUBE_ARGS+=(
      "--plugin-dirs" "${PLUGIN_DIR}"
      "--extractor-args" "youtubepot-bgutilhttp:base_url=${POT_PROVIDER_URL}"
    )
  fi
fi

exec "${YTDLP_BIN}" \
  "${YOUTUBE_ARGS[@]}" \
  "${args[@]}"
