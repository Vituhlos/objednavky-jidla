// Testy strávníků (lib/people.ts) a migrace historických jmen (lib/db.ts).
//
// Motivace: člověk byl do teď jen text v řádku objednávky. Migrace z něj dělá
// stálou entitu — a protože běží nad ostrými daty a zpět už to nejde, testuje
// se proti syntetické databázi, která napodobuje produkci: víc lidí, stejná
// jména v různých odděleních, prázdná jména, mezery navíc.
//
// Spuštění:  node --test tools/people.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "people-"));
process.env.DB_PATH = path.join(dataDir, "test.db");

const lib = loadLib();
const { getDb } = await lib("db");
const people = await lib("people");

const db = getDb();

// ── Syntetická historie ─────────────────────────────────────────────────────
// Připravená tak, aby obsahovala všechny nepříjemné případy naráz.

const order = db.prepare("INSERT INTO orders (date) VALUES (?)").run("2026-05-04");
const orderId = Number(order.lastInsertRowid);
const order2 = db.prepare("INSERT INTO orders (date) VALUES (?)").run("2026-06-11");
const order2Id = Number(order2.lastInsertRowid);

const addRow = (oid, dept, name) =>
  Number(
    db
      .prepare("INSERT INTO order_rows (order_id, department, person_name) VALUES (?, ?, ?)")
      .run(oid, dept, name).lastInsertRowid
  );

const rows = {
  petrKonstrukce1: addRow(orderId, "Konstrukce", "Petr Novák"),
  petrKonstrukce2: addRow(order2Id, "Konstrukce", "Petr Novák"),
  petrDilna: addRow(orderId, "Dílna", "Petr Novák"),      // jiný Petr Novák!
  jana: addRow(orderId, "Dílna", "Jana Malá"),
  janaMezery: addRow(order2Id, "Dílna", "  Jana Malá  "), // mezery navíc
  prazdny: addRow(orderId, "Kanceláře", ""),              // nevyplněné jméno
};

// Migrace běží při otevření databáze, ale řádky jsme vložili až po něm —
// pustíme ji znovu tím, že si vynutíme nové připojení.
const { getDb: getDb2 } = await lib("db");
void getDb2;

// Ruční dopočet: v testu voláme stejnou cestu, jakou používá aplikace.
for (const [, rowId] of Object.entries(rows)) {
  const r = db.prepare("SELECT person_name, department FROM order_rows WHERE id = ?").get(rowId);
  if (r.person_name.trim()) {
    const pid = people.findOrCreatePerson(r.person_name, r.department);
    db.prepare("UPDATE order_rows SET person_id = ? WHERE id = ?").run(pid, rowId);
  }
}

// ── Testy ───────────────────────────────────────────────────────────────────

test("dva lidé se stejným jménem v různých odděleních zůstanou oddělení", () => {
  const all = people.getPeople().filter((p) => p.name === "Petr Novák");
  assert.equal(all.length, 2, "Petr Novák z Konstrukce a z Dílny jsou dva lidé");
  const depts = all.map((p) => p.departmentName).sort();
  assert.deepEqual(depts, ["Dílna", "Konstrukce"]);
});

test("stejné jméno se stejným oddělením se nezdvojí", () => {
  const jana = people.getPeople().filter((p) => p.name === "Jana Malá");
  assert.equal(jana.length, 1, "mezery navíc nesmí založit druhou Janu");
  assert.equal(jana[0].orderCount, 2, "oba řádky patří jí");
});

test("prázdné jméno strávníka nezaloží", () => {
  assert.equal(
    people.getPeople().some((p) => p.name.trim() === ""),
    false
  );
  const row = db.prepare("SELECT person_id FROM order_rows WHERE id = ?").get(rows.prazdny);
  assert.equal(row.person_id, null);
});

test("počty objednávek a poslední datum sedí", () => {
  const petr = people
    .getPeople()
    .find((p) => p.name === "Petr Novák" && p.departmentName === "Konstrukce");
  assert.equal(petr.orderCount, 2);
  assert.equal(petr.lastOrderDate, "2026-06-11");
});

