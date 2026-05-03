import crypto from "crypto";
import { getDb } from "./db";
import { cookies } from "next/headers";

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  active: number;
  defaultDepartment: string | null;
  emailOrderConfirmation: boolean;
}

export const COOKIE_NAME = "session_token";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
}

export function createSession(userId: number): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)").run(userId, token, expiresAt);
  return token;
}

export function getSessionUser(token: string): User | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active, u.default_department, u.email_order_confirmation
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).get(token) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as number,
    email: row.email as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    role: row.role as "user" | "admin",
    active: row.active as number,
    defaultDepartment: row.default_department as string | null,
    emailOrderConfirmation: Boolean(row.email_order_confirmation),
  };
}

export function createPasswordResetToken(userId: number): string {
  const db = getDb();
  db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").run(userId);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)").run(userId, token, expiresAt);
  return token;
}

export function validatePasswordResetToken(token: string): number | null {
  const row = getDb().prepare(
    "SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0"
  ).get(token) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export function consumePasswordResetToken(token: string): void {
  getDb().prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?").run(token);
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUser(token);
}
