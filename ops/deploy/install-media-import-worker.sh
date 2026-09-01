#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[ERROR] Ejecuta este instalador con sudo/root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
WORKER_SOURCE="${REPO_ROOT}/ops/worker/media-import-worker.mjs"
SERVICE_SOURCE="${REPO_ROOT}/ops/systemd/deuna-games-media-import.service.example"
ENV_SOURCE="${REPO_ROOT}/ops/systemd/media-import.env.example"
INSTALL_DIR="/usr/local/lib/deuna-games"
WORKER_TARGET="${INSTALL_DIR}/media-import-worker.mjs"
SERVICE_TARGET="/etc/systemd/system/deuna-games-media-import.service"
ENV_TARGET="/etc/deuna-games/media-import.env"

for required in "${WORKER_SOURCE}" "${SERVICE_SOURCE}" "${ENV_SOURCE}"; do
  if [[ ! -f "${required}" ]]; then
    echo "[ERROR] Falta ${required}. Ejecuta desde una copia completa del repositorio." >&2
    exit 1
  fi
done

install -d -o root -g root -m 0755 "${INSTALL_DIR}"
install -o root -g root -m 0755 "${WORKER_SOURCE}" "${WORKER_TARGET}"
install -o root -g root -m 0644 "${SERVICE_SOURCE}" "${SERVICE_TARGET}"
install -d -o root -g root -m 0755 /etc/deuna-games

if [[ ! -e "${ENV_TARGET}" ]]; then
  install -o root -g root -m 0600 "${ENV_SOURCE}" "${ENV_TARGET}"
  echo "[INFO] Se creó ${ENV_TARGET} desde el ejemplo."
else
  echo "[INFO] Se conservó ${ENV_TARGET}; no se sobrescribieron secretos existentes."
fi

systemctl daemon-reload

echo ""
echo "[OK] Worker instalado, pero NO habilitado automáticamente."
echo "1. Instala/actualiza yt-dlp y confirma su ruta."
echo "2. Genera DEUNA_MEDIA_IMPORT_WORKER_TOKEN en ${ENV_TARGET}."
echo "3. Copia el mismo token a /etc/deuna-games/runtime.env."
echo "4. Ejecuta: systemctl enable --now deuna-games-media-import.service"
echo "5. Verifica: systemctl status deuna-games-media-import.service"