test("přejmenování změní strávníka, ale ne otisk v historii", () => {
  const jana = people.getPeople().find((p) => p.name === "Jana Malá");
  people.renamePerson(jana.id, "Jana Veselá");

  assert.equal(people.getPerson(jana.id).name, "Jana Veselá");

  const snapshot = db
    .prepare("SELECT person_name FROM order_rows WHERE id = ?")
    .get(rows.jana);
  assert.equal(snapshot.person_name, "Jana Malá", "historická objednávka si drží původní jméno");
});

test("přejmenování se zapíše do auditu", () => {
  const entry = db
    .prepare("SELECT action, details FROM audit_log WHERE action = 'person_rename' ORDER BY id DESC")
    .get();
  assert.ok(entry, "záznam musí existovat");
  assert.match(entry.details, /Jana Malá → Jana Veselá/);
});

test("sloučení přesune historii a zdroj zmizí", () => {
  const [a, b] = people.getPeople().filter((p) => p.name === "Petr Novák");
  const before = a.orderCount + b.orderCount;

  people.mergePeople(b.id, a.id);

  assert.equal(people.getPerson(b.id), null, "zdroj byl smazán");
  assert.equal(people.getPerson(a.id).orderCount, before, "historie se nikam neztratila");
});

test("sloučit strávníka sám se sebou nejde", () => {
  const petr = people.getPeople().find((p) => p.name === "Petr Novák");
  assert.throws(() => people.mergePeople(petr.id, petr.id), /sám se sebou/);
});

test("strávníka s objednávkami nejde smazat", () => {
  const petr = people.getPeople().find((p) => p.name === "Petr Novák");
  assert.throws(() => people.deletePerson(petr.id), /historii/);
});

test("deaktivace strávníka ho nechá v seznamu", () => {
  const petr = people.getPeople().find((p) => p.name === "Petr Novák");
  people.setPersonActive(petr.id, false);
  assert.equal(people.getPerson(petr.id).active, false);
  assert.ok(people.getPeople().some((p) => p.id === petr.id), "zůstává vidět");
});

test("bez tabulky účtů nemá nikdo účet — pravidlo R4 zatím nic neblokuje", () => {
  const petr = people.getPeople().find((p) => p.name === "Petr Novák");
  assert.equal(people.hasAccount(petr.id), false);
});

test("jakmile účty existují, sloučení strávníka s účtem se odmítne", () => {
  // Předběhneme fázi 2 a vytvoříme tabulku, kterou `hasAccount` hledá.
  db.exec("CREATE TABLE IF NOT EXISTS user_people (user_id INTEGER, person_id INTEGER)");

  const target = people.getPeople().find((p) => p.name === "Petr Novák");
  const sourceId = people.findOrCreatePerson("Petr Novák", "Kanceláře");
  db.prepare("INSERT INTO user_people (user_id, person_id) VALUES (1, ?)").run(sourceId);

  assert.equal(people.hasAccount(sourceId), true);
  assert.throws(() => people.mergePeople(sourceId, target.id), /má vlastní účet/);

  db.exec("DROP TABLE user_people");
});

// ── Migrace samotná ─────────────────────────────────────────────────────────
// Výše se testovala cesta, kterou používá aplikace za běhu. Tohle testuje
// funkci, která jednou proběhne nad ostrou databází.

