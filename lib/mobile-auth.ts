import crypto from "crypto";
import { getDb } from "@/lib/db";
import { getUserById, type UserRow } from "@/lib/users";
import {
  accessTokenExpiresIn,
  extractBearerToken,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/mobile-jwt";
import type { UserProfile } from "@/lib/mobile-user";
import { toUserProfile } from "@/lib/mobile-user";

const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function refreshExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DAYS);
  return d.toISOString();
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
};

export type MobileSession = {
  userId: number;
  role: "admin" | "user";
  sessionVersion: number;
};

export function issueTokenPair(user: UserRow): TokenResponse {
  const refreshToken = generateRefreshToken();
  getDb()
    .prepare(
      "INSERT INTO mobile_refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    )
    .run(user.id, hashToken(refreshToken), refreshExpiresAt());

  return {
    accessToken: signAccessToken(user.id, user.role, user.sessionVersion),
    refreshToken,
    expiresIn: accessTokenExpiresIn(),
    user: toUserProfile(user),
  };
}

export function refreshTokenPair(refreshToken: string): TokenResponse | null {
  const row = getDb()
    .prepare(
      `SELECT id, user_id, expires_at, revoked FROM mobile_refresh_tokens WHERE token_hash = ?`,
    )
    .get(hashToken(refreshToken)) as
    | { id: number; user_id: number; expires_at: string; revoked: number }
    | undefined;

  if (!row || row.revoked === 1) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const user = getUserById(row.user_id);
  if (!user || !user.active) return null;

  // Rotate refresh token
  getDb().prepare("UPDATE mobile_refresh_tokens SET revoked = 1 WHERE id = ?").run(row.id);
  return issueTokenPair(user);
}

export function revokeRefreshToken(refreshToken: string): void {
  getDb()
    .prepare("UPDATE mobile_refresh_tokens SET revoked = 1 WHERE token_hash = ?")
    .run(hashToken(refreshToken));
}

export function revokeAllRefreshTokens(userId: number): void {
  getDb()
    .prepare("UPDATE mobile_refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0")
    .run(userId);
}

export function requireMobileSession(request: Request): MobileSession | null {
  const bearer = extractBearerToken(request);
  if (!bearer) return null;

  const payload = verifyAccessToken(bearer);
  if (!payload) return null;

  const user = getUserById(payload.sub);
  if (!user || !user.active) return null;
  if (user.sessionVersion !== payload.sv) return null;

  return {
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}
