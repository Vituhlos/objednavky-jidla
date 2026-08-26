// Testy migrace, hesel, účtů a sezení pro autentizační vrstvu.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createRequire } from "node:module";
import { loadLib, startFakeSmtp } from "./test-helpers.mjs";

// Staré schéma je potřeba založit dřív, než lib/db.ts databázi otevře a zmigruje.
const LegacyDatabase = createRequire(import.meta.url)("better-sqlite3");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-"));
process.env.DB_PATH = path.join(dataDir, "test.db");
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_NAME;
process.env.COOKIE_SIGNING_SECRET = "test-cookie-signing-secret-with-32-bytes";

const lib = loadLib();
const { getDb } = await lib("db");
const { migrateAuth } = await lib("auth/schema");
const password = await lib("auth/password");
const tokens = await lib("auth/tokens");
const users = await lib("auth/users");
const sessions = await lib("auth/sessions");
const guards = await lib("auth/guards");
const { AuthError } = await lib("auth/errors");
const settings = await lib("settings");
const oauth = await lib("auth/oauth");
const mail = await lib("auth/mail");
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

test("Google nastavení bere databázi před prostředím", () => {
  process.env.GOOGLE_CLIENT_ID = "env-client";
  process.env.GOOGLE_CLIENT_SECRET = "env-secret";
  assert.equal(oauth.isGoogleConfigured(), true);

  settings.saveSettings({
    googleClientId: "db-client",
    googleClientSecret: "db-secret",
  });
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  const configured = settings.getSettings();
  assert.equal(configured.googleClientId, "db-client");
  assert.equal(configured.googleClientSecret, "db-secret");
  assert.equal(oauth.isGoogleConfigured(), true);
});

test("Google vyžaduje samostatný dostatečně dlouhý podpisový secret", () => {
  const validSecret = process.env.COOKIE_SIGNING_SECRET;
  try {
    process.env.COOKIE_SIGNING_SECRET = "kratky";
    assert.equal(oauth.isGoogleConfigured(), false);
    assert.throws(
      () =>
        oauth.sealGoogleFlowCookie({
          state: "s".repeat(43),
          nonce: "n".repeat(43),
          codeVerifier: "v".repeat(43),
          redirectUri: "http://localhost:3000/api/auth/google/callback",
        }),
      /COOKIE_SIGNING_SECRET musí mít alespoň 32 bajtů/
    );
  } finally {
    process.env.COOKIE_SIGNING_SECRET = validSecret;
  }
  assert.equal(oauth.isGoogleConfigured(), true);
});

test("OAuth cookie je krátkodobá, podepsaná a odolná proti změně", () => {
  const checks = {
    state: "s".repeat(43),
    nonce: "n".repeat(43),
    codeVerifier: "v".repeat(43),
    redirectUri: "http://localhost:3000/api/auth/google/callback",
  };
  const sealed = oauth.sealGoogleFlowCookie(checks);
  assert.deepEqual(oauth.readGoogleFlowCookie(sealed), checks);

  const originalGoogleSecret = settings.getSettings().googleClientSecret;
  try {
    settings.saveSettings({ googleClientSecret: "zrotovany-google-secret" });
    assert.deepEqual(
      oauth.readGoogleFlowCookie(sealed),
      checks,
      "rotace Google secretu nesmí měnit samostatný podpisový klíč"
    );
  } finally {
    settings.saveSettings({ googleClientSecret: originalGoogleSecret });
  }

  const last = sealed.at(-1);
  const tampered = `${sealed.slice(0, -1)}${last === "A" ? "B" : "A"}`;
  assert.equal(oauth.readGoogleFlowCookie(tampered), null);
  assert.equal(oauth.readGoogleFlowCookie("neplatna-cookie"), null);

  const originalSigningSecret = process.env.COOKIE_SIGNING_SECRET;
  try {
    process.env.COOKIE_SIGNING_SECRET = "rotated-cookie-signing-secret-with-32-bytes";
    assert.equal(oauth.readGoogleFlowCookie(sealed), null);
  } finally {
    process.env.COOKIE_SIGNING_SECRET = originalSigningSecret;
  }
});

test("čekající propojení Google neodhaluje data bez platného podpisu", () => {
  const pending = {
    email: "jana@example.cz",
    subject: "google-subject-123",
    name: "Jana Nováková",
  };
  const sealed = oauth.sealPendingGoogleLink(pending);
  assert.deepEqual(oauth.readPendingGoogleLink(sealed), pending);
  assert.equal(oauth.readPendingGoogleLink(`${sealed}x`), null);
});

