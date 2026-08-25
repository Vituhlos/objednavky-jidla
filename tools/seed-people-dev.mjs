// Naplní VÝVOJOVOU databázi vymyšlenými objednávkami, aby šla proklikat
// sekce Nastavení → Lidé → Strávníci.
//
// Data jsou schválně ošklivá — přesně tak, jak vypadá reálná historie:
//   · dva různí lidé se stejným jménem v jiných odděleních
//   · překlepy a chybějící diakritika u téhož člověka
//   · mezery navíc
//   · řádky bez vyplněného jména
//
// Spuštění:   node tools/seed-people-dev.mjs
// Úklid:      node tools/seed-people-dev.mjs --clean
//
// Odmítne běžet, když v databázi najde objednávky, které nezaložil sám —
// aby se omylem nespustil proti ostrým datům.

import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db");
const CLEAN = process.argv.includes("--clean");

// Dny, které si seed vyhrazuje. Nic mimo ně nemaže.
const DATES = ["2026-03-02", "2026-03-03", "2026-03-04"];

const db = new Database(DB_PATH);

function clean() {
  const ids = db
    .prepare(`SELECT id FROM orders WHERE date IN (${DATES.map(() => "?").join(",")})`)
    .all(...DATES)
    .map((r) => r.id);

  db.transaction(() => {
    for (const id of ids) {
      db.prepare("DELETE FROM order_rows WHERE order_id = ?").run(id);
      db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    }
    // Strávníky bez jediné objednávky založené seedem uklidíme taky.
    db.prepare(
      "DELETE FROM people WHERE id NOT IN (SELECT DISTINCT person_id FROM order_rows WHERE person_id IS NOT NULL)"
    ).run();
  })();

  console.log(`Uklizeno: ${ids.length} objednávek a osiřelí strávníci.`);
}

if (CLEAN) {
  clean();
  db.close();
  process.exit(0);
}

// Pojistka proti spuštění nad ostrou databází.
//
// Neměří počet objednávek — prázdných konceptů bývá i ve vývoji spousta.
// Měří **jména skutečných lidí**, protože právě ta by seed neměl potkat.
const foreign = db
  .prepare(
    `SELECT COUNT(DISTINCT r.person_name) AS n
     FROM order_rows r
     JOIN orders o ON o.id = r.order_id
     WHERE TRIM(r.person_name) <> '' AND o.date NOT IN (${DATES.map(() => "?").join(",")})`
  )
  .get(...DATES);
if (foreign.n > 3) {
  console.error(
    `V databázi je ${foreign.n} různých jmen v objednávkách — vypadá to na ostrá data.\n` +
      "Seed je jen pro vývoj a do ostré databáze nepatří."
  );
  db.close();
  process.exit(1);
}

clean();

const ROWS = [
  // den, oddělení, jméno
  [0, "Konstrukce", "Petr Novák"],
  [1, "Konstrukce", "Petr Novák"],
  [2, "Konstrukce", "Petr Novak"],       // chybí diakritika — týž člověk
  [0, "Dílna",      "Petr Novák"],        // JINÝ Petr Novák, jiné oddělení
  [1, "Dílna",      "Petr Novák"],
  [0, "Dílna",      "Jana Malá"],
  [1, "Dílna",      "  Jana Malá  "],     // mezery navíc — týž člověk
  [2, "Dílna",      "Jana Mala"],         // překlep — týž člověk
  [0, "Kanceláře",  "Eva Dvořáková"],
  [1, "Kanceláře",  "Eva Dvořáková"],
  [2, "Kanceláře",  "Tomáš Král"],
  [0, "Kanceláře",  ""],                  // nevyplněné jméno
];

db.transaction(() => {
  const orderIds = DATES.map((date) => {
    db.prepare("INSERT OR IGNORE INTO orders (date, status) VALUES (?, 'draft')").run(date);
    return db.prepare("SELECT id FROM orders WHERE date = ?").get(date).id;
  });

  const insert = db.prepare(
    "INSERT INTO order_rows (order_id, department, sort_order, person_name) VALUES (?, ?, ?, ?)"
  );
  let n = 0;
  for (const [dayIndex, dept, name] of ROWS) {
    insert.run(orderIds[dayIndex], dept, n++, name);
  }
})();

// Strávníky schválně nezakládáme tady — udělá to migrace při startu aplikace.
// Tím se rovnou vyzkouší přesně ta cesta, která poběží na ostrých datech.
console.log(`Vytvořeno ${ROWS.length} řádků ve 3 objednávkách.`);
console.log("Strávníci vzniknou při startu aplikace (spustí se migrace).");
console.log("\nOtevři Nastavení → Lidé → Strávníci. Čekej:");
console.log("  · dva „Petr Novák“ (Konstrukce a Dílna) — RŮZNÍ lidé, neslučovat");
console.log("  · „Petr Novak“ bez háčku — týž člověk jako Petr Novák z Konstrukce, sloučit");
console.log("  · „Jana Malá“ a „Jana Mala“ — sloučit");
console.log("  · řádek bez jména strávníka nezaložil");
console.log("\nÚklid:  node tools/seed-people-dev.mjs --clean");

db.close();
