// Regresní test stránkování objednávkového PDF.
//
// Pozadí: drawTable() dřív kreslila řádky na absolutní souřadnice a vůbec
// se nestránkovala. Jakmile tabulka přetekla přes spodní okraj, pdfkit
// zakládal novou stránku při každém volání doc.text(), tj. pro každou buňku
// zvlášť — z objednávky na 21.08.2026 (23 objednávek) vypadlo 51 stran,
// kde na většině byla jen jedna útržkovitá hodnota.
//
// Spuštění:  node --test tools/order-pdf.test.mjs
//            (nebo npm run test:pdf)

import test from "node:test";
import assert from "node:assert/strict";

import { loadLib, resolveFontDir } from "./test-helpers.mjs";

process.env.PDF_FONT_DIR = resolveFontDir();
const lib = loadLib();

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const item = (id, type, code, name) => ({
  id, weekLabel: null, day: "Pá", type, code, name, price: 0, allergens: "",
});

const SOUP = item(1, "Polévka", "A", "Zelná s uzeným masem a klobásou");
const MEALS = [
  item(11, "Jídlo", "1", "Plněný paprikový lusk, rýže"),
  item(14, "Jídlo", "3", "Steak z hovězí svíčkové, švestková omáčka, bramboráčky"),
  item(15, "Jídlo", "4", "Špalek z vepřové krkovičky pečený v bbq marinádě, pečené brambory, coleslaw"),
  item(16, "Jídlo", "5", "Katův šleh z krůtího masa, bramboráčky"),
];
const LONG_NOTE =
  "Bez cibule, přílohu zvlášť, a kdyby došlo hlavní jídlo, tak cokoliv " +
  "bezmasého — poznámka schválně dlouhá, ať se buňka zalomí na víc řádků.";

function makeRow(i, department) {
  return {
    id: i, orderId: 1, department, sortOrder: i,
    personName: i % 9 === 0 ? `Osoba S Opravdu Dlouhým Jménem ${i}` : `Osoba ${i}`,
    soupItemId: null, soupItemId2: null, mainItemId: null,
    mealCount: i % 11 === 0 ? 2 : 1, extraMeals: [],
    rollCount: i % 5 === 0 ? 2 : 0, breadDumplingCount: 0, potatoDumplingCount: 0,
    ketchupCount: i % 6 === 0 ? 1 : 0, tatarkaCount: 0, bbqCount: 0,
    note: i % 7 === 0 ? LONG_NOTE : "",
    soupItem: i % 3 === 0 ? SOUP : null,
    soupItem2: i % 8 === 0 ? SOUP : null,
    // každý čtvrtý jezdec bez jídla — jen polévka, ať se trefíme i do větve "bez jídla"
    mainItem: i % 4 === 0 ? null : MEALS[i % MEALS.length],
    extraMealItems: i % 13 === 0 ? [{ item: MEALS[0], count: 2 }] : [],
    rowPrice: 0,
  };
}

function makeOrderData(counts) {
  const names = ["Konstrukce", "Dílna/Hala", "Kanceláře (obchod)", "Sklad", "Údržba"];
  let seq = 0;
  const departments = counts.map((count, d) => ({
    name: `dept${d}`, label: names[d % names.length], emailLabel: names[d % names.length],
    accent: "#4E7A8E",
    rows: Array.from({ length: count }, () => makeRow(++seq, `dept${d}`)),
    subtotal: 0,
  }));
  return {
    order: { id: 1, date: "2026-08-21" },
    departments,
    todayMenu: { soups: [SOUP], meals: MEALS },
    totalPrice: 0,
    dayCode: "PA",
  };
}

// ---------------------------------------------------------------------------
// Rozbor vygenerovaného PDF (pdf-parse je běžná závislost projektu)
// ---------------------------------------------------------------------------
// Přímo vnitřní modul — pdf-parse/index.js pod čistým ESM považuje běh za
// debug (module.parent === null) a snaží se načíst svoje vlastní testovací PDF.
const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");

async function pageTexts(buffer) {
  const pages = [];
  await pdfParse(buffer, {
    pagerender: async (page) => {
      const content = await page.getTextContent();
      pages.push(content.items.map((i) => i.str).join(" "));
      return "";
    },
  });
  return pages;
}

const HEADERS = ["Jméno", "Polévka", "Jídlo", "Přílohy", "Poznámka"];

