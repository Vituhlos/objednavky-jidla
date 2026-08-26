// Testy migrace, hesel, účtů a sezení pro autentizační vrstvu.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-"));
process.env.DB_PATH = path.join(dataDir, "test.db");

const lib = loadLib();
const { getDb } = await lib("db");
const { migrateAuth } = await lib("auth/schema");
const db = getDb();

const AUTH_TABLES = [
  "users",
  "user_identities",
  "user_people",
  "sessions",
  "login_tokens",
  "guest_invites",
];

test("migrace založí celé auth schéma", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

  for (const table of AUTH_TABLES) {
    assert.ok(tables.includes(table), `chybí tabulka ${table}`);
  }

  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all()
    .map((row) => row.name);
  assert.ok(indexes.includes("idx_sessions_user_id"));
  assert.ok(indexes.includes("idx_login_tokens_user_id"));
  assert.ok(indexes.includes("idx_guest_invites_inviter_user_id"));
});

test("migrace je idempotentní nad stejnou databází", () => {
  migrateAuth(db);
  migrateAuth(db);

  const count = db
    .prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${AUTH_TABLES.map(() => "?").join(", ")})`)
    .get(...AUTH_TABLES).n;
  assert.equal(count, AUTH_TABLES.length);
});

test("cizí klíče auth tabulek se vynucují", () => {
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.throws(
    () =>
      db
        .prepare("INSERT INTO sessions (user_id, token_hash, idle_expires_at, absolute_expires_at) VALUES (?, ?, datetime('now', '+1 hour'), datetime('now', '+1 day'))")
        .run(999_999, "neexistujici"),
    /FOREIGN KEY/
  );
});

test("databáze odmítne neznámou roli a účel tokenu", () => {
  assert.throws(
    () =>
      db
        .prepare("INSERT INTO users (email, email_normalized, name, role) VALUES (?, ?, ?, ?)")
        .run("x@example.cz", "x@example.cz", "X", "owner"),
    /CHECK constraint/
  );
});
