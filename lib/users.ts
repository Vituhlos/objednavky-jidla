import crypto from "crypto";
import { getDb } from "@/lib/db";

export type UserRole = "admin" | "user";

export interface UserRow {
  id: number;
  email: string | null;
  firstName: string;
  lastName: string;
  name: string | null;          // legacy display name (OIDC profile)
  avatarUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  active: boolean;
  defaultDepartment: string | null;
  emailOrderConfirmation: boolean;
  passwordHash: string | null;
  createdAt: string;
  lastLoginAt: string;
}

// ── Password hashing (scrypt) ─────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// ── Row mapping ──────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): UserRow {
  return {
    id: r.id as number,
    email: (r.email as string | null) ?? null,
    firstName: (r.first_name as string) ?? "",
    lastName: (r.last_name as string) ?? "",
    name: (r.name as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    role: r.role === "admin" ? "admin" : "user",
    emailVerified: (r.email_verified as number) === 1,
    active: (r.active as number) === 1,
    defaultDepartment: (r.default_department as string | null) ?? null,
    emailOrderConfirmation: (r.email_order_confirmation as number) !== 0,
    passwordHash: (r.password_hash as string | null) ?? null,
    createdAt: (r.created_at as string) ?? "",
    lastLoginAt: (r.last_login_at as string) ?? "",
  };
}

// ── Admin helpers ────────────────────────────────────────────────────────────

