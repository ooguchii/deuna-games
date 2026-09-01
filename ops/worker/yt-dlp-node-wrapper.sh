#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"
COOKIES_FILE="${DEUNA_YTDLP_COOKIES_FILE:-}"

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

exec "${YTDLP_BIN}" \
  --js-runtimes "node:${NODE_BIN}" \
  --remote-components "ejs:github" \
  "${COOKIE_ARGS[@]}" \
  "$@"
