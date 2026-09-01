#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-}"
NODE_BIN="${DEUNA_NODE_BINARY:-}"
COOKIES_FILE="${DEUNA_YTDLP_COOKIES_FILE:-}"
YOUTUBE_CLIENTS="${DEUNA_YTDLP_YOUTUBE_CLIENTS:-}"

if [[ -z "${YTDLP_BIN}" ]]; then
  YTDLP_BIN="$(command -v yt-dlp 2>/dev/null || true)"
fi
if [[ -z "${NODE_BIN}" ]]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi

if [[ -z "${YTDLP_BIN}" || ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible. Instálalo/actualízalo o configura DEUNA_YTDLP_BINARY con su ruta real." >&2
  exit 127
fi

if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  echo "Node no está disponible; YouTube requiere un runtime JavaScript compatible." >&2
  exit 127
fi

COOKIE_ARGS=()
if [[ -n "${COOKIES_FILE}" ]]; then
  if [[ ! -r "${COOKIES_FILE}" ]]; then
    echo "El archivo de cookies configurado no es legible: ${COOKIES_FILE}." >&2
    exit 78
  fi
  COOKIE_ARGS=(--cookies "${COOKIES_FILE}")
fi

# Normalizamos las opciones que puede declarar el runtime web. El wrapper es la
# única fuente de verdad para Node/EJS y evita que una mitigación vieja de
# YouTube quede fijada para siempre. En particular, default,web_embedded fue una
# solución temporal; yt-dlp moderno ya decide sus clientes y fallbacks por sí
# mismo. Si se necesita investigar una regresión futura, puede configurarse un
# override explícito distinto mediante DEUNA_YTDLP_YOUTUBE_CLIENTS.
args=()
youtube_url=0
while (( $# > 0 )); do
  case "$1" in
    --js-runtimes|--remote-components)
      shift
      if (( $# > 0 )); then shift; fi
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
      # La versión anterior imponía 1 s entre cada petición de YouTube. Además
      # de volver muy lenta la preparación, ya no es necesario como política
      # general. Preservamos cualquier valor explícito que no sea ese legado.
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
  # EJS + Node siguen siendo necesarios para los desafíos modernos de YouTube.
  YOUTUBE_ARGS+=(
    --js-runtimes "node:${NODE_BIN}"
    --remote-components "ejs:github"
  )

  # Migración automática de la configuración que DeUna recomendaba antes.
  # Ese par se considera "auto" para no seguir forzando web_embedded en 2026.
  if [[ "${YOUTUBE_CLIENTS}" == "default,web_embedded" || "${YOUTUBE_CLIENTS}" == "auto" ]]; then
    YOUTUBE_CLIENTS=""
  fi

  if [[ -n "${YOUTUBE_CLIENTS}" ]]; then
    YOUTUBE_ARGS+=(
      --extractor-args "youtube:player_client=${YOUTUBE_CLIENTS}"
    )
  fi
fi

exec "${YTDLP_BIN}" \
  "${YOUTUBE_ARGS[@]}" \
  "${COOKIE_ARGS[@]}" \
  "${args[@]}"
