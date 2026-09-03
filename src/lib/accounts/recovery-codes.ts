import {
  createHash,
  randomBytes,
} from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_CHARACTERS = 12;
const DEFAULT_CODE_COUNT = 8;

function generateRawCode() {
  const bytes = randomBytes(CODE_CHARACTERS);
  let code = "";

  for (const value of bytes) {
    code += ALPHABET[value & 31];
  }

  return code;
}

export function normalizeRecoveryCode(code: string) {
  return code
    .normalize("NFKC")
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256")
    .update(normalizeRecoveryCode(code), "utf8")
    .digest("hex");
}

export function createRecoveryCodes(
  count = DEFAULT_CODE_COUNT
) {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("La cantidad de códigos de recuperación no es válida.");
  }

  return Array.from({ length: count }, () => {
    const raw = generateRawCode();
    const plain = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;

    return {
      plain,
      hash: hashRecoveryCode(plain),
    };
  });
}
