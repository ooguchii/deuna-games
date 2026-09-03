import {
  createHash,
  randomBytes,
} from "node:crypto";

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createAccountSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function isValidAccountSessionToken(token: string) {
  return SESSION_TOKEN_PATTERN.test(token);
}

export function hashAccountSessionToken(token: string) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}
