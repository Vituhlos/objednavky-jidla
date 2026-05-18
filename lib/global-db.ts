import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";
import type { Migration } from "./migrations";

const GLOBAL_DB_PATH =
  process.env.GLOBAL_DB_PATH ?? path.join(process.cwd(), "data", "global.db");

let instance: Database.Database | null = null;

export function getGlobalDb(): Database.Database {
  if (!instance) {
    fs.mkdirSync(path.dirname(GLOBAL_DB_PATH), { recursive: true });
    instance = new Database(GLOBAL_DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    runMigrations(instance, GLOBAL_MIGRATIONS);
  }
  return instance;
}

const GLOBAL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_global_schema",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS tenants (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          slug         TEXT    NOT NULL UNIQUE,
          display_name TEXT    NOT NULL,
          join_code    TEXT    NOT NULL UNIQUE,
          active       INTEGER NOT NULL DEFAULT 1,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      db.prepare(`
        CREATE TABLE IF NOT EXISTS super_admins (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    NOT NULL UNIQUE,
          password_hash TEXT    NOT NULL,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      db.prepare(`
        CREATE TABLE IF NOT EXISTS platform_audit (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          ts          TEXT    NOT NULL DEFAULT (datetime('now')),
          tenant_slug TEXT,
          action      TEXT    NOT NULL,
          actor_email TEXT,
          details     TEXT
        )
      `).run();

      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_platform_audit_ts ON platform_audit(ts DESC)`
      ).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant ON platform_audit(tenant_slug)`
      ).run();
    },
  },
  {
    version: 2,
    name: "super_admin_sessions",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS super_admin_sessions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id   INTEGER NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
          token      TEXT    NOT NULL UNIQUE,
          expires_at TEXT    NOT NULL,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sa_sessions_token ON super_admin_sessions(token)`
      ).run();
    },
  },
  {
    version: 3,
    name: "global_settings_and_menu",
    up: (db) => {
      // Global settings: IMAP, auto-send deadline, menu prices, Telegram, VAPID
      db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT ''
        )
      `).run();

      // Menu items — one shared menu for all tenants; kitchen imports via IMAP/PDF
      db.prepare(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          week_start TEXT,
          week_label TEXT,
          day        TEXT    NOT NULL,
          type       TEXT    NOT NULL,
          code       TEXT    NOT NULL,
          name       TEXT    NOT NULL,
          price      INTEGER NOT NULL DEFAULT 0,
          allergens  TEXT    NOT NULL DEFAULT ''
        )
      `).run();

      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_menu_items_week_day ON menu_items(week_start, day)`
      ).run();
    },
  },
  {
    version: 4,
    name: "tenant_city_plan",
    up: (db) => {
      db.prepare(`ALTER TABLE tenants ADD COLUMN city TEXT NOT NULL DEFAULT ''`).run();
      db.prepare(`ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard'`).run();
    },
  },
];
