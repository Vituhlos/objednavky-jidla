// Ochrana server actions: že žádná zapisující akce nezůstala bez kontroly
// a že pravidla nad guardy (lib/auth/policy.ts) rozhodují správně.
//
// Statická část je pojistka proti budoucnosti: appka stojí na desítkách server
// actions a přidat další je otázka minuty. Bez tohohle testu by nová akce bez
// guardu prošla CI a nikdo by si toho nevšiml.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

// ── Statické pokrytí ────────────────────────────────────────────────────────

const SOURCE = fs.readFileSync("app/actions.ts", "utf8");

/**
 * Akce, které smí volat i nepřihlášený.
 *
 * Čtení zůstává veřejné (R1) — vrátná musí vidět počty, aniž by měla účet.
 * Seznam je úmyslně krátký a doplnit se do něj dá jen vědomě.
 */
const PUBLIC_ACTIONS = new Set([
  "actionGetWeekStarts",
  "actionGetClosures",
  "actionGetDepartments",
]);

function extractActions(source) {
  const found = [];
  const re = /export async function (action\w+)\(/g;
  const starts = [];
  let match;
  while ((match = re.exec(source)) !== null) starts.push([match[1], match.index]);

  for (let i = 0; i < starts.length; i++) {
    const [name, from] = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1][1] : source.length;
    found.push({ name, body: source.slice(from, to) });
  }
  return found;
}

const ACTIONS = extractActions(SOURCE);

test("v actions.ts jsou všechny akce vidět", () => {
  assert.ok(ACTIONS.length >= 45, `nalezeno jen ${ACTIONS.length} akcí — parser nejspíš selhal`);
});

test("každá neveřejná akce má guard", () => {
  const nechraneno = ACTIONS.filter(
    ({ name, body }) =>
      !PUBLIC_ACTIONS.has(name) &&
      !body.includes("guardAdmin()") &&
      !body.includes("guardSession()")
  ).map((a) => a.name);

  assert.deepEqual(
    nechraneno,
    [],
    `bez kontroly oprávnění: ${nechraneno.join(", ")}. Přidej guard, ` +
      "nebo akci vědomě zapiš do PUBLIC_ACTIONS."
  );
});

test("veřejný seznam obsahuje jen čtení", () => {
  for (const name of PUBLIC_ACTIONS) {
    assert.match(
      name,
      /^actionGet/,
      `„${name}" je ve veřejném seznamu, ale nevypadá jako čtení`
    );
  }
});

test("veřejný seznam odpovídá skutečným akcím", () => {
  const existujici = new Set(ACTIONS.map((a) => a.name));
  for (const name of PUBLIC_ACTIONS) {
    assert.ok(existujici.has(name), `„${name}" už v actions.ts není — uklid seznam`);
  }
});

// ── Pravidla nad guardy ─────────────────────────────────────────────────────

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-"));
process.env.DB_PATH = path.join(dataDir, "test.db");
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
process.env.COOKIE_SIGNING_SECRET = "test-cookie-signing-secret-with-32-bytes";

const lib = loadLib();
const { getDb } = await lib("db");
const { migrateAuth } = await lib("auth/schema");
const users = await lib("auth/users");
const policy = await lib("auth/policy");
const { AuthError } = await lib("auth/errors");
const db = getDb();

migrateAuth(db);

const orderId = Number(
  db.prepare("INSERT INTO orders (date) VALUES (?)").run("2026-08-26").lastInsertRowid
);
const addRow = (dept, name, personId) =>
  Number(
    db
      .prepare(
        "INSERT INTO order_rows (order_id, department, person_name, person_id) VALUES (?, ?, ?, ?)"
      )
      .run(orderId, dept, name, personId).lastInsertRowid
  );

const owner = users.createUserWithPassword({
  email: "vlastnik@example.cz",
  name: "Jana Nováková",
  password: "dostatecne-dlouhe-heslo",
  departmentId: 1,
});
const stranger = users.createUserWithPassword({
  email: "cizi@example.cz",
  name: "Petr Cizí",
  password: "dostatecne-dlouhe-heslo",
  departmentId: 2,
});

const ownRow = addRow("Konstrukce", "Jana Nováková", owner.personId);
const foreignRow = addRow("Dílna", "Petr Cizí", stranger.personId);
const unclaimedRow = addRow("Konstrukce", "", null);

