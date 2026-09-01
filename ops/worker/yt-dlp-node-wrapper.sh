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

# El worker puede declarar --js-runtimes para funcionar también sin este wrapper.
# Aquí eliminamos cualquier declaración previa y fijamos una sola ruta absoluta a
# Node, evitando opciones duplicadas y diferencias de PATH bajo systemd.
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

exec "${YTDLP_BIN}" --js-runtimes "node:${NODE_BIN}" "${args[@]}"