test("záloha neobsahuje auth tabulky a filtruje Google secret", () => {
  const source = fs.readFileSync("app/api/backup/route.ts", "utf8");
  for (const table of [
    "users",
    "user_identities",
    "sessions",
    "login_tokens",
    "guest_invites",
  ]) {
    assert.doesNotMatch(source, new RegExp(`SELECT[^;]+\\b${table}\\b`, "i"));
  }
  assert.match(source, /"googleClientSecret"/);
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

test("claimPersonId se odmítne vždy, protože veřejné ID není důkaz identity", () => {
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
    /musí potvrdit správce/
  );
  assert.equal(users.getUserByEmail("utocnik@example.cz"), null, "transakce se musí celá vrátit");
});

test("ani osiřelého strávníka nelze převzít veřejným personId", () => {
  const orphanId = Number(
    db.prepare("INSERT INTO people (name, department_id) VALUES (?, ?)").run("Veřejný Sirotek", 1)
      .lastInsertRowid
  );

  assert.throws(
    () =>
      users.createUserWithPassword({
        email: "orphan-claim@example.cz",
        name: "Veřejný Sirotek",
        password: "dostatečně dlouhé heslo",
        departmentId: 1,
        claimPersonId: orphanId,
      }),
    /musí potvrdit správce/
  );
  assert.equal(users.getUserByEmail("orphan-claim@example.cz"), null);
  assert.equal(
    db.prepare("SELECT 1 FROM user_people WHERE person_id = ?").get(orphanId),
    undefined
  );
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

test("heslové ověření vrací jen DTO a neznámý účet bezpečně odmítne", () => {
  const authenticated = users.authenticateWithPassword(
    "jana.novakova@example.cz",
    "bezpečné heslo 123"
  );
  assert.equal(authenticated.id, passwordAccount.userId);
  assert.equal(users.authenticateWithPassword("nikdo@example.cz", "bezpečné heslo 123"), null);
  assert.equal(users.verifyUserPassword(passwordAccount.userId, "špatné dlouhé heslo"), false);
});

test("sezení ukládá jen otisk tokenu a vrací minimální DTO", () => {
  const created = sessions.createSession(passwordAccount.userId, {
    persistent: false,
    userAgent: "Testovací prohlížeč\u0000",
  });
  const info = sessions.readSession(created.token);

  assert.ok(info);
  assert.deepEqual(info.personIds, [passwordAccount.personId]);
  assert.equal(info.userId, passwordAccount.userId);
  assert.ok(new Date(created.expiresAt).getTime() > Date.now());

  const stored = db
    .prepare("SELECT token_hash, user_agent FROM sessions WHERE id = ?")
    .get(info.sessionId);
  assert.equal(stored.token_hash, tokens.hashToken(created.token));
  assert.notEqual(stored.token_hash, created.token);
  assert.equal(stored.user_agent, "Testovací prohlížeč");
  assert.equal(JSON.stringify(sessions.listSessions(passwordAccount.userId)).includes(created.token), false);

  sessions.revokeSession(created.token);
  assert.equal(sessions.readSession(created.token), null);
});

test("nečinnost a absolutní strop se vynucují každý samostatně", () => {
  const idle = sessions.createSession(passwordAccount.userId, { persistent: false });
  const idleInfo = sessions.readSession(idle.token);
  db.prepare(
    "UPDATE sessions SET idle_expires_at = datetime('now', '-1 second'), absolute_expires_at = datetime('now', '+1 day') WHERE id = ?"
  ).run(idleInfo.sessionId);
  assert.equal(sessions.readSession(idle.token), null, "prošlá nečinnost se odmítne");

  const absolute = sessions.createSession(passwordAccount.userId, { persistent: true });
  const absoluteInfo = sessions.readSession(absolute.token);
  db.prepare(
    "UPDATE sessions SET idle_expires_at = datetime('now', '+1 day'), absolute_expires_at = datetime('now', '-1 second') WHERE id = ?"
  ).run(absoluteInfo.sessionId);
  assert.equal(sessions.readSession(absolute.token), null, "absolutní strop se odmítne");
});

test("klouzavá platnost nikdy nepřeleze absolutní strop", () => {
  const created = sessions.createSession(passwordAccount.userId, { persistent: true });
  const info = sessions.readSession(created.token);
  db.prepare(
    `UPDATE sessions
     SET last_seen_at = datetime('now', '-2 minutes'),
         idle_expires_at = datetime('now', '+1 minute'),
         absolute_expires_at = datetime('now', '+10 minutes')
     WHERE id = ?`
  ).run(info.sessionId);

  assert.ok(sessions.readSession(created.token));
  const row = db
    .prepare(
      `SELECT
         julianday(idle_expires_at) <= julianday(absolute_expires_at) AS bounded,
         abs(julianday(idle_expires_at) - julianday(absolute_expires_at)) < 0.000001 AS capped
       FROM sessions WHERE id = ?`
    )
    .get(info.sessionId);
  assert.equal(row.bounded, 1);
  assert.equal(row.capped, 1);
  sessions.revokeSession(created.token);
});

test("změna hesla ponechá aktuální sezení a zruší ostatní", () => {
  const current = sessions.createSession(passwordAccount.userId, { persistent: false });
  const other = sessions.createSession(passwordAccount.userId, { persistent: true });
  const currentInfo = sessions.readSession(current.token);

  users.changePassword(
    passwordAccount.userId,
    "nové bezpečné heslo 456",
    currentInfo.sessionId
  );

  assert.ok(sessions.readSession(current.token));
  assert.equal(sessions.readSession(other.token), null);
  sessions.revokeSession(current.token);
});

test("blokace zneplatní všechna sezení a zachová důvod odmítnutí", () => {
  const account = users.createUserFromGoogle({
    email: "blokovany@example.cz",
    name: "Blokovaný uživatel",
    subject: "google-blocked",
    departmentId: 1,
  });
  const first = sessions.createSession(account.userId, { persistent: false });
  const second = sessions.createSession(account.userId, { persistent: true });

  users.setUserStatus(account.userId, "blocked");

  assert.equal(sessions.readSession(first.token), null);
  assert.equal(sessions.readSession(second.token), null);
  assert.equal(sessions.isBlockedSessionToken(first.token), true);
  users.setUserStatus(account.userId, "active");
  assert.equal(sessions.readSession(first.token), null, "odblokování staré sezení neoživí");
});

test("guard pustí vlastníka a správce, cizí i neznámý řádek odmítne", async () => {
  const other = users.createUserFromGoogle({
    email: "cizi@example.cz",
    name: "Cizí strávník",
    subject: "google-foreign",
    departmentId: 2,
  });
  const orderId = Number(
    db.prepare("INSERT INTO orders (date) VALUES (?)").run("2026-08-26").lastInsertRowid
  );
  const ownRowId = Number(
    db
      .prepare(
        "INSERT INTO order_rows (order_id, department, person_name, person_id) VALUES (?, ?, ?, ?)"
      )
      .run(orderId, "Konstrukce", "Jana Nováková", passwordAccount.personId).lastInsertRowid
  );
  const foreignRowId = Number(
    db
      .prepare(
        "INSERT INTO order_rows (order_id, department, person_name, person_id) VALUES (?, ?, ?, ?)"
      )
      .run(orderId, "Dílna", "Cizí strávník", other.personId).lastInsertRowid
  );
  const ownerSession = {
    sessionId: 1,
    userId: passwordAccount.userId,
    role: "user",
    personIds: [passwordAccount.personId],
  };
  const adminSession = { ...ownerSession, role: "admin" };

  await assert.doesNotReject(() => guards.assertCanEditRow(ownerSession, ownRowId));
  await assert.rejects(
    () => guards.assertCanEditRow(ownerSession, foreignRowId),
    (error) => error instanceof AuthError && error.code === "CIZI_ZAZNAM"
  );
  await assert.doesNotReject(() => guards.assertCanEditRow(adminSession, foreignRowId));
  await assert.rejects(
    () => guards.assertCanEditRow(adminSession, 999_999),
    (error) => error instanceof AuthError && error.code === "CIZI_ZAZNAM"
  );
  await assert.doesNotReject(() =>
    guards.assertCanActAsPerson(ownerSession, passwordAccount.personId)
  );
  await assert.rejects(() => guards.assertCanActAsPerson(ownerSession, other.personId), {
    code: "CIZI_ZAZNAM",
  });
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

    bootstrapDb.prepare("UPDATE users SET status = 'blocked' WHERE id = ?").run(admin.id);
    process.env.ADMIN_PASSWORD = "nouzové heslo z prostředí";
    runMigration(bootstrapDb);
    const recovered = bootstrapDb
      .prepare("SELECT status, password_hash AS hash FROM users WHERE id = ?")
      .get(admin.id);
    assert.equal(recovered.status, "active");
    assert.equal(bootstrapPassword.verifyPassword(process.env.ADMIN_PASSWORD, recovered.hash), true);
    assert.equal(bootstrapUsers.isBootstrapPasswordUnchanged(), true);
  } finally {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_NAME;
    process.env.DB_PATH = path.join(dataDir, "test.db");
  }
});

function tokenFromMessage(message) {
  const decoded = message
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  const match = decoded.match(/[?&]token=([A-Za-z0-9_-]{43})/);
  assert.ok(match, "e-mail musí obsahovat jednorázový token");
  return match[1];
}

test("ověřovací a obnovovací e-maily používají jednorázové otisky", async () => {
  const smtp = await startFakeSmtp();
  settings.saveSettings({
    smtpHost: "127.0.0.1",
    smtpPort: String(smtp.port),
    smtpUser: "test@example.cz",
    smtpPass: "test-password",
    smtpFrom: "kantyna@example.cz",
    smtpSecure: "false",
  });

  try {
    await mail.sendVerificationEmail(passwordAccount.userId, "http://localhost:3000");
    assert.equal(smtp.messages.length, 1);
    const verifyToken = tokenFromMessage(smtp.messages[0]);
    const verifyRow = db
      .prepare(
        "SELECT token_hash AS hash, used_at AS usedAt FROM login_tokens WHERE user_id = ? AND purpose = 'verify' ORDER BY id DESC LIMIT 1"
      )
      .get(passwordAccount.userId);
    assert.equal(verifyRow.hash, tokens.hashToken(verifyToken));
    assert.equal(verifyRow.usedAt, null);
    assert.doesNotMatch(verifyRow.hash, new RegExp(verifyToken));

    assert.equal(mail.consumeVerificationToken(verifyToken), passwordAccount.userId);
    assert.equal(users.getUserById(passwordAccount.userId).emailVerified, true);
    assert.throws(() => mail.consumeVerificationToken(verifyToken), /není platný/);

    await mail.sendVerificationEmail(passwordAccount.userId, "http://localhost:3000");
    assert.equal(smtp.messages.length, 1, "ověřenému účtu se další e-mail neposílá");

    const beforeUnknown = db.prepare("SELECT COUNT(*) AS n FROM login_tokens").get().n;
    await mail.sendPasswordResetEmail("nikdo@example.cz", "http://localhost:3000");
    assert.equal(smtp.messages.length, 1, "neexistující adresa nic neodešle");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM login_tokens").get().n, beforeUnknown);

    smtp.failOnce();
    await assert.rejects(() =>
      mail.sendPasswordResetEmail("jana.novakova@example.cz", "http://localhost:3000")
    );
    const failed = db
      .prepare(
        "SELECT used_at AS usedAt FROM login_tokens WHERE user_id = ? AND purpose = 'reset' ORDER BY id DESC LIMIT 1"
      )
      .get(passwordAccount.userId);
    assert.notEqual(failed.usedAt, null, "nedoručený token musí být neplatný");

    const oldSession = sessions.createSession(passwordAccount.userId, { persistent: true });
    await mail.sendPasswordResetEmail(
      "JANA.NOVAKOVA@example.cz",
      "http://localhost:3000"
    );
    assert.equal(smtp.messages.length, 2);
    const resetToken = tokenFromMessage(smtp.messages[1]);
    const resetRow = db
      .prepare(
        "SELECT token_hash AS hash, expires_at AS expiresAt FROM login_tokens WHERE user_id = ? AND purpose = 'reset' ORDER BY id DESC LIMIT 1"
      )
      .get(passwordAccount.userId);
    assert.equal(resetRow.hash, tokens.hashToken(resetToken));
    assert.ok(new Date(resetRow.expiresAt).getTime() - Date.now() <= 15 * 60 * 1000);

    assert.equal(
      mail.resetPasswordWithToken(resetToken, "heslo po bezpečné obnově"),
      passwordAccount.userId
    );
    assert.equal(sessions.readSession(oldSession.token), null);
    assert.equal(
      users.authenticateWithPassword(
        "jana.novakova@example.cz",
        "heslo po bezpečné obnově"
      ).id,
      passwordAccount.userId
    );
    assert.throws(
      () => mail.resetPasswordWithToken(resetToken, "další dost dlouhé heslo"),
      /není platný/
    );

    const adminLink = mail.createResetLinkForUser(passwordAccount.userId);
    assert.match(adminLink, /^\/ucet\/obnovit-heslo\?token=[A-Za-z0-9_-]{43}$/);
  } finally {
    await smtp.close();
  }
});

// ── Pozůstatky po starém pokusu o přihlašování ──────────────────────────────
// Na větvích v2-auth vznikly tabulky `users` a `sessions` v jiném tvaru.
// CREATE TABLE IF NOT EXISTS je tiše nechá být, takže první dotaz spadne na
// chybějící sloupec — a protože sezení čte kořenový layout, spadne celá appka.

test("migrace ustoupí tabulkám ze starého pokusu o přihlašování", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-legacy-"));
  const dbPath = path.join(dir, "legacy.db");

  const raw = new LegacyDatabase(dbPath);
  raw.exec(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      first_name    TEXT    NOT NULL,
      last_name     TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      active        INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL
    );
    CREATE TABLE password_reset_tokens (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token   TEXT    NOT NULL
    );
    INSERT INTO users (email, first_name, last_name, password_hash)
      VALUES ('stary@example.cz', 'Starý', 'Pokus', 'x');
    INSERT INTO sessions (user_id, token, expires_at)
      VALUES (1, 'stary-token', '2030-01-01');
  `);
  raw.close();

  process.env.DB_PATH = dbPath;
  const lib2 = loadLib();
  const { getDb: openDb } = await lib2("db");
  const users2 = await lib2("auth/users");
  const migrated = openDb();

  assert.deepEqual(users2.listUsers(), [], "nad novým schématem musí dotaz projít");

  const zalozene = migrated.prepare("SELECT COUNT(*) AS n FROM users_legacy_v2").get();
  assert.equal(zalozene.n, 1, "data z opuštěného pokusu se odkládají, nemažou");

  const sezeni = migrated.prepare("SELECT COUNT(*) AS n FROM sessions_legacy_v2").get();
  assert.equal(sezeni.n, 1, "stará sezení taky");

  // Nová migrace musí nad takovou databází umět i psát, nejen číst.
  const zalozeny = users2.createUserWithPassword({
    email: "novy@example.cz",
    name: "Nový Uživatel",
    password: "dostatecne-dlouhe-heslo",
    departmentId: 1,
  });
  assert.ok(zalozeny.userId > 0, "nad uklizenou databází jde založit účet");
});

test("řádky objednávek přežijí úklid starých účtů", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-legacy-rows-"));
  const dbPath = path.join(dir, "legacy-rows.db");

  // Starý pokus přidal do řádků objednávek user_id s vazbou na účty. Jeden
  // vyplněný odkaz stačil, aby zahození starých účtů porazil cizí klíč — a
  // tím se rozbila celá aplikace, ne jen přihlašování.
  const raw = new LegacyDatabase(dbPath);
  raw.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft'
    );
    CREATE TABLE order_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      department TEXT NOT NULL,
      person_name TEXT NOT NULL DEFAULT '',
      user_id INTEGER REFERENCES users(id)
    );
    INSERT INTO users (email, first_name, last_name, password_hash)
      VALUES ('stary@example.cz', 'Starý', 'Pokus', 'x');
    INSERT INTO orders (date) VALUES ('2026-08-20');
    INSERT INTO order_rows (order_id, department, person_name, user_id)
      VALUES (1, 'Konstrukce', 'Jana Nováková', 1);
  `);
  raw.close();

  process.env.DB_PATH = dbPath;
  const lib3 = loadLib();
  const { getDb: openDb } = await lib3("db");
  const migrated = openDb();

  const radek = migrated
    .prepare("SELECT person_name AS jmeno, user_id AS ucet FROM order_rows WHERE id = 1")
    .get();
  assert.equal(radek.jmeno, "Jana Nováková", "objednávka zůstala");
  assert.equal(radek.ucet, null, "odkaz na opuštěný účet se uvolnil");

  const mapa = migrated
    .prepare("SELECT user_id AS ucet FROM order_rows_user_legacy_v2 WHERE id = 1")
    .get();
  assert.equal(mapa.ucet, 1, "dvojice se schovala stranou, aby šla dohledat");
});
