// Testy jednorázových pozvánek hostů a jejich limitů.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "invites-"));
process.env.DB_PATH = path.join(dataDir, "test.db");
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
process.env.COOKIE_SIGNING_SECRET = "test-cookie-signing-secret-with-32-bytes";

const lib = loadLib();
const { getDb } = await lib("db");
const users = await lib("auth/users");
const invites = await lib("auth/invites");
const oauth = await lib("auth/oauth");
const tokens = await lib("auth/tokens");
const db = getDb();

let sequence = 0;
function createAccount(label) {
  sequence += 1;
  return users.createUserFromGoogle({
    email: `host-${sequence}@example.cz`,
    name: label,
    subject: `google-host-${sequence}`,
    departmentId: 1,
  });
}

function googleGuestInput(label, subjectOverride) {
  sequence += 1;
  const profile = {
    email: `host-${sequence}@example.cz`,
    name: label,
    subject: subjectOverride ?? `google-host-${sequence}`,
  };
  return {
    profile,
    registration: {
      provider: "google",
      profileCookie: oauth.sealPendingGoogleLink(profile),
      departmentId: 1,
    },
  };
}

function registerGoogleGuest(token, label) {
  return invites.registerGuestWithInvite(token, googleGuestInput(label).registration);
}

const inviter = createAccount("Hlavní hostitel");
let usedToken;
let firstGuest;

test("pozvánka platí sedm dní a databáze uchovává jen otisk", () => {
  const created = invites.createInvite(inviter.userId);
  usedToken = created.token;

  assert.match(created.token, /^[A-Za-z0-9_-]{43}$/);
  const remaining = new Date(created.expiresAt).getTime() - Date.now();
  assert.ok(remaining > 6.99 * 24 * 60 * 60 * 1000);
  assert.ok(remaining <= 7 * 24 * 60 * 60 * 1000);

  const row = db
    .prepare("SELECT token_hash AS hash FROM guest_invites WHERE inviter_user_id = ?")
    .get(inviter.userId);
  assert.equal(row.hash, tokens.hashToken(created.token));
  assert.notEqual(row.hash, created.token);
  assert.ok(invites.getInvite(created.token));
});

test("uplatnění nastaví hosta pod strávníka pozvatele", () => {
  firstGuest = registerGoogleGuest(usedToken, "První host");

  const relation = db
    .prepare("SELECT guest_of_person_id AS owner FROM people WHERE id = ?")
    .get(firstGuest.personId);
  assert.equal(relation.owner, inviter.personId);
  assert.equal(invites.countActiveGuests(inviter.userId), 1);
  assert.equal(invites.getInvite(usedToken), null);
});

test("heslová registrace hosta vytvoří účet i vztah v jediné operaci", () => {
  const invitation = invites.createInvite(inviter.userId);
  sequence += 1;
  const email = `host-${sequence}@example.cz`;
  const guest = invites.registerGuestWithInvite(invitation.token, {
    provider: "password",
    email,
    name: "Heslový host",
    password: "bezpečné heslo hosta",
    departmentId: 1,
  });

  assert.equal(users.authenticateWithPassword(email, "bezpečné heslo hosta")?.id, guest.userId);
  assert.equal(
    db.prepare("SELECT guest_of_person_id AS owner FROM people WHERE id = ?").get(guest.personId)
      .owner,
    inviter.personId
  );
  assert.equal(invites.getInvite(invitation.token), null);
});

test("neplatná pozvánka nezanechá účet ani strávníka", () => {
  const beforeUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const beforePeople = db.prepare("SELECT COUNT(*) AS n FROM people").get().n;
  const { profile, registration } = googleGuestInput("Nezaložený host");

  assert.throws(
    () => invites.registerGuestWithInvite("x".repeat(43), registration),
    /Pozvánka není platná/
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, beforeUsers);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM people").get().n, beforePeople);
  assert.equal(users.getUserByEmail(profile.email), null);
});

test("pozdní chyba vrátí zpět účet, strávníka i spotřebování pozvánky", () => {
  const invitation = invites.createInvite(inviter.userId);
  const { profile, registration } = googleGuestInput("Vrácený host");
  const beforeUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const beforePeople = db.prepare("SELECT COUNT(*) AS n FROM people").get().n;
  db.exec(`
    CREATE TRIGGER test_abort_invite_use
    BEFORE UPDATE OF used_at ON guest_invites
    BEGIN
      SELECT RAISE(ABORT, 'test pozdní chyby');
    END
  `);

  try {
    assert.throws(
      () => invites.registerGuestWithInvite(invitation.token, registration),
      /test pozdní chyby/
    );
  } finally {
    db.exec("DROP TRIGGER test_abort_invite_use");
  }

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, beforeUsers);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM people").get().n, beforePeople);
  assert.equal(users.getUserByEmail(profile.email), null);
  assert.ok(invites.getInvite(invitation.token));
  assert.equal(
    db.prepare("SELECT 1 FROM audit_log WHERE person_name = ?").get(profile.name),
    undefined,
    "rollback nesmí ponechat ani zavádějící audit"
  );
  invites.revokeInvite(invites.getInvite(invitation.token).id, inviter.userId);
});

