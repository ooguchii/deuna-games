#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"
COOKIES_FILE="${DEUNA_YTDLP_COOKIES_FILE:-}"
YOUTUBE_CLIENTS="${DEUNA_YTDLP_YOUTUBE_CLIENTS:-default,web_embedded}"

if [[ ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible en ${YTDLP_BIN}." >&2
  exit 127
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  echo "Node no está disponible en ${NODE_BIN}; YouTube requiere Node 22 o superior o Deno para resolver sus desafíos JavaScript." >&2
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

# El worker también puede declarar --js-runtimes. Eliminamos cualquier
# declaración entrante para fijar una sola ruta absoluta a Node bajo systemd.
args=()
skip_next=0
for arg in "$@"; do
  if (( skip_next )); then
    skip_next=0
    continue
  fi

  if [[ "${arg}" == "--js-runtimes" ]]; then
    skip_next=1
    continue
  fi

  if [[ "${arg}" == --js-runtimes=* ]]; then
    continue
  fi

  args+=("${arg}")
done

exec "${YTDLP_BIN}" \
  --js-runtimes "node:${NODE_BIN}" \
  --remote-components "ejs:github" \
  --extractor-args "youtube:player_client=${YOUTUBE_CLIENTS}" \
  --sleep-requests 1 \
  "${COOKIE_ARGS[@]}" \
  "${args[@]}"
