#!/usr/bin/env bash
set -euo pipefail

YTDLP_BIN="${DEUNA_YTDLP_BINARY:-/usr/bin/yt-dlp}"
NODE_BIN="${DEUNA_NODE_BINARY:-/usr/bin/node}"

if [[ ! -x "${YTDLP_BIN}" ]]; then
  echo "yt-dlp no está disponible en ${YTDLP_BIN}." >&2
  exit 127
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  echo "Node no está disponible en ${NODE_BIN}; YouTube requiere Node 22 o superior o Deno para resolver sus desafíos JavaScript." >&2
  exit 127
fi

exec "${YTDLP_BIN}" \
  --js-runtimes "node:${NODE_BIN}" \
  --remote-components "ejs:github" \
  "$@"
