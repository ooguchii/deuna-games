import { z } from "zod";

import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
} from "./password";

export const ACCOUNT_USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(maxLength).optional()
  );
}

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    return normalized === "" ? undefined : normalized;
  },
  z.string().email().max(254).optional()
);

export const accountUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(ACCOUNT_USERNAME_PATTERN);

export const accountRegistrationSchema = z.object({
  username: accountUsernameSchema,
  password: z
    .string()
    .min(ACCOUNT_PASSWORD_MIN_LENGTH)
    .max(ACCOUNT_PASSWORD_MAX_LENGTH),
  displayName: optionalTrimmedString(80),
  email: optionalEmailSchema,
  bio: optionalTrimmedString(500),
});

export const accountLoginSchema = z.object({
  username: accountUsernameSchema,
  password: z.string().min(1).max(ACCOUNT_PASSWORD_MAX_LENGTH),
});

export const accountRecoverySchema = z.object({
  username: accountUsernameSchema,
  recoveryCode: z.string().trim().min(12).max(32),
  newPassword: z
    .string()
    .min(ACCOUNT_PASSWORD_MIN_LENGTH)
    .max(ACCOUNT_PASSWORD_MAX_LENGTH),
});

export const accountProfileSchema = z.object({
  displayName: optionalTrimmedString(80),
  email: optionalEmailSchema,
  bio: optionalTrimmedString(500),
});

export function normalizeAccountUsername(username: string) {
  return username
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}
