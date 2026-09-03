#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'
umask 027

readonly SERVICE_USER="${DEUNA_SERVICE_USER:-deuna-games}"
readonly SERVICE_GROUP="${DEUNA_SERVICE_GROUP:-deuna-games}"
readonly STATE_ROOT="/var/lib/deuna-games"
readonly MEDIA_ROOT="${STATE_ROOT}/editorial-media"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] ||
  fail "Este preparador debe ejecutarse con sudo o como root."

command -v getent >/dev/null 2>&1 ||
  fail "Falta el comando getent."
command -v install >/dev/null 2>&1 ||
  fail "Falta el comando install."

getent passwd "${SERVICE_USER}" >/dev/null ||
  fail "No existe el usuario de servicio ${SERVICE_USER}."
getent group "${SERVICE_GROUP}" >/dev/null ||
  fail "No existe el grupo de servicio ${SERVICE_GROUP}."

for candidate in "${STATE_ROOT}" "${MEDIA_ROOT}"; do
  if [[ -L "${candidate}" ]]; then
    fail "${candidate} no puede ser un enlace simbólico."
  fi

  if [[ -e "${candidate}" && ! -d "${candidate}" ]]; then
    fail "${candidate} existe pero no es un directorio."
  fi
done

install \
  -d \
  -o "${SERVICE_USER}" \
  -g "${SERVICE_GROUP}" \
  -m 0750 \
  -- \
  "${STATE_ROOT}" \
  "${MEDIA_ROOT}"

[[ -d "${MEDIA_ROOT}" && ! -L "${MEDIA_ROOT}" ]] ||
  fail "No se pudo preparar el almacén multimedia seguro."

printf '%s\n' \
  "[OK] Almacén multimedia persistente preparado en ${MEDIA_ROOT}."
printf '%s\n' \
  "[OK] Propietario: ${SERVICE_USER}:${SERVICE_GROUP}; modo: 0750."