/**
 * Invarianty, které rozbité stránkování porušovalo:
 *  1. každá stránka nese hlavičku tabulky (rozbitá verze měla stránky s jediným slovem)
 *  2. počet stran roste lineárně s řádky, ne skokově
 *  3. žádná stránka není prakticky prázdná (kromě poslední, ta doběhnout smí)
 */
async function assertPagination(buffer, totalRows, label) {
  const pages = await pageTexts(buffer);

  const maxPages = Math.ceil(totalRows / 8) + 3;
  assert.ok(
    pages.length <= maxPages,
    `${label}: ${pages.length} stran pro ${totalRows} řádků (limit ${maxPages}) — stránkování je rozbité`
  );

  pages.forEach((text, i) => {
    assert.ok(
      HEADERS.every((h) => text.includes(h)),
      `${label}: stránka ${i + 1}/${pages.length} nemá hlavičku tabulky`
    );
  });

  pages.slice(0, -1).forEach((text, i) => {
    assert.ok(
      text.length > 400,
      `${label}: stránka ${i + 1}/${pages.length} je skoro prázdná (${text.length} znaků)`
    );
  });

  return pages;
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------
const { buildOrderPdfAttachment, buildDepartmentPdfAttachment } = await lib("order-pdf");

test("souhrnné PDF se stránkuje – reálná objednávka z 21.08.2026", async () => {
  const data = makeOrderData([11, 10, 2]);
  const { content } = await buildOrderPdfAttachment(data);
  const pages = await assertPagination(content, 23, "23 řádků / 3 oddělení");
  assert.ok(pages.length <= 3, `čekáno max 3 strany, dostal jsem ${pages.length}`);
});

for (const total of [50, 120, 300, 800]) {
  test(`souhrnné PDF se stránkuje – ${total} řádků`, async () => {
    const data = makeOrderData([total]);
    const { content } = await buildOrderPdfAttachment(data);
    await assertPagination(content, total, `${total} řádků`);
  });
}

test("souhrnné PDF se stránkuje – 5 oddělení po 60 řádcích", async () => {
  const data = makeOrderData([60, 60, 60, 60, 60]);
  const { content } = await buildOrderPdfAttachment(data);
  const pages = await assertPagination(content, 300, "5×60 řádků");

  const continuations = pages.filter((t) => t.includes("pokračování")).length;
  assert.ok(continuations >= 5, `čekány navazující stránky u každého oddělení, našel jsem ${continuations}`);
});

test("PDF jednoho oddělení se stránkuje stejně", async () => {
  const [department] = makeOrderData([200]).departments;
  const { content, filename } = await buildDepartmentPdfAttachment(department, "2026-08-21");
  await assertPagination(content, 200, "oddělení, 200 řádků");
  assert.match(filename, /^Objednavka_LIMA_.+_2026-08-21\.pdf$/);
});

test("počet stran roste lineárně, ne skokově", async () => {
  const measured = [];
  for (const total of [40, 80, 160]) {
    const { content } = await buildOrderPdfAttachment(makeOrderData([total]));
    measured.push((await pageTexts(content)).length);
  }
  const [a, b, c] = measured;
  // dvojnásobek řádků nesmí dát víc než 2,5× stran (rozbitá verze rostla ~6× rychleji)
  assert.ok(b <= a * 2.5, `40→80 řádků: ${a}→${b} stran`);
  assert.ok(c <= b * 2.5, `80→160 řádků: ${b}→${c} stran`);
});

test("prázdná i jednořádková objednávka dá jednu stranu", async () => {
  for (const counts of [[], [0], [1]]) {
    const { content } = await buildOrderPdfAttachment(makeOrderData(counts));
    const pages = await pageTexts(content);
    assert.equal(pages.length, 1, `counts=${JSON.stringify(counts)} → ${pages.length} stran`);
  }
});

test("řádky se nikde neztratí ani nezdvojí", async () => {
  const total = 250;
  const { content } = await buildOrderPdfAttachment(makeOrderData([total]));
  const text = (await pageTexts(content)).join(" ");
  for (const i of [1, 2, total - 1, total]) {
    const needle = `Osoba ${i}`;
    const hits = text.split(needle).length - 1;
    assert.ok(hits >= 1, `"${needle}" v PDF chybí`);
  }
});
