#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"
COOKIES_FILE="${DEUNA_YTDLP_COOKIES_FILE:-}"
YOUTUBE_CLIENTS="${DEUNA_YTDLP_YOUTUBE_CLIENTS:-web_embedded,default}"

if [[ ! -x "${YTDLP_BIN}" ]]; then
  YTDLP_BIN="$(command -v yt-dlp 2>/dev/null || true)"
fi

if [[ -z "${YTDLP_BIN}" || ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible. Instálalo/actualízalo o configura DEUNA_YTDLP_BINARY con su ruta real." >&2
  exit 127
fi

COOKIE_ARGS=()
if [[ -n "${COOKIES_FILE}" ]]; then
  if [[ ! -r "${COOKIES_FILE}" ]]; then
    echo "El archivo de cookies configurado no es legible: ${COOKIES_FILE}." >&2
    exit 78
  fi
  COOKIE_ARGS=("--cookies" "${COOKIES_FILE}")
fi

# Normalizamos las opciones que puede declarar el runtime web. El wrapper es la
# única fuente de verdad para Node/EJS en producción. Para previews editoriales
# priorizamos web_embedded: en videos embebibles ese cliente no necesita PO
# Token para GVS y evita escoger primero formatos de clientes más protegidos.
# Los clientes automáticos quedan como fallback. El valor histórico
# default,web_embedded y el alias auto migran a este orden nuevo.
args=()
youtube_url=0
skip_next=0
while (( $# > 0 )); do
  if (( skip_next )); then
    skip_next=0
    shift
    continue
  fi

  case "$1" in
    --js-runtimes|--remote-components)
      skip_next=1
      shift
      ;;
    --js-runtimes=*|--remote-components=*)
      shift
      ;;
    --extractor-args)
      option="$1"
      value="${2:-}"
      if [[ "${value}" == youtube:player_client=* ]]; then
        shift
        if (( $# > 0 )); then shift; fi
      else
        args+=("${option}")
        shift
        if (( $# > 0 )); then
          args+=("$1")
          shift
        fi
      fi
      ;;
    --extractor-args=youtube:player_client=*)
      shift
      ;;
    --sleep-requests)
      value="${2:-}"
      if [[ "${value}" == "1" ]]; then
        shift
        if (( $# > 0 )); then shift; fi
      else
        args+=("$1")
        shift
        if (( $# > 0 )); then
          args+=("$1")
          shift
        fi
      fi
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

  YOUTUBE_ARGS+=(
    "--js-runtimes" "node:${NODE_BIN}"
    "--remote-components" "ejs:github"
  )

  if [[ "${YOUTUBE_CLIENTS}" == "default,web_embedded" || "${YOUTUBE_CLIENTS}" == "auto" || -z "${YOUTUBE_CLIENTS}" ]]; then
    YOUTUBE_CLIENTS="web_embedded,default"
  fi

  YOUTUBE_ARGS+=(
    "--extractor-args" "youtube:player_client=${YOUTUBE_CLIENTS}"
  )
fi

exec "${YTDLP_BIN}" \
  "${YOUTUBE_ARGS[@]}" \
  "${COOKIE_ARGS[@]}" \
  "${args[@]}"