function adminEmailsFromEnv(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function shouldBeAdmin(email: string | null, existingActiveCount: number): boolean {
  if (email && adminEmailsFromEnv().has(email.toLowerCase())) return true;
  return existingActiveCount === 0; // první registrovaný = admin
}

// ── Lookups ──────────────────────────────────────────────────────────────────

export function getUserById(id: number): UserRow | null {
  const r = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? mapRow(r) : null;
}

export function getUserByEmail(email: string): UserRow | null {
  const r = getDb()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(email.trim()) as Record<string, unknown> | undefined;
  return r ? mapRow(r) : null;
}

export function listUsers(): UserRow[] {
  return (getDb().prepare("SELECT * FROM users ORDER BY created_at").all() as Record<string, unknown>[]).map(mapRow);
}

// ── Provider accounts (linking) ──────────────────────────────────────────────

export function linkProviderAccount(userId: number, provider: string, providerAccountId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO accounts (user_id, provider, provider_account_id) VALUES (?, ?, ?)")
    .run(userId, provider, providerAccountId);
}

export function getLinkedProviders(userId: number): string[] {
  const rows = getDb()
    .prepare("SELECT provider FROM accounts WHERE user_id = ?")
    .all(userId) as { provider: string }[];
  return rows.map((r) => r.provider);
}

export function getUserByProviderAccount(provider: string, providerAccountId: string): UserRow | null {
  const r = getDb()
    .prepare(
      `SELECT u.* FROM users u
       JOIN accounts a ON a.user_id = u.id
       WHERE a.provider = ? AND a.provider_account_id = ?`
    )
    .get(provider, providerAccountId) as Record<string, unknown> | undefined;
  return r ? mapRow(r) : null;
}

// ── Credentials provider — verify login ──────────────────────────────────────

export interface VerifyResult {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export function verifyUserPassword(email: string, password: string): VerifyResult | null {
  const user = getUserByEmail(email);
  if (!user || !user.active || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  // Update last login
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  return {
    id: user.id,
    email: user.email ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

// ── Credentials provider — registration ──────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  defaultDepartment?: string;
}

export function registerCredentialsUser(input: RegisterInput): { id: number; role: UserRole } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const existing = getUserByEmail(email);
  if (existing) {
    // Reaktivovat deaktivovaný účet? Pokud má active=0 a žádné password_hash → ano.
    // Jinak vyhodit chybu, ať user použije login / reset hesla.
    if (existing.active) throw new Error("Tento e-mail je již registrovaný. Použij přihlášení.");
    if (existing.passwordHash) throw new Error("Tento e-mail je již registrovaný. Použij přihlášení nebo zapomenuté heslo.");
    // Reaktivace + nastavení hesla
    db.prepare(
      "UPDATE users SET first_name = ?, last_name = ?, password_hash = ?, active = 1, default_department = ?, email_verified = 0, provider = 'credentials', subject = ? WHERE id = ?"
    ).run(input.firstName.trim(), input.lastName.trim(), hashPassword(input.password), input.defaultDepartment ?? null, email, existing.id);
    return { id: existing.id, role: existing.role };
  }

  const existingActiveCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE active = 1").get() as { c: number }).c;
  const role: UserRole = shouldBeAdmin(email, existingActiveCount) ? "admin" : "user";
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  const result = db
    .prepare(
      `INSERT INTO users (provider, subject, email, name, first_name, last_name, password_hash, role, default_department, email_verified, active, last_login_at)
       VALUES ('credentials', ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'))`
    )
    .run(
      email,                          // subject = email pro Credentials
      email,
      fullName || null,
      input.firstName.trim(),
      input.lastName.trim(),
      hashPassword(input.password),
      role,
      input.defaultDepartment ?? null,
    );

  const userId = result.lastInsertRowid as number;
  linkProviderAccount(userId, "credentials", email);
  return { id: userId, role };
}

// ── OAuth provider — auto-link by email ──────────────────────────────────────

export interface OAuthInput {
  provider: string;          // 'google', 'microsoft', 'apple'
  providerAccountId: string; // sub (unique within provider)
  email: string;
  emailVerified: boolean;    // provider potvrdil email
  name: string | null;
  avatarUrl: string | null;
}

export function upsertUserFromOAuth(input: OAuthInput): { id: number; role: UserRole } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  // 1. Existuje uživatel přes tento account?
  const byAccount = getUserByProviderAccount(input.provider, input.providerAccountId);
  if (byAccount) {
    db.prepare("UPDATE users SET last_login_at = datetime('now'), avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
      .run(input.avatarUrl, byAccount.id);
    return { id: byAccount.id, role: byAccount.role };
  }

  // 2. Auto-link by email — pokud OAuth provider ověřil email a existuje user se stejným emailem
  if (input.emailVerified && email) {
    const byEmail = getUserByEmail(email);
    if (byEmail && byEmail.active) {
      // Přilinkovat tento provider k existujícímu účtu
      linkProviderAccount(byEmail.id, input.provider, input.providerAccountId);
      db.prepare("UPDATE users SET last_login_at = datetime('now'), email_verified = 1, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
        .run(input.avatarUrl, byEmail.id);
      return { id: byEmail.id, role: byEmail.role };
    }
  }

  // 3. Vytvořit nový účet
  const existingActiveCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE active = 1").get() as { c: number }).c;
  const role: UserRole = shouldBeAdmin(email, existingActiveCount) ? "admin" : "user";
  // Pokus o rozdělení jména: "Petr Novák" → first=Petr, last=Novák
  const parts = (input.name ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  const result = db
    .prepare(
      `INSERT INTO users (provider, subject, email, name, first_name, last_name, avatar_url, role, email_verified, active, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
    )
    .run(
      input.provider,
      input.providerAccountId,
      email || null,
      input.name,
      firstName,
      lastName,
      input.avatarUrl,
      role,
      input.emailVerified ? 1 : 0,
    );

  const userId = result.lastInsertRowid as number;
  linkProviderAccount(userId, input.provider, input.providerAccountId);
  return { id: userId, role };
}

// ── Admin actions ────────────────────────────────────────────────────────────

export function setUserRole(userId: number, role: UserRole): void {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export function setUserActive(userId: number, active: boolean): void {
  getDb().prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, userId);
  if (!active) {
    // Při deaktivaci zrušit i všechny sessions (JWT nelze invalidovat — ale next-auth check active při getUserById vykrátí)
  }
}

export function updateUserProfile(userId: number, updates: {
  firstName?: string;
  lastName?: string;
  defaultDepartment?: string | null;
  emailOrderConfirmation?: boolean;
  email?: string;
}): void {
  const sets: string[] = [];
  const vals: (string | null)[] = [];
  if (updates.firstName !== undefined) { sets.push("first_name = ?"); vals.push(updates.firstName.trim()); }
  if (updates.lastName !== undefined) { sets.push("last_name = ?"); vals.push(updates.lastName.trim()); }
  if (updates.defaultDepartment !== undefined) { sets.push("default_department = ?"); vals.push(updates.defaultDepartment); }
  if (updates.emailOrderConfirmation !== undefined) { sets.push("email_order_confirmation = ?"); vals.push(updates.emailOrderConfirmation ? "1" : "0"); }
  if (updates.email !== undefined) {
    const newEmail = updates.email.trim().toLowerCase();
    const existing = getUserByEmail(newEmail);
    if (existing && existing.id !== userId) throw new Error("Tento e-mail už používá někdo jiný.");
    sets.push("email = ?"); vals.push(newEmail);
    sets.push("email_verified = 0");
  }
  if (sets.length === 0) return;
  vals.push(String(userId));
  getDb().prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function changeUserPassword(userId: number, oldPassword: string, newPassword: string): void {
  const user = getUserById(userId);
  if (!user || !user.passwordHash) throw new Error("Účet nemá heslo (přihlášení přes Google?).");
  if (!verifyPassword(oldPassword, user.passwordHash)) throw new Error("Současné heslo nesouhlasí.");
  if (newPassword.length < 6) throw new Error("Nové heslo musí mít alespoň 6 znaků.");
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), userId);
}

export function setUserPasswordFromReset(userId: number, newPassword: string): void {
  if (newPassword.length < 6) throw new Error("Heslo musí mít alespoň 6 znaků.");
  getDb().prepare("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?").run(hashPassword(newPassword), userId);
}

// ── Verification + reset tokens ──────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createEmailVerificationToken(userId: number): string {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Invalidovat předchozí
  getDb().prepare("UPDATE email_verification_tokens SET used = 1 WHERE user_id = ? AND used = 0").run(userId);
  getDb()
    .prepare("INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
    .run(userId, token, expiresAt);
  return token;
}

export function consumeEmailVerificationToken(token: string): number | null {
  const row = getDb()
    .prepare("SELECT user_id FROM email_verification_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0")
    .get(token) as { user_id: number } | undefined;
  if (!row) return null;
  getDb().prepare("UPDATE email_verification_tokens SET used = 1 WHERE token = ?").run(token);
  getDb().prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
  return row.user_id;
}

export function createPasswordResetToken(userId: number): string {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  getDb().prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").run(userId);
  getDb()
    .prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
    .run(userId, token, expiresAt);
  return token;
}

export function validatePasswordResetToken(token: string): number | null {
  const row = getDb()
    .prepare("SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0")
    .get(token) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export function consumePasswordResetToken(token: string): void {
  getDb().prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?").run(token);
}

