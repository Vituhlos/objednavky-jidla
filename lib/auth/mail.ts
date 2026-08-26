import { getDb } from "../db";
import { logAudit } from "../audit";
import { sendEmail } from "../email";
import { hashPassword } from "./password";
import { hashToken, newToken } from "./tokens";

const RESET_TTL_MS = 15 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_PATH = "/ucet/obnovit-heslo";
const VERIFY_PATH = "/ucet/overit-email";

function requireId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} není platné.`);
}

function isTokenShapeValid(token: string): boolean {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

function canonicalOrigin(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Veřejná adresa aplikace není platná.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Veřejná adresa aplikace není platná.");
  }
  const localHttp =
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHttp)) {
    throw new Error("Veřejná adresa aplikace musí používat HTTPS.");
  }
  return url.origin;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function issueLoginToken(userId: number, purpose: "reset" | "verify", ttlMs: number): {
  token: string;
  hash: string;
} {
  const db = getDb();
  const issued = newToken();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.transaction(() => {
    // Nový odkaz nahrazuje starší, aby uživatel neměl současně několik
    // funkčních tajemství pro stejnou operaci.
    db.prepare(
      "UPDATE login_tokens SET used_at = datetime('now') WHERE user_id = ? AND purpose = ? AND used_at IS NULL"
    ).run(userId, purpose);
    db.prepare(
      "INSERT INTO login_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)"
    ).run(userId, purpose, issued.hash, expiresAt);
  })();
  return issued;
}

function invalidateIssuedToken(hash: string): void {
  getDb()
    .prepare("UPDATE login_tokens SET used_at = datetime('now') WHERE token_hash = ? AND used_at IS NULL")
    .run(hash);
}

function relativeLink(pathname: string, token: string): string {
  const params = new URLSearchParams({ token });
  return `${pathname}?${params.toString()}`;
}

export function createResetLinkForUser(userId: number): string {
  requireId(userId, "Uživatel");
  const user = getDb()
    .prepare("SELECT name, status FROM users WHERE id = ?")
    .get(userId) as { name: string; status: "active" | "blocked" } | undefined;
  if (!user || user.status !== "active") throw new Error("Aktivní uživatel neexistuje.");

  const issued = issueLoginToken(userId, "reset", RESET_TTL_MS);
  logAudit({
    action: "password_reset_request",
    personName: user.name,
    details: `uživatel #${userId}, odkaz správce`,
  });
  return relativeLink(RESET_PATH, issued.token);
}

