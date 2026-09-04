import "./preflight-v2.ts";

// Manifiesto estático de privacidad. La verificación ejecutable vive en
// preflight-v2.ts; estas referencias mantienen visible para los controles de
// código qué borrados son deliberadamente removibles por el usuario y qué
// tablas de Rewards permanecen bajo política de columnas explícitas.
export const preflightPrivacyContract = {
  removableAccountData: [
    "deuna_accounts.users",
    "deuna_accounts.recovery_codes",
    "deuna_accounts.game_preferences",
    "deuna_accounts.hardware_profiles",
  ],
  explicitColumnPolicies: [
    'expectColumns("deuna_accounts", "reward_profiles"',
    'expectColumns("deuna_accounts", "reward_events"',
  ],
} as const;
