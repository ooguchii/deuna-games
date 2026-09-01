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

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js no está instalado o no está en PATH." >&2
  exit 1
fi

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
echo "[OK] Worker multimedia instalado."
if command -v yt-dlp >/dev/null 2>&1; then
  echo "[OK] yt-dlp detectado: $(command -v yt-dlp)"
  yt-dlp --version || true
else
  echo "[AVISO] Falta yt-dlp. Instálalo/actualízalo antes de habilitar el worker."
fi

echo ""
echo "Siguientes pasos:"
echo "1. Genera un token: openssl rand -hex 32"
echo "2. Colócalo como DEUNA_MEDIA_IMPORT_WORKER_TOKEN en ${ENV_TARGET}."
echo "3. Copia el mismo token a /etc/deuna-games/runtime.env."
echo "4. En runtime.env usa: DEUNA_MEDIA_IMPORT_WORKER_URL=http://127.0.0.1:3101/source"
echo "5. Ajusta DEUNA_YTDLP_PATH en ${ENV_TARGET} a: $(command -v yt-dlp 2>/dev/null || echo /usr/local/bin/yt-dlp)"
echo "6. Ejecuta: systemctl enable --now deuna-games-media-import.service"
echo "7. Verifica: systemctl status deuna-games-media-import.service --no-pager"