test("migrace napojí historické řádky a je opakovatelná", async () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "people-mig-"));
  process.env.DB_PATH = path.join(dir2, "mig.db");

  const lib2 = loadLib();
  const { getDb: openDb, backfillPeople } = await lib2("db");
  const mdb = openDb();

  const oid = Number(
    mdb.prepare("INSERT INTO orders (date) VALUES ('2026-04-03')").run().lastInsertRowid
  );
  const ins = mdb.prepare("INSERT INTO order_rows (order_id, department, person_name) VALUES (?, ?, ?)");
  ins.run(oid, "Konstrukce", "Karel Dvořák");
  ins.run(oid, "Konstrukce", "Karel Dvořák");
  ins.run(oid, "Dílna", "Karel Dvořák");
  ins.run(oid, "Dílna", "  Eva Nová ");
  ins.run(oid, "Kanceláře", "");
  mdb.prepare("UPDATE order_rows SET person_id = NULL").run();

  backfillPeople(mdb);

  const created = mdb.prepare("SELECT name, department_id FROM people ORDER BY name").all();
  assert.equal(created.length, 3, "dva Karlové (různá oddělení) + Eva");

  const unlinked = mdb
    .prepare("SELECT COUNT(*) n FROM order_rows WHERE person_id IS NULL AND TRIM(person_name) <> ''")
    .get();
  assert.equal(unlinked.n, 0, "všechny neprázdné řádky mají vazbu");

  const empty = mdb.prepare("SELECT person_id FROM order_rows WHERE person_name = ''").get();
  assert.equal(empty.person_id, null, "prázdné jméno zůstalo bez vazby");

  // Druhý běh nesmí nic zdvojit — migrace běží při každém startu.
  backfillPeople(mdb);
  assert.equal(mdb.prepare("SELECT COUNT(*) n FROM people").get().n, 3, "opakovaný běh nic nepřidá");
});

test("varianty téhož jména ve stejném oddělení se nabídnou jako jistota", () => {
  people.findOrCreatePerson("Zdeněk Říha", "Konstrukce");
  people.findOrCreatePerson("Zdenek Riha", "Konstrukce"); // bez háčků

  const group = people
    .findDuplicateGroups()
    .find((g) => g.people.some((p) => p.name === "Zdenek Riha"));

  assert.ok(group, "skupina musí existovat");
  assert.equal(group.kind, "same-department");
  assert.equal(group.people.length, 2);
});

test("stejné jméno ve dvou odděleních se nikdy nevydává za jistotu", () => {
  people.findOrCreatePerson("Alena Šimková", "Konstrukce");
  people.findOrCreatePerson("Alena Šimková", "Dílna");

  const groups = people
    .findDuplicateGroups()
    .filter((g) => g.people.some((p) => p.name === "Alena Šimková"));

  assert.equal(groups.length, 1, "jediná skupina, a to ta slabší");
  assert.equal(groups[0].kind, "cross-department");
  assert.deepEqual(
    groups[0].people.map((p) => p.departmentName).sort(),
    ["Dílna", "Konstrukce"],
    "zastoupena jsou obě oddělení"
  );
});

// Jádro věci: slepit dva různé lidi je nevratné, nechat jednoho rozděleného ne.
// Do skupiny, kterou appka nabízí ke sloučení, proto nesmí spadnout dvě oddělení.
test("do jisté skupiny se nikdy nedostanou lidé z různých oddělení", () => {
  for (const group of people.findDuplicateGroups()) {
    if (group.kind !== "same-department") continue;
    const depts = new Set(group.people.map((p) => p.departmentId));
    assert.equal(depts.size, 1, `„${group.label}“ míchá oddělení dohromady`);
  }
});

test("napříč odděleními zastupuje oddělení ten s nejdelší historií", () => {
  people.findOrCreatePerson("Ivan Král", "Konstrukce");
  const busy = people.findOrCreatePerson("Ivan Kral", "Konstrukce");
  people.findOrCreatePerson("Ivan Král", "Dílna");

  const rowId = addRow(orderId, "Konstrukce", "Ivan Kral");
  db.prepare("UPDATE order_rows SET person_id = ? WHERE id = ?").run(busy, rowId);

  const cross = people
    .findDuplicateGroups()
    .find((g) => g.kind === "cross-department" && g.people.some((p) => p.name.startsWith("Ivan")));

  assert.ok(cross, "skupina přes oddělení musí existovat");
  const konstrukce = cross.people.find((p) => p.departmentName === "Konstrukce");
  assert.equal(konstrukce.id, busy, "zastupuje ten, kdo má objednávku");
});

test("různá jména se do jedné skupiny nedostanou", () => {
  for (const group of people.findDuplicateGroups()) {
    const normalized = new Set(
      group.people.map((p) =>
        p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
      )
    );
    assert.equal(normalized.size, 1, `skupina musí mít jeden normalizovaný tvar: ${[...normalized]}`);
  }
});
