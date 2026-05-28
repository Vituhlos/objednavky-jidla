import crypto from "crypto";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/users";
import { issueTokenPair } from "@/lib/mobile-auth";

const PAIRING_TTL_SEC = 120;

export type PairingQrResponse = {
  pairingId: string;
  token: string;
  expiresAt: string;
  qrPayload: string;
  deepLink: string;
};

function pairingExpiresAt(): string {
  return new Date(Date.now() + PAIRING_TTL_SEC * 1000).toISOString();
}

export function createPairingToken(userId: number): PairingQrResponse {
  const pairingId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = pairingExpiresAt();
  const qrPayload = `kantyna://pair?v=1&token=${token}`;

  getDb()
    .prepare(
      `INSERT INTO mobile_pairing_tokens (id, user_id, token, status, expires_at) VALUES (?, ?, ?, 'pending', ?)`,
    )
    .run(pairingId, userId, token, expiresAt);

  return {
    pairingId,
    token,
    expiresAt,
    qrPayload,
    deepLink: qrPayload,
  };
}

export function getPairingQrPayload(pairingId: string, userId: number): string | null {
  const row = getDb()
    .prepare("SELECT user_id, token, status, expires_at FROM mobile_pairing_tokens WHERE id = ?")
    .get(pairingId) as { user_id: number; token: string; status: string; expires_at: string } | undefined;

  if (!row || row.user_id !== userId) return null;
  if (row.status !== "pending" || new Date(row.expires_at).getTime() < Date.now()) return null;
  return `kantyna://pair?v=1&token=${row.token}`;
}

export function getPairingStatus(pairingId: string, userId: number): "pending" | "consumed" | "expired" | null {
  const row = getDb()
    .prepare("SELECT user_id, status, expires_at FROM mobile_pairing_tokens WHERE id = ?")
    .get(pairingId) as { user_id: number; status: string; expires_at: string } | undefined;

  if (!row || row.user_id !== userId) return null;
  if (row.status === "consumed") return "consumed";
  if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

export function consumePairingToken(token: string) {
  const row = getDb()
    .prepare(
      `SELECT id, user_id, status, expires_at FROM mobile_pairing_tokens WHERE token = ?`,
    )
    .get(token) as
    | { id: string; user_id: number; status: string; expires_at: string }
    | undefined;

  if (!row) return { error: "INVALID" as const };
  if (row.status === "consumed") return { error: "USED" as const };
  if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare("UPDATE mobile_pairing_tokens SET status = 'expired' WHERE id = ?").run(row.id);
    return { error: "EXPIRED" as const };
  }

  getDb()
    .prepare("UPDATE mobile_pairing_tokens SET status = 'consumed' WHERE id = ?")
    .run(row.id);

  const user = getUserById(row.user_id);
  if (!user || !user.active) return { error: "INVALID" as const };

  return { tokens: issueTokenPair(user) };
}
