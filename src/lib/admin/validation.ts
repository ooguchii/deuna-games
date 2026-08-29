import { z } from "zod";

export const ADMIN_USERNAME_PATTERN =
  /^[a-zA-Z0-9._-]+$/;

export const adminUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(ADMIN_USERNAME_PATTERN);

export const adminLoginSchema = z.object({
  username: adminUsernameSchema,
  password: z
    .string()
    .min(1)
    .max(128),
});

export function normalizeAdminUsername(
  username: string
) {
  return username
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}
