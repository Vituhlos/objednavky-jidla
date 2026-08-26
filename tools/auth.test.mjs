// Testy migrace, hesel, účtů a sezení pro autentizační vrstvu.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-"));
process.env.DB_PATH = path.join(dataDir, "test.db");
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_NAME;

const lib = loadLib();
const { getDb } = await lib("db");
const { migrateAuth } = await lib("auth/schema");
const password = await lib("auth/password");
const tokens = await lib("auth/tokens");
const users = await lib("auth/users");
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

test("heslo kratší než 12 znaků neprojde", () => {
  assert.deepEqual(password.checkPasswordStrength("krátké123"), {
    ok: false,
    reason: "Heslo musí mít alespoň 12 znaků.",
  });
  assert.throws(() => password.hashPassword("krátké123"), /alespoň 12 znaků/);
});

test("dvanáct znaků stačí bez umělých požadavků na složitost", () => {
  assert.deepEqual(password.checkPasswordStrength("dlouheheslo!"), { ok: true });
});

test("stejné heslo má pokaždé jiný otisk a oba se ověří", () => {
  const plain = "správně dlouhé heslo";
  const first = password.hashPassword(plain);
  const second = password.hashPassword(plain);

  assert.notEqual(first, second, "každý účet musí dostat náhodnou sůl");
  assert.match(first, /^scrypt\$17\$8\$1\$[^$]+\$[^$]+$/);
  assert.equal(password.verifyPassword(plain, first), true);
  assert.equal(password.verifyPassword("jiné dlouhé heslo", first), false);
});

test("poškozený nebo cizí formát hesla nikdy nevyhodí výjimku", () => {
  const malformed = [
    "",
    "sha256$17$8$1$sůl$otisk",
    "scrypt$99$8$1$AAAA$AAAA",
    "scrypt$17$8$1$neplatná-base64$AAAA",
    "scrypt$17$8$1$AAAA$AAAA",
  ];

  for (const stored of malformed) {
    assert.doesNotThrow(() => password.verifyPassword("správně dlouhé heslo", stored));
    assert.equal(password.verifyPassword("správně dlouhé heslo", stored), false);
  }
});

test("token má 256 bitů náhody a v databázi použitelný jen otisk", () => {
  const first = tokens.newToken();
  const second = tokens.newToken();

  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(tokens.hashToken(first.token), first.hash);
  assert.notEqual(first.token, first.hash);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.hash, second.hash);
});

let passwordAccount;

test("registrace založí účet, strávníka i jedinou vazbu", () => {
  passwordAccount = users.createUserWithPassword({
    email: "  Jana.Novakova@Example.cz ",
    name: " Jana  Nováková ",
    password: "bezpečné heslo 123",
    departmentId: 1,
  });

  const user = users.getUserById(passwordAccount.userId);
  assert.ok(user);
  assert.equal(user.email, "Jana.Novakova@Example.cz");
  assert.equal(user.name, "Jana Nováková");
  assert.deepEqual(user.personIds, [passwordAccount.personId]);
  assert.deepEqual(user.providers, []);
  assert.equal(user.emailVerified, false);

  const person = db.prepare("SELECT name, department_id, active FROM people WHERE id = ?").get(
    passwordAccount.personId
  );
  assert.deepEqual(person, { name: "Jana Nováková", department_id: 1, active: 1 });
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM user_people WHERE user_id = ?").get(passwordAccount.userId).n,
    1
  );
  assert.ok(
    db.prepare("SELECT 1 FROM audit_log WHERE action = 'user_register' AND details = ?").get(
      `uživatel #${passwordAccount.userId}`
    )
  );
});

test("DTO uživatele nikdy neobsahuje heslo ani token", () => {
  const serialized = JSON.stringify(users.getUserById(passwordAccount.userId));
  assert.doesNotMatch(serialized, /password|hash|token/i);
  assert.doesNotMatch(serialized, /scrypt\$/);
});

test("stejný e-mail s jinou velikostí písmen se odmítne obecnou hláškou", () => {
  assert.throws(
    () =>
      users.createUserWithPassword({
        email: "jana.novakova@example.CZ",
        name: "Někdo jiný",
        password: "jiné bezpečné heslo",
        departmentId: 1,
      }),
    /^Error: Registraci se nepodařilo dokončit\.$/
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE email_normalized = ?").get(
      "jana.novakova@example.cz"
    ).n,
    1
  );
});

