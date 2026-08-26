import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSettings } from "../settings";
import type { SessionInfo } from "./sessions";

export const PIN_COOKIE = "kantyna_pin";

const PROOF_TTL_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const MAC_CONTEXT = "kantyna-pin-proof-v1\0";
const MIN_SECRET_BYTES = 32;

interface PinProofPayload {
  version: 1;
  sessionId: number;
  userId: number;
  issuedAt: number;
  expiresAt: number;
}

function signingKey(): Buffer {
  const key = Buffer.from(process.env.COOKIE_SIGNING_SECRET ?? "", "utf8");
  if (key.length < MIN_SECRET_BYTES) {
    throw new Error("COOKIE_SIGNING_SECRET musí mít alespoň 32 bajtů.");
  }
  return key;
}

function pinFingerprint(): Buffer {
  return createHash("sha256").update(getSettings().settingsPin, "utf8").digest();
}

function signature(payload: string): Buffer {
  return createHmac("sha256", signingKey())
    .update(MAC_CONTEXT, "utf8")
    .update(pinFingerprint())
    .update(payload, "ascii")
    .digest();
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function issuePinProof(session: SessionInfo, now = Date.now()): string {
  const payload: PinProofPayload = {
    version: 1,
    sessionId: session.sessionId,
    userId: session.userId,
    issuedAt: now,
    expiresAt: now + PROOF_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyPinProof(
  value: string | undefined,
  session: SessionInfo,
  now = Date.now()
): boolean {
  if (!value || value.length > 768) return false;

  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) {
    return false;
  }

  let received: Buffer;
  let payload: PinProofPayload;
  try {
    received = Buffer.from(parts[1], "base64url");
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as PinProofPayload;
  } catch {
    return false;
  }

  if (received.length !== 32) return false;
  const expected = signature(parts[0]);
  if (!timingSafeEqual(expected, received)) return false;

  if (
    payload.version !== 1 ||
    !isPositiveSafeInteger(payload.sessionId) ||
    !isPositiveSafeInteger(payload.userId) ||
    !isPositiveSafeInteger(payload.issuedAt) ||
    !isPositiveSafeInteger(payload.expiresAt) ||
    payload.sessionId !== session.sessionId ||
    payload.userId !== session.userId ||
    payload.issuedAt > now + CLOCK_SKEW_MS ||
    payload.expiresAt <= now ||
    payload.expiresAt - payload.issuedAt !== PROOF_TTL_MS ||
    payload.expiresAt > now + PROOF_TTL_MS + CLOCK_SKEW_MS
  ) {
    return false;
  }

  return true;
}

export function pinCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: PROOF_TTL_MS / 1000,
  };
}
