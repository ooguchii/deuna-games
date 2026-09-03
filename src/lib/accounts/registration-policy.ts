import "server-only";

/**
 * El registro de cuentas públicas debe ser una decisión explícita en producción.
 *
 * - Desarrollo/test: abierto por defecto para no romper el flujo local.
 * - Producción: cerrado por defecto hasta que el operador configure
 *   DEUNA_ACCOUNT_REGISTRATION_ENABLED=true.
 *
 * Login, recuperación y las cuentas existentes no dependen de este interruptor.
 */
export function isAccountRegistrationEnabled() {
  const configured = process.env.DEUNA_ACCOUNT_REGISTRATION_ENABLED
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env.NODE_ENV !== "production";
}
