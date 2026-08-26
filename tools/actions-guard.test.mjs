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
  // Sama je tou branou: ověří PIN a vydá krátkodobý doklad, který guardAdmin
  // uznává. PIN zůstává zadními vrátky do Nastavení — vědomá odchylka od R12,
  // aby šlo appku odemknout, kdyby se přihlašování rozbilo.
  "actionCheckPin",
]);

/**
 * Co se počítá za kontrolu oprávnění.
 *
 * guardAdmin a guardSession jsou obaly, které navíc pouštějí představ bez účtů.
 * requireSession a requireAdmin jsou též kontroly — akce, která dává smysl jen
 * přihlášenému, si je volá přímo.
 */
const GUARDS = ["guardAdmin()", "guardSession()", "requireSession()", "requireAdmin()"];

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
  "actionCheckPin",
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

test("PIN brána omezuje počet pokusů a vydává jen krátkodobý doklad", () => {
  const telo = ACTIONS.find((a) => a.name === "actionCheckPin")?.body;
  assert.ok(telo, "actionCheckPin musí existovat");
  assert.match(telo, /checkRateLimit\(/, "bez limitu by šel PIN hádat");
  assert.match(telo, /vystavPinDoklad\(\)/, "úspěch musí vydat doklad");
  assert.match(telo, /settings_pin_bypass/, "vstup mimo správce se musí zapsat do auditu");

  const brana = fs.readFileSync("lib/auth/pin-gate.ts", "utf8");
  assert.match(brana, /httpOnly: true/, "doklad nesmí být čitelný z JavaScriptu");
  assert.match(brana, /timingSafeEqual/, "podpis se porovnává konstantním časem");
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

// ── Doklad o PINu ───────────────────────────────────────────────────────────
// Zadní vrátka do Nastavení bez správcovského účtu. Vědomá odchylka od R12,
// takže o to víc záleží, aby se nedal podvrhnout.

const pinGate = await lib("auth/pin-gate");
const settings = await lib("settings");

test("čerstvý doklad projde, podvržený ne", () => {
  const doklad = pinGate.vystavPinDoklad();
  assert.equal(pinGate.jePinDokladPlatny(doklad), true);

  const [platiDo, podpis] = doklad.split(".");
  for (const podvrh of [
    undefined,
    "",
    platiDo,
    `${platiDo}.`,
    `${platiDo}.${podpis}x`,
    `${Number(platiDo) + 3_600_000}.${podpis}`, // prodloužená platnost, starý podpis
    `nesmysl.${podpis}`,
  ]) {
    assert.equal(pinGate.jePinDokladPlatny(podvrh), false, `prošlo: ${podvrh}`);
  }
});

test("prošlý doklad neprojde", () => {
  const stary = `${Date.now() - 1000}.cokoli`;
  assert.equal(pinGate.jePinDokladPlatny(stary), false);
});

test("změna PINu zneplatní vydané doklady", () => {
  // Bez vyhrazeného COOKIE_SIGNING_SECRET se podepisuje otiskem PINu, takže
  // jeho změna staré doklady odřízne. To je vlastnost, ne vedlejší účinek.
  delete process.env.COOKIE_SIGNING_SECRET;
  settings.saveSettings({ settingsPin: "1234" });
  const doklad = pinGate.vystavPinDoklad();
  assert.equal(pinGate.jePinDokladPlatny(doklad), true);

  settings.saveSettings({ settingsPin: "9876" });
  assert.equal(pinGate.jePinDokladPlatny(doklad), false, "starý doklad musí přestat platit");
});
