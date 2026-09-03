export const ADMIN_ROLES = ["owner", "admin"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.includes(value as AdminRole);
}
