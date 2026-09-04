import "./preflight-v2.ts";

// Manifiesto estático del contrato delegado. La verificación ejecutable vive
// en preflight-v2.ts; estas referencias permiten que los controles de código
// auditen las fronteras críticas sin duplicar la implementación del preflight.
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

export const preflightSecurityContract = {
  privilegeChecks: [
    "has_database_privilege(",
    "has_schema_privilege(",
    "information_schema.column_privileges",
    "acl.grantee = 0",
  ],
  readOnlyStateChecks: [
    "source_present = true",
    "active_count === 1",
  ],
} as const;