test("claimPersonId se odmítne, když strávník už účet má", () => {
  const claimed = users.createUserFromGoogle({
    email: "claim@example.cz",
    name: "Pavel Vlastník",
    subject: "google-claim-owner",
    departmentId: 1,
  });

  assert.throws(
    () =>
      users.createUserWithPassword({
        email: "utocnik@example.cz",
        name: "Útočník",
        password: "dostatečně dlouhé heslo",
        departmentId: 1,
        claimPersonId: claimed.personId,
      }),
    /už má vlastní účet/
  );
  assert.equal(users.getUserByEmail("utocnik@example.cz"), null, "transakce se musí celá vrátit");
});

test("Google se podle shody e-mailu s heslovým účtem automaticky nepropojí", () => {
  assert.throws(
    () =>
      users.createUserFromGoogle({
        email: "JANA.NOVAKOVA@example.cz",
        name: "Jana Nováková",
        subject: "google-jana",
        departmentId: 1,
      }),
    /potvrďte heslem/
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM user_identities WHERE subject = 'google-jana'").get().n,
    0
  );
});

test("po ručním propojení rozhoduje Google subject, ne změněný e-mail", () => {
  users.linkGoogleIdentity(passwordAccount.userId, "google-jana");
  const resolved = users.createUserFromGoogle({
    email: "jana.po-zmene@example.cz",
    name: "Jana Nováková",
    subject: "google-jana",
    departmentId: 1,
  });

  assert.deepEqual(resolved, passwordAccount);
  assert.deepEqual(users.getUserById(passwordAccount.userId).providers, ["google"]);
  assert.equal(users.getUserById(passwordAccount.userId).email, "Jana.Novakova@Example.cz");
});

test("smazání účtu ponechá strávníka, objednávku i otisk jména", () => {
  const account = users.createUserFromGoogle({
    email: "ke-smazani@example.cz",
    name: "Karel Historický",
    subject: "google-delete",
    departmentId: 2,
  });
  const orderId = Number(
    db.prepare("INSERT INTO orders (date) VALUES (?)").run("2026-08-25").lastInsertRowid
  );
  const rowId = Number(
    db
      .prepare(
        "INSERT INTO order_rows (order_id, department, person_name, person_id) VALUES (?, ?, ?, ?)"
      )
      .run(orderId, "Dílna", "Karel Historický", account.personId).lastInsertRowid
  );

  users.deleteUser(account.userId);

  assert.equal(users.getUserById(account.userId), null);
  assert.deepEqual(db.prepare("SELECT active FROM people WHERE id = ?").get(account.personId), {
    active: 0,
  });
  assert.deepEqual(db.prepare("SELECT person_id, person_name FROM order_rows WHERE id = ?").get(rowId), {
    person_id: account.personId,
    person_name: "Karel Historický",
  });
});

test("bootstrap založí prvního správce jednou a změněné heslo už nepřepíše", async () => {
  const bootstrapDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-bootstrap-"));
  process.env.DB_PATH = path.join(bootstrapDir, "test.db");
  process.env.ADMIN_EMAIL = "admin@example.cz";
  process.env.ADMIN_PASSWORD = "počáteční bezpečné heslo";
  process.env.ADMIN_NAME = "První správce";

  try {
    const bootstrapLib = loadLib();
    const { getDb: getBootstrapDb } = await bootstrapLib("db");
    const { migrateAuth: runMigration } = await bootstrapLib("auth/schema");
    const bootstrapUsers = await bootstrapLib("auth/users");
    const bootstrapPassword = await bootstrapLib("auth/password");
    const bootstrapDb = getBootstrapDb();

    const admin = bootstrapUsers.getUserByEmail("ADMIN@example.cz");
    assert.ok(admin);
    assert.equal(admin.role, "admin");
    assert.equal(admin.emailVerified, true);
    assert.equal(admin.personIds.length, 1);
    assert.equal(bootstrapUsers.isBootstrapPasswordUnchanged(), true);

    const originalHash = bootstrapDb
      .prepare("SELECT password_hash AS hash FROM users WHERE id = ?")
      .get(admin.id).hash;
    assert.equal(bootstrapPassword.verifyPassword(process.env.ADMIN_PASSWORD, originalHash), true);

    runMigration(bootstrapDb);
    assert.equal(
      bootstrapDb.prepare("SELECT password_hash AS hash FROM users WHERE id = ?").get(admin.id).hash,
      originalHash,
      "druhý běh nesmí bootstrapovací heslo přepsat"
    );
    assert.equal(bootstrapUsers.listUsers().length, 1);

    assert.throws(
      () => bootstrapUsers.setUserRole(admin.id, "user"),
      /Poslednímu aktivnímu správci/
    );
    bootstrapUsers.changePassword(admin.id, "nové ještě bezpečnější heslo");
    assert.equal(bootstrapUsers.isBootstrapPasswordUnchanged(), false);
  } finally {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_NAME;
    process.env.DB_PATH = path.join(dataDir, "test.db");
  }
});
