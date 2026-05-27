import { getDb } from "@/lib/db";

export type UserRole = "admin" | "user";

export type UserRow = {
  id: number;
  provider: string;
  subject: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  last_login_at: string;
};

function adminEmailsFromEnv(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function shouldBeAdmin(email: string | null, existingCount: number): boolean {
  if (email && adminEmailsFromEnv().has(email.toLowerCase())) return true;
  return existingCount === 0;
}

export function upsertUserFromOidc(input: {
  provider: string;
  subject: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}): Pick<UserRow, "id" | "role"> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const existingCount = (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }).c;
  const initialRole: UserRole = shouldBeAdmin(input.email, existingCount) ? "admin" : "user";

  db.prepare(`
    INSERT INTO users (provider, subject, email, name, avatar_url, role, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, subject) DO UPDATE SET
      email = COALESCE(excluded.email, users.email),
      name = COALESCE(excluded.name, users.name),
      avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
      last_login_at = excluded.last_login_at
  `).run(
    input.provider,
    input.subject,
    input.email,
    input.name,
    input.avatarUrl,
    initialRole,
    nowIso,
  );

  if (input.email && adminEmailsFromEnv().has(input.email.toLowerCase())) {
    db.prepare(`UPDATE users SET role = 'admin' WHERE provider = ? AND subject = ?`).run(
      input.provider,
      input.subject,
    );
  }

  const row = db.prepare(`
    SELECT id, role
    FROM users
    WHERE provider = ? AND subject = ?
  `).get(input.provider, input.subject) as { id: number; role: string } | undefined;

  if (!row) throw new Error("User upsert failed.");

  const role = row.role === "admin" ? "admin" : "user";
  return { id: row.id, role };
}

export function listUsers(): UserRow[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM users ORDER BY created_at ASC`).all() as UserRow[];
}

export function setUserRole(userId: number, role: UserRole): void {
  const db = getDb();
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, userId);
}

export function getUserById(id: number): UserRow | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  return row ?? null;
}