export async function sendVerificationEmail(userId: number, baseUrl: string): Promise<void> {
  requireId(userId, "Uživatel");
  const origin = canonicalOrigin(baseUrl);
  const user = getDb()
    .prepare(
      "SELECT email, name, status, email_verified_at AS verifiedAt FROM users WHERE id = ?"
    )
    .get(userId) as
    | { email: string; name: string; status: "active" | "blocked"; verifiedAt: string | null }
    | undefined;
  if (!user) throw new Error("Uživatel neexistuje.");
  if (user.status !== "active") throw new Error("Zablokovanému účtu nelze poslat ověření.");
  if (user.verifiedAt !== null) return;

  const issued = issueLoginToken(userId, "verify", VERIFY_TTL_MS);
  const link = new URL(relativeLink(VERIFY_PATH, issued.token), origin).href;
  const safeName = escapeHtml(user.name);
  const safeLink = escapeHtml(link);
  try {
    await sendEmail({
      to: [user.email],
      subject: "Ověření e-mailu – Kantýna",
      text: `Dobrý den, ${user.name},\n\nověřte svůj e-mail tímto odkazem:\n${link}\n\nOdkaz platí 24 hodin.`,
      html: `<p>Dobrý den, ${safeName},</p><p>ověřte svůj e-mail tímto odkazem:</p><p><a href="${safeLink}">Ověřit e-mail</a></p><p>Odkaz platí 24 hodin.</p>`,
    });
  } catch (error) {
    invalidateIssuedToken(issued.hash);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, baseUrl: string): Promise<void> {
  const origin = canonicalOrigin(baseUrl);
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = getDb()
    .prepare(
      "SELECT id, email, name FROM users WHERE email_normalized = ? AND status = 'active'"
    )
    .get(normalized) as { id: number; email: string; name: string } | undefined;
  if (!user) return;

  const issued = issueLoginToken(user.id, "reset", RESET_TTL_MS);
  const link = new URL(relativeLink(RESET_PATH, issued.token), origin).href;
  const safeName = escapeHtml(user.name);
  const safeLink = escapeHtml(link);
  try {
    await sendEmail({
      to: [user.email],
      subject: "Obnova hesla – Kantýna",
      text: `Dobrý den, ${user.name},\n\nnové heslo si nastavíte tímto jednorázovým odkazem:\n${link}\n\nOdkaz platí 15 minut. Pokud jste o změnu nežádali, zprávu ignorujte.`,
      html: `<p>Dobrý den, ${safeName},</p><p>nové heslo si nastavíte tímto jednorázovým odkazem:</p><p><a href="${safeLink}">Nastavit nové heslo</a></p><p>Odkaz platí 15 minut. Pokud jste o změnu nežádali, zprávu ignorujte.</p>`,
    });
  } catch (error) {
    invalidateIssuedToken(issued.hash);
    throw error;
  }

  logAudit({
    action: "password_reset_request",
    personName: user.name,
    details: `uživatel #${user.id}, e-mail`,
  });
}

export function consumeVerificationToken(token: string): number {
  if (!isTokenShapeValid(token)) throw new Error("Ověřovací odkaz není platný.");
  const db = getDb();
  let userId = 0;
  let name = "";
  db.transaction(() => {
    const row = db
      .prepare(`
        SELECT t.id, t.user_id AS userId, u.name
        FROM login_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.purpose = 'verify'
          AND t.used_at IS NULL
          AND julianday(t.expires_at) > julianday('now')
          AND u.status = 'active'
      `)
      .get(hashToken(token)) as { id: number; userId: number; name: string } | undefined;
    if (!row) throw new Error("Ověřovací odkaz není platný.");
    const used = db
      .prepare("UPDATE login_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL")
      .run(row.id);
    if (used.changes !== 1) throw new Error("Ověřovací odkaz není platný.");
    db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(row.userId);
    userId = row.userId;
    name = row.name;
  })();

  logAudit({ action: "email_verify", personName: name, details: `uživatel #${userId}` });
  return userId;
}

export function resetPasswordWithToken(token: string, newPlain: string): number {
  if (!isTokenShapeValid(token)) throw new Error("Odkaz pro obnovu hesla není platný.");
  // Náročný výpočet proběhne před zápisovým zámkem databáze.
  const passwordHash = hashPassword(newPlain);
  const db = getDb();
  let userId = 0;
  let name = "";
  db.transaction(() => {
    const row = db
      .prepare(`
        SELECT t.id, t.user_id AS userId, u.name
        FROM login_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.purpose = 'reset'
          AND t.used_at IS NULL
          AND julianday(t.expires_at) > julianday('now')
          AND u.status = 'active'
      `)
      .get(hashToken(token)) as { id: number; userId: number; name: string } | undefined;
    if (!row) throw new Error("Odkaz pro obnovu hesla není platný.");
    const used = db
      .prepare("UPDATE login_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL")
      .run(row.id);
    if (used.changes !== 1) throw new Error("Odkaz pro obnovu hesla není platný.");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, row.userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.userId);
    db.prepare(
      "UPDATE settings SET value = '0' WHERE key = 'auth_bootstrap_password_unchanged' AND (SELECT value FROM settings WHERE key = 'auth_bootstrap_user_id') = ?"
    ).run(String(row.userId));
    userId = row.userId;
    name = row.name;
  })();

  logAudit({ action: "password_change", personName: name, details: `uživatel #${userId}, obnova` });
  return userId;
}
