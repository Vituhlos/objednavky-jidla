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

const SOURCE = ["app/actions.ts", "app/actions-auth.ts"]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

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
  // Vstupy do přihlášení. Guard by tu neměl co dělat — jsou to dveře, ne trezor.
  // Vlastní obranu mají v omezení pokusů na IP a v obecné hlášce, která
  // neprozradí, které e-maily tu účet mají.
  "actionLogin",
  "actionLogout",
  // Registrace je z podstaty pro nepřihlášené (R2). Brání se limitem pokusů
  // na IP a tím, že existenci účtu neprozradí.
  "actionRegister",
  // Kdo zapomněl heslo, nemůže být přihlášený. Obranou je limit pokusů na IP
  // a to, že odpověď je stejná pro existující i neexistující účet.
  "actionRequestPasswordReset",
  "actionResetPassword",
  // Host se registruje z pozvánky, takže přihlášený být nemůže. Oprávněním
  // je sám token — jednorázový, sedmidenní a v databázi jen jako otisk.
  "actionRegisterGuest",
  // Propojení Googlu s heslovým účtem probíhá před přihlášením — právě tím se
  // člověk přihlašuje. Obranou je heslo (R6), podepsaná cookie s profilem
  // a limit pokusů na IP.
  "actionConfirmGoogleLink",
]);

/**
 * Co se počítá za kontrolu oprávnění.
 *
 * Obaly drží konkrétní hranice: session, správce a správce s PIN step-upem.
 */
const GUARDS = [
  "guardAdmin()",
  "guardSettings()",
  "guardSession()",
  "requireSession()",
  "requireAdmin()",
  "requireAdminWithPin()",
];

/**
 * V souboru s „use server“ je **každá** exportovaná async funkce server action,
 * ať se jmenuje jakkoli. Kdyby se hledaly jen názvy začínající „action“, stačilo
 * by pomocnou funkci pojmenovat jinak a proklouzla by bez kontroly.
 */
function extractActions(source) {
  const found = [];
  const re = /export async function (\w+)\(/g;
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
      !PUBLIC_ACTIONS.has(name) && !GUARDS.some((g) => body.includes(g))
  ).map((a) => a.name);

  assert.deepEqual(
    nechraneno,
    [],
    `bez kontroly oprávnění: ${nechraneno.join(", ")}. Přidej guard, ` +
      "nebo akci vědomě zapiš do PUBLIC_ACTIONS."
  );
});

const LOGIN_ACTIONS = new Set([
  "actionLogin",
  "actionLogout",
  "actionRegister",
  "actionRequestPasswordReset",
  "actionResetPassword",
  // Host se registruje z pozvánky, takže přihlášený být nemůže. Oprávněním
  // je sám token — jednorázový, sedmidenní a v databázi jen jako otisk.
  "actionRegisterGuest",
  "actionConfirmGoogleLink",
]);

test("veřejný seznam obsahuje jen čtení a vstup do přihlášení", () => {
  for (const name of PUBLIC_ACTIONS) {
    if (LOGIN_ACTIONS.has(name)) continue;
    assert.match(
      name,
      /^actionGet/,
      `„${name}" je ve veřejném seznamu, ale nevypadá jako čtení`
    );
  }
});

