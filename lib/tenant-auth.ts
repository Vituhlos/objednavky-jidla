import crypto from "crypto";
import { cookies } from "next/headers";
import { getTenantDb } from "./tenant-db";
import { getGlobalDb } from "./global-db";
import type { User } from "./auth";

export const COOKIE_NAME = "session_token";
export const SA_COOKIE_NAME = "sa_session_token";
const SESSION_DAYS = 30;

// ── Tenant sessions ──────────────────────────────────────────────────────────

export function createTenantSession(tenantSlug: string, userId: number): string {
  const db = getTenantDb(tenantSlug);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(userId, token, expiresAt);
  return token;
}

export function getTenantSessionUser(tenantSlug: string, token: string): User | null {
  const db = getTenantDb(tenantSlug);
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
              u.default_department, u.email_order_confirmation
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
    )
    .get(token) as Record<string, unknown> | undefined;
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

export function deleteTenantSession(tenantSlug: string, token: string): void {
  getTenantDb(tenantSlug)
    .prepare("DELETE FROM sessions WHERE token = ?")
    .run(token);
}

export async function requireTenantAccess(tenantSlug: string): Promise<User> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) throw new TenantAuthError("Unauthenticated");
  const user = getTenantSessionUser(tenantSlug, token);
  if (!user) throw new TenantAuthError("Unauthenticated");
  return user;
}

export async function requireTenantAdmin(tenantSlug: string): Promise<User> {
  const user = await requireTenantAccess(tenantSlug);
  if (user.role !== "admin") throw new TenantAuthError("Forbidden");
  return user;
}

// ── Super admin sessions ─────────────────────────────────────────────────────

export interface SuperAdmin {
  id: number;
  email: string;
}

export function createSuperAdminSession(adminId: number): string {
  const db = getGlobalDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    "INSERT INTO super_admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(adminId, token, expiresAt);
  return token;
}

export function getSuperAdminByToken(token: string): SuperAdmin | null {
  const row = getGlobalDb()
    .prepare(
      `SELECT a.id, a.email
       FROM super_admin_sessions s
       JOIN super_admins a ON a.id = s.admin_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as { id: number; email: string } | undefined;
  return row ?? null;
}

export function deleteSuperAdminSession(token: string): void {
  getGlobalDb()
    .prepare("DELETE FROM super_admin_sessions WHERE token = ?")
    .run(token);
}

export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const jar = await cookies();
  const token = jar.get(SA_COOKIE_NAME)?.value;
  if (!token) throw new TenantAuthError("Unauthenticated");
  const admin = getSuperAdminByToken(token);
  if (!admin) throw new TenantAuthError("Unauthenticated");
  return admin;
}

// ── Shared error type ────────────────────────────────────────────────────────

export class TenantAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAuthError";
  }
}
