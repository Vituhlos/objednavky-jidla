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

const lib = loadLib();
const { getDb } = await lib("db");
const users = await lib("auth/users");
const invites = await lib("auth/invites");
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
  firstGuest = createAccount("První host");
  invites.consumeInvite(usedToken, firstGuest.personId);

  const relation = db
    .prepare("SELECT guest_of_person_id AS owner FROM people WHERE id = ?")
    .get(firstGuest.personId);
  assert.equal(relation.owner, inviter.personId);
  assert.equal(invites.countActiveGuests(inviter.userId), 1);
  assert.equal(invites.getInvite(usedToken), null);
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
    const guest = createAccount(`Host limitu ${i + 1}`);
    invites.consumeInvite(invitation.token, guest.personId);
  }

  assert.equal(invites.countActiveGuests(limited.userId), 3);
  assert.throws(() => invites.createInvite(limited.userId), /tří aktivních hostů/);
});

test("limit hostů se znovu kontroluje i při uplatnění starší pozvánky", () => {
  const limited = createAccount("Limit při uplatnění");
  const pending = Array.from({ length: 4 }, () => invites.createInvite(limited.userId));
  for (let i = 0; i < 3; i += 1) {
    const guest = createAccount(`Pozdější host ${i + 1}`);
    invites.consumeInvite(pending[i].token, guest.personId);
  }
  const fourth = createAccount("Čtvrtý pozdější host");

  assert.throws(
    () => invites.consumeInvite(pending[3].token, fourth.personId),
    /tří aktivních hostů/
  );
  assert.equal(
    db.prepare("SELECT guest_of_person_id AS owner FROM people WHERE id = ?").get(fourth.personId)
      .owner,
    null,
    "neúspěšná transakce nesmí zanechat vztah"
  );
  assert.ok(invites.getInvite(pending[3].token), "neúspěšná transakce nesmí spotřebovat odkaz");
});
