// Diagnostika před migrací strávníků.
//
// Vypíše, jak vypadají jména v ostré databázi — **jen počty a vzory, žádná
// jména**. Slouží k odhadu, kolik duplicit po migraci vznikne a jestli
// nečekají překvapení (přejmenovaná oddělení, jména lišící se jen diakritikou).
//
// Spuštění na Unraidu, uvnitř kontejneru:
//   docker exec -it <kontejner> node tools/people-diagnostika.mjs
//
// Databáze se otevírá jen pro čtení, nic nezapisuje.

import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db");
const db = new Database(DB_PATH, { readonly: true });

/** Klíč pro porovnání „skoro stejných“ jmen: bez diakritiky, mezer a velikosti. */
const normalize = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const rows = db
  .prepare(
    `SELECT r.person_name AS name, r.department AS dept, COUNT(*) AS n
     FROM order_rows r
     GROUP BY r.person_name, r.department`
  )
  .all();

const named = rows.filter((r) => r.name.trim() !== "");
const pairs = named.length;
const distinctNames = new Set(named.map((r) => r.name)).size;
const emptyRows = rows.filter((r) => r.name.trim() === "").reduce((s, r) => s + r.n, 0);

// Jméno ve víc odděleních → po migraci vzniknou dva strávníci
const byName = {};
for (const r of named) (byName[r.name] ||= new Set()).add(r.dept);
const multiDept = Object.values(byName).filter((d) => d.size > 1).length;

// Jména, která se liší jen diakritikou, velikostí písmen nebo mezerami
const byNormalized = {};
for (const r of named) (byNormalized[normalize(r.name)] ||= new Set()).add(r.name);
const nearDuplicates = Object.values(byNormalized).filter((v) => v.size > 1);

// Oddělení v řádcích, která už v tabulce departments nejsou
const knownDepts = new Set(db.prepare("SELECT name FROM departments").all().map((d) => d.name));
const unknownDepts = [...new Set(named.map((r) => r.dept))].filter((d) => !knownDepts.has(d));

console.log("── Strávníci: co čeká migraci ──");
console.log("dvojic (jméno, oddělení):        ", pairs, "← tolik strávníků vznikne");
console.log("z toho unikátních jmen:          ", distinctNames);
console.log("jmen ve víc odděleních:          ", multiDept, "← vzniknou dva záznamy, ke sloučení");
console.log("skupin skoro stejných jmen:      ", nearDuplicates.length, "← překlepy, ke sloučení");
console.log("řádků bez vyplněného jména:      ", emptyRows, "← zůstanou bez vazby, to je v pořádku");
console.log("oddělení, která už neexistují:   ", unknownDepts.length, "← strávník zůstane bez oddělení");

if (nearDuplicates.length > 0) {
  console.log("\n── Skoro stejná jména (jen délky, ne obsah) ──");
  for (const variants of nearDuplicates) {
    console.log("  skupina:", [...variants].map((v) => `${v.length} znaků`).join(" / "));
  }
  console.log("\n  Podívej se na ně sám v Nastavení → Strávníci; sloučíš je tam po migraci.");
}

db.close();
