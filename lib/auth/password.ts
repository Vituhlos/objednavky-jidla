import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_LOG_N = 17;
const SCRYPT_N = 2 ** SCRYPT_LOG_N;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 160 * 1024 * 1024;
const SALT_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 12;

const SCRYPT_OPTIONS = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: SCRYPT_MAX_MEMORY,
} as const;

function decodeBase64(value: string, expectedLength: number): Buffer | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== expectedLength || decoded.toString("base64") !== value) return null;
  return decoded;
}

export function checkPasswordStrength(plain: string): { ok: boolean; reason?: string } {
  if (typeof plain !== "string" || Array.from(plain).length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "Heslo musí mít alespoň 12 znaků." };
  }
  return { ok: true };
}

export function hashPassword(plain: string): string {
  const strength = checkPasswordStrength(plain);
  if (!strength.ok) throw new Error(strength.reason);

  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(plain, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_LOG_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    if (typeof plain !== "string" || typeof stored !== "string") return false;

    const parts = stored.split("$");
    if (parts.length !== 6) return false;

    const [algorithm, logN, r, p, encodedSalt, encodedExpected] = parts;
    if (
      algorithm !== "scrypt" ||
      logN !== String(SCRYPT_LOG_N) ||
      r !== String(SCRYPT_R) ||
      p !== String(SCRYPT_P)
    ) {
      return false;
    }

    const salt = decodeBase64(encodedSalt, SALT_LENGTH);
    const expected = decodeBase64(encodedExpected, SCRYPT_KEY_LENGTH);
    if (!salt || !expected) return false;

    const actual = scryptSync(plain, salt, expected.length, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    // Poškozený otisk nesmí shodit přihlášení ani prozradit interní chybu.
    return false;
  }
}
