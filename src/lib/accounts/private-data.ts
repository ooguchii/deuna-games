import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const FORMAT = "aes256gcm-v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD = Buffer.from("deuna-account-email-v1", "utf8");

function getAccountDataKey() {
  const raw = process.env.DEUNA_ACCOUNT_DATA_KEY?.trim();

  if (!raw) {
    throw new Error(
      "Falta configurar la clave privada DEUNA_ACCOUNT_DATA_KEY para guardar datos opcionales cifrados."
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(raw, "base64url");
  } catch {
    throw new Error(
      "DEUNA_ACCOUNT_DATA_KEY debe ser una clave base64url válida."
    );
  }

  if (key.length !== 32) {
    throw new Error(
      "DEUNA_ACCOUNT_DATA_KEY debe representar exactamente 32 bytes."
    );
  }

  return key;
}

export function encryptOptionalAccountEmail(
  email: string | undefined
) {
  if (!email) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getAccountDataKey(),
    iv
  );
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptOptionalAccountEmail(
  encrypted: string | null
) {
  if (!encrypted) return null;

  const parts = encrypted.split(".");

  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error("El dato privado de cuenta no usa un formato admitido.");
  }

  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const ciphertext = Buffer.from(parts[3]!, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("El dato privado de cuenta está dañado.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getAccountDataKey(),
    iv
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