test("PIN brána nejdřív vyžádá správce a vydá session-bound doklad", () => {
  const telo = ACTIONS.find((a) => a.name === "actionCheckPin")?.body;
  assert.ok(telo, "actionCheckPin musí existovat");
  assert.ok(
    telo.indexOf("requireAdmin()") < telo.indexOf("checkRateLimit("),
    "PIN se nesmí ověřovat před správcovskou session"
  );
  assert.match(telo, /checkRateLimit\(/, "bez limitu by šel PIN hádat");
  assert.match(telo, /issuePinProof\(session\)/, "doklad musí být vázaný na session");

  const brana = fs.readFileSync("lib/auth/pin-gate.ts", "utf8");
  assert.match(brana, /httpOnly: true/, "doklad nesmí být čitelný z JavaScriptu");
  assert.match(brana, /sameSite: "strict"/, "step-up cookie nesmí odcházet v cross-site požadavku");
  assert.match(brana, /timingSafeEqual/, "podpis se porovnává konstantním časem");
  assert.doesNotMatch(brana, /pin:\$\{getSettings\(\)\.settingsPin\}/, "PIN nesmí být HMAC klíč");
});

test("přihlašovací akce omezují počet pokusů", () => {
  const zdroj = fs.readFileSync("app/actions-auth.ts", "utf8");
  assert.match(zdroj, /isRateLimited\(/, "před pokusem se musí číst rozpočet");
  assert.match(zdroj, /checkRateLimit\(/, "neúspěch musí rozpočet ubrat");
});

test("přihlášení nerozlišuje neznámý e-mail od špatného hesla", () => {
  // Jen tělo actionLogin — věta o formátu hesla při registraci existenci
  // účtu neprozrazuje a do téhle kontroly nepatří.
  const telo = ACTIONS.find((a) => a.name === "actionLogin")?.body;
  assert.ok(telo, "actionLogin musí existovat");

  const hlasky = [...telo.matchAll(/error: (BAD_CREDENTIALS|"[^"]+")/g)].map((m) => m[1]);
  const konkretni = hlasky.filter((h) => h !== "BAD_CREDENTIALS" && /e-mail|heslo/i.test(h));
  assert.deepEqual(konkretni, [], `chybová hláška je příliš konkrétní: ${konkretni.join(", ")}`);
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

test("chybějící správce nikdy neotevře předúčtový zapisovací režim", () => {
  assert.equal(policy.accountsEnabled(), true);
});

test("PIN kontrola není veřejná akce", () => {
  assert.equal(PUBLIC_ACTIONS.has("actionCheckPin"), false);
});

test("server Nastavení vyžádá správce a neposílá celý settings objekt", () => {
  const source = fs.readFileSync("app/nastaveni/page.tsx", "utf8");
  assert.ok(source.indexOf("await requireAdmin()") < source.indexOf("getSettingsForClient()"));
  assert.doesNotMatch(source, /\bgetSettings\(\)/);
});

// ── Doklad o PINu ───────────────────────────────────────────────────────────

const pinGate = await lib("auth/pin-gate");
const settings = await lib("settings");
const proofSession = { sessionId: 10, userId: owner.userId, role: "admin", personIds: [owner.personId] };
const proofNow = Date.now();

test("DTO Nastavení nikdy neobsahuje uložená tajemství", () => {
  const secret = "canary-secret-that-must-not-reach-rsc";
  settings.saveSettings({
    smtpPass: secret,
    imapPass: secret,
    vapidPrivateKey: secret,
    telegramBotToken: secret,
    googleClientSecret: secret,
    telegramWebhookSecret: secret,
  });

  const dto = settings.getSettingsForClient();
  assert.doesNotMatch(JSON.stringify(dto), new RegExp(secret));
  assert.equal(dto.settingsPin, "");
  assert.equal(dto.smtpPass, settings.SECRET_MASK);

  const sanitized = settings.sanitizeClientSettingsUpdates({
    smtpPass: settings.SECRET_MASK,
    imapPass: "",
    smtpHost: "smtp.example.cz",
  });
  assert.deepEqual(sanitized, { smtpHost: "smtp.example.cz" });
});

test("čerstvý doklad platí jen pro session, pro kterou vznikl", () => {
  const doklad = pinGate.issuePinProof(proofSession, proofNow);
  assert.equal(pinGate.verifyPinProof(doklad, proofSession, proofNow), true);
  assert.equal(
    pinGate.verifyPinProof(doklad, { ...proofSession, sessionId: 11 }, proofNow),
    false
  );

  const [payload, podpis] = doklad.split(".");
  for (const podvrh of [
    undefined,
    "",
    payload,
    `${payload}.`,
    `${payload}.${podpis}x`,
    `${payload}x.${podpis}`,
    `nesmysl.${podpis}`,
  ]) {
    assert.equal(pinGate.verifyPinProof(podvrh, proofSession, proofNow), false, `prošlo: ${podvrh}`);
  }
});

test("prošlý ani předem vystavený doklad neprojde", () => {
  const doklad = pinGate.issuePinProof(proofSession, proofNow);
  assert.equal(pinGate.verifyPinProof(doklad, proofSession, proofNow + 30 * 60 * 1000), false);

  const futureProof = pinGate.issuePinProof(proofSession, proofNow + 2 * 60 * 1000);
  assert.equal(pinGate.verifyPinProof(futureProof, proofSession, proofNow), false);
});

test("změna PINu zneplatní vydané doklady", () => {
  settings.saveSettings({ settingsPin: "1234" });
  const doklad = pinGate.issuePinProof(proofSession, proofNow);
  assert.equal(pinGate.verifyPinProof(doklad, proofSession, proofNow), true);

  settings.saveSettings({ settingsPin: "9876" });
  assert.equal(
    pinGate.verifyPinProof(doklad, proofSession, proofNow),
    false,
    "starý doklad musí přestat platit"
  );
});

test("bez samostatného silného secretu se doklad nevydá", () => {
  const previous = process.env.COOKIE_SIGNING_SECRET;
  delete process.env.COOKIE_SIGNING_SECRET;
  assert.throws(() => pinGate.issuePinProof(proofSession), /alespoň 32 bajtů/);
  process.env.COOKIE_SIGNING_SECRET = previous;
});
