import Database from "better-sqlite3";
import { runMigrations } from "../../lib/migrations";
import { TENANT_MIGRATIONS } from "../../lib/tenant-db";
import { hashPassword } from "../../lib/auth";

export function createTestTenantDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db, TENANT_MIGRATIONS);
  return db;
}

export function seedUser(
  db: Database.Database,
  opts: { email: string; role?: "user" | "admin" }
): number {
  const result = db
    .prepare(
      "INSERT INTO users (email, first_name, last_name, password_hash, role) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      opts.email,
      "Test",
      "User",
      hashPassword("test1234"),
      opts.role ?? "user"
    );
  return result.lastInsertRowid as number;
}

export function seedOrder(db: Database.Database, date: string): number {
  const result = db
    .prepare("INSERT INTO orders (date, status) VALUES (?, 'draft')")
    .run(date);
  return result.lastInsertRowid as number;
}

export function seedOrderRow(
  db: Database.Database,
  orderId: number,
  personName: string
): void {
  db.prepare(
    "INSERT INTO order_rows (order_id, department, person_name, sort_order) VALUES (?, 'Testování', ?, 0)"
  ).run(orderId, personName);
}

export function seedSession(db: Database.Database, userId: number): string {
  const token = "test-token-" + Math.random().toString(36).slice(2);
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(userId, token, expiresAt);
  return token;
}
