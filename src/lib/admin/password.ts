import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

const PASSWORD_FORMAT = "scrypt-v1";
const SCRYPT_COST = 65_536;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY =
  96 * 1024 * 1024;
const SALT_BYTES = 16;
const DUMMY_SALT = Buffer.from(
  "deuna-admin-auth-dummy-salt-v1",
  "utf8"
);

export const ADMIN_PASSWORD_MIN_LENGTH = 16;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

function derivePasswordKey(
  password: string,
  salt: Buffer
) {
  return new Promise<Buffer>(
    (resolve, reject) => {
      scrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N: SCRYPT_COST,
          r: SCRYPT_BLOCK_SIZE,
          p: SCRYPT_PARALLELIZATION,
          maxmem: SCRYPT_MAX_MEMORY,
        },
        (error, key) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(key as Buffer);
        }
      );
    }
  );
}

export function validateAdminPassword(
  password: string
) {
  const issues: string[] = [];

  if (
    password.length <
    ADMIN_PASSWORD_MIN_LENGTH
  ) {
    issues.push(
      `Debe tener al menos ${ADMIN_PASSWORD_MIN_LENGTH} caracteres.`
    );
  }

  if (
    password.length >
      ADMIN_PASSWORD_MAX_LENGTH ||
    Buffer.byteLength(password, "utf8") > 256
  ) {
    issues.push(
      `No puede superar ${ADMIN_PASSWORD_MAX_LENGTH} caracteres.`
    );
  }

  if (!/[\p{L}]/u.test(password)) {
    issues.push("Debe contener al menos una letra.");
  }

  if (!/\p{N}/u.test(password)) {
    issues.push("Debe contener al menos un número.");
  }

  if (!/[^\p{L}\p{N}\s]/u.test(password)) {
    issues.push(
      "Debe contener al menos un símbolo."
    );
  }

  return issues;
}

export async function hashAdminPassword(
  password: string
) {
  const issues = validateAdminPassword(password);

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  const salt = randomBytes(SALT_BYTES);
  const key = await derivePasswordKey(
    password,
    salt
  );

  return [
    PASSWORD_FORMAT,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyAdminPassword(
  password: string,
  storedHash: string
) {
  const parts = storedHash.split("$");

  if (
    parts.length !== 6 ||
    parts[0] !== PASSWORD_FORMAT ||
    Number(parts[1]) !== SCRYPT_COST ||
    Number(parts[2]) !== SCRYPT_BLOCK_SIZE ||
    Number(parts[3]) !==
      SCRYPT_PARALLELIZATION
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(
      parts[4]!,
      "base64url"
    );
    const expected = Buffer.from(
      parts[5]!,
      "base64url"
    );

    if (
      salt.length !== SALT_BYTES ||
      expected.length !== SCRYPT_KEY_LENGTH
    ) {
      return false;
    }

    const actual = await derivePasswordKey(
      password,
      salt
    );

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function consumeDummyPasswordWork(
  password: string
) {
  const bounded = password.slice(
    0,
    ADMIN_PASSWORD_MAX_LENGTH
  );

  await derivePasswordKey(bounded, DUMMY_SALT);
}