const ownerSession = {
  sessionId: 1,
  userId: owner.userId,
  role: "user",
  personIds: [owner.personId],
};
const strangerSession = {
  sessionId: 2,
  userId: stranger.userId,
  role: "user",
  personIds: [stranger.personId],
};
const adminSession = { ...ownerSession, role: "admin" };

test("cizí řádek uživatel neupraví", async () => {
  await assert.rejects(
    () => policy.assertMayEditRow(strangerSession, ownRow),
    (err) => err instanceof AuthError && err.code === "CIZI_ZAZNAM"
  );
});

test("vlastník svůj řádek upraví a správce kterýkoli", async () => {
  await policy.assertMayEditRow(ownerSession, ownRow);
  await policy.assertMayEditRow(adminSession, foreignRow);
});

test("neexistující řádek se odmítne vždy", async () => {
  await assert.rejects(
    () => policy.assertMayEditRow(ownerSession, 999999),
    (err) => err instanceof AuthError && err.code === "CIZI_ZAZNAM"
  );
});

// Nový řádek vzniká prázdný. Kdyby ho pravidlo odmítalo, nešlo by objednat.
test("dosud nepřivlastněný řádek smí vyplnit každý přihlášený", async () => {
  await policy.assertMayEditRow(ownerSession, unclaimedRow);
  await policy.assertMayEditRow(strangerSession, unclaimedRow);
});

test("uživatel zapíše jen jméno svého strávníka", async () => {
  await policy.assertNameIsOwn(ownerSession, "Jana Nováková");
  await assert.rejects(
    () => policy.assertNameIsOwn(ownerSession, "Petr Cizí"),
    (err) => err instanceof AuthError && err.code === "CIZI_ZAZNAM"
  );
});

test("host pod účtem se zapsat smí", async () => {
  const hostId = db
    .prepare("INSERT INTO people (name, department_id, guest_of_person_id) VALUES (?, ?, ?)")
    .run("Marie Nováková", 1, owner.personId).lastInsertRowid;
  const sMulti = { ...ownerSession, personIds: [owner.personId, Number(hostId)] };

  await policy.assertNameIsOwn(sMulti, "Marie Nováková");
});

test("prázdné jméno projde, podvržený typ ne", async () => {
  await policy.assertNameIsOwn(ownerSession, "   ");
  for (const podvrh of [42, null, { toString: () => "Jana Nováková" }, ["Jana Nováková"]]) {
    await assert.rejects(
      () => policy.assertNameIsOwn(ownerSession, podvrh),
      (err) => err instanceof AuthError
    );
  }
});

test("správce zapíše i cizí jméno — opravuje cizí objednávky", async () => {
  await policy.assertNameIsOwn(adminSession, "Kdokoli Jiný");
});

test("id se ověřuje za běhu, ne typem", () => {
  for (const podvrh of [0, -1, 1.5, "3", null, undefined, NaN, Number.MAX_SAFE_INTEGER + 2]) {
    assert.throws(() => policy.assertId(podvrh, "číslo řádku"), AuthError);
  }
  assert.equal(policy.assertId(7, "číslo řádku"), 7);
});

// ── Přechod na účty ─────────────────────────────────────────────────────────
// Testuje se v samostatném procesu: accountsEnabled() si výsledek pamatuje,
// protože zpátky se přejít nedá.

test("dokud není správce, zápisy se nezamykají", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-boot-"));
  process.env.DB_PATH = path.join(dir, "boot.db");

  const lib2 = loadLib();
  const { getDb: openDb } = await lib2("db");
  const { migrateAuth: migrate } = await lib2("auth/schema");
  const users2 = await lib2("auth/users");
  const policy2 = await lib2("auth/policy");
  const bootDb = openDb();
  migrate(bootDb);

  assert.equal(policy2.accountsEnabled(), false, "bez správce běží předúčtový režim");

  users2.createUserWithPassword({
    email: "bezny@example.cz",
    name: "Běžný Uživatel",
    password: "dostatecne-dlouhe-heslo",
    departmentId: 1,
  });
  assert.equal(policy2.accountsEnabled(), false, "běžný účet režim nepřepne");

  const admin = users2.createUserWithPassword({
    email: "spravce@example.cz",
    name: "Správce Kantýny",
    password: "dostatecne-dlouhe-heslo",
    departmentId: 1,
  });
  users2.setUserRole(admin.userId, "admin");

  assert.equal(policy2.accountsEnabled(), true, "první správce zamkne zápisy");
});