test("veřejné API pozvánek nepřijímá personId z klienta", () => {
  assert.equal(invites.consumeInvite, undefined);
  const invitation = invites.createInvite(inviter.userId);
  const { profile, registration } = googleGuestInput("Podvržený host");
  const input = { ...registration, claimPersonId: inviter.personId };

  assert.throws(
    () => invites.registerGuestWithInvite(invitation.token, input),
    /nelze spojit s existujícím strávníkem/
  );
  assert.equal(users.getUserByEmail(profile.email), null);
  assert.ok(invites.getInvite(invitation.token));
  invites.revokeInvite(invites.getInvite(invitation.token).id, inviter.userId);
});

test("Google registrace hosta odmítne nepodepsaný profil z klienta", () => {
  const invitation = invites.createInvite(inviter.userId);
  const { profile, registration } = googleGuestInput("Podvržený Google host");
  const last = registration.profileCookie.at(-1);
  const tamperedCookie = `${registration.profileCookie.slice(0, -1)}${last === "A" ? "B" : "A"}`;

  assert.throws(
    () =>
      invites.registerGuestWithInvite(invitation.token, {
        ...registration,
        profileCookie: tamperedCookie,
      }),
    /Ověřená identita Google vypršela nebo není platná/
  );
  assert.equal(users.getUserByEmail(profile.email), null);
  assert.ok(invites.getInvite(invitation.token));
  invites.revokeInvite(invites.getInvite(invitation.token).id, inviter.userId);
});

test("pozvánka nikdy nepřevede existující Google účet na hosta", () => {
  const invitation = invites.createInvite(inviter.userId);
  const existingIdentity = db
    .prepare("SELECT subject FROM user_identities WHERE user_id = ? AND provider = 'google'")
    .get(inviter.userId);
  const { profile, registration } = googleGuestInput(
    "Falešně nový host",
    existingIdentity.subject
  );

  assert.throws(
    () => invites.registerGuestWithInvite(invitation.token, registration),
    /jen pro nový účet/
  );
  assert.equal(users.getUserByEmail(profile.email), null);
  assert.ok(invites.getInvite(invitation.token));
  invites.revokeInvite(invites.getInvite(invitation.token).id, inviter.userId);
});

test("host nemůže pozvat dalšího hosta", () => {
  assert.throws(() => invites.createInvite(firstGuest.userId), /Host nemůže zvát další hosty/);
});

test("použitá, zrušená i prošlá pozvánka se chovají stejně", () => {
  const revoked = invites.createInvite(inviter.userId);
  const revokedInfo = invites.getInvite(revoked.token);
  invites.revokeInvite(revokedInfo.id, inviter.userId);

  const expired = invites.createInvite(inviter.userId);
  db.prepare("UPDATE guest_invites SET expires_at = datetime('now', '-1 second') WHERE token_hash = ?").run(
    tokens.hashToken(expired.token)
  );

  assert.equal(invites.getInvite(usedToken), null);
  assert.equal(invites.getInvite(revoked.token), null);
  assert.equal(invites.getInvite(expired.token), null);
});

test("cizí uživatel nemůže pozvánku zrušit", () => {
  const created = invites.createInvite(inviter.userId);
  const info = invites.getInvite(created.token);
  const stranger = createAccount("Cizí uživatel");
  assert.throws(() => invites.revokeInvite(info.id, stranger.userId), /nelze zrušit/);
  assert.ok(invites.getInvite(created.token));
  invites.revokeInvite(info.id, inviter.userId);
});

test("šestá čekající pozvánka se odmítne", () => {
  const limited = createAccount("Limit pozvánek");
  for (let i = 0; i < 5; i += 1) invites.createInvite(limited.userId);
  assert.throws(() => invites.createInvite(limited.userId), /pět čekajících pozvánek/);
  assert.equal(invites.listInvites(limited.userId).length, 5);
});

test("čtvrtý aktivní host se odmítne už při vytvoření pozvánky", () => {
  const limited = createAccount("Limit hostů");
  for (let i = 0; i < 3; i += 1) {
    const invitation = invites.createInvite(limited.userId);
    registerGoogleGuest(invitation.token, `Host limitu ${i + 1}`);
  }

  assert.equal(invites.countActiveGuests(limited.userId), 3);
  assert.throws(() => invites.createInvite(limited.userId), /tří aktivních hostů/);
});

test("limit hostů se znovu kontroluje i při uplatnění starší pozvánky", () => {
  const limited = createAccount("Limit při uplatnění");
  const pending = Array.from({ length: 4 }, () => invites.createInvite(limited.userId));
  for (let i = 0; i < 3; i += 1) {
    registerGoogleGuest(pending[i].token, `Pozdější host ${i + 1}`);
  }
  const fourth = googleGuestInput("Čtvrtý pozdější host");
  const peopleBefore = db.prepare("SELECT COUNT(*) AS n FROM people").get().n;

  assert.throws(
    () => invites.registerGuestWithInvite(pending[3].token, fourth.registration),
    /tří aktivních hostů/
  );
  assert.equal(users.getUserByEmail(fourth.profile.email), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM people").get().n, peopleBefore);
  assert.ok(invites.getInvite(pending[3].token), "neúspěšná transakce nesmí spotřebovat odkaz");
});
