// Testy odesílací cesty objednávky.
//
// Zamykají chování sendOrder() a resendOrderEmail() ještě před tím, než se
// jejich společná část vytáhne do sdílených pomocníků. Běží proti dočasné
// SQLite a proti falešnému SMTP serveru na localhostu — tedy přes reálný
// nodemailer, ne přes mock.
//
// Spuštění:  node --test tools/orders-send.test.mjs   (nebo npm run test:orders)

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib, resolveFontDir, startFakeSmtp } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orders-db-"));
process.env.DB_PATH = path.join(dataDir, "test.db");
process.env.PDF_FONT_DIR = resolveFontDir();

const smtp = await startFakeSmtp();
const lib = loadLib();

const { getDb } = await lib("db");
const { saveSettings, getSettings } = await lib("settings");
const { getAuditLog } = await lib("audit");
const {
  getOrderDataForDate, getOrderById, getOrderPdfPath, orderPdfExists,
  addOrderRow, updateOrderRow, sendOrder, resendOrderEmail, reopenOrder, reopenOrderAndUnlock,
} = await lib("orders");
const { getPragueISODate } = await lib("time");

let SOUP_ID;
let MEAL_ID;

before(() => {
  saveSettings({
    smtpHost: "127.0.0.1",
    smtpPort: String(smtp.port),
    smtpUser: "test",
    smtpPass: "test",
    smtpFrom: "automat@stros.test",
    smtpSecure: "false",
    orderEmailTo: "kuchyne@lima.test",
  });

  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO menu_items (week_label, day, type, code, name, price) VALUES (?, ?, ?, ?, ?, ?)"
  );
  SOUP_ID = Number(insert.run("test", "Pa", "Polevka", "A", "Zelná s uzeným masem", 30).lastInsertRowid);
  MEAL_ID = Number(insert.run("test", "Pa", "Jidlo", "4", "Špalek z vepřové krkovičky", 110).lastInsertRowid);
});

after(async () => {
  await smtp.close();
});

/** Objednávka s jedním vyplněným řádkem. Každý test má svoje datum, ať se neruší. */
function seedOrder(date, personName = "Josef Pech") {
  const { order } = getOrderDataForDate(date);
  const row = addOrderRow(order.id, "Konstrukce");
  updateOrderRow(row.id, { personName, soupItemId: SOUP_ID, mainItemId: MEAL_ID, rollCount: 1 });
  return order.id;
}

function archivedPdf(orderId) {
  return fs.readFileSync(getOrderPdfPath(orderId));
}

// ---------------------------------------------------------------------------

test("sendOrder odešle e-mail, označí objednávku a uloží PDF do archivu", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-02");

  const result = await sendOrder(orderId);

  assert.equal(smtp.messages.length, 1, "měl odejít právě jeden e-mail");
  assert.equal(result.status, "sent");
  assert.ok(result.sentAt, "sent_at musí být vyplněné");

  const stored = getOrderById(orderId);
  assert.equal(stored.status, "sent");
  assert.equal(stored.sentAt, result.sentAt);

  assert.ok(orderPdfExists(orderId), "archivované PDF musí vzniknout");
  assert.equal(archivedPdf(orderId).subarray(0, 5).toString(), "%PDF-", "archiv musí být PDF");
  assert.match(smtp.messages[0], /Content-Type: application\/pdf/i, "e-mail musí nést PDF přílohu");
});

test("druhé sendOrder na odeslanou objednávku selže a nic dalšího nepošle", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-03");
  await sendOrder(orderId);
  assert.equal(smtp.messages.length, 1);

  await assert.rejects(() => sendOrder(orderId), /již byla odeslána/);

  assert.equal(smtp.messages.length, 1, "druhý pokus nesmí poslat další e-mail");
  assert.equal(getOrderById(orderId).status, "sent");
});

test("selhání SMTP vrátí objednávku na draft", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-04");
  smtp.failOnce();

  await assert.rejects(() => sendOrder(orderId));

  const stored = getOrderById(orderId);
  assert.equal(stored.status, "draft", "po chybě SMTP musí zůstat draft");
  assert.equal(stored.sentAt, null, "sent_at se nesmí zapsat");
  assert.equal(orderPdfExists(orderId), false, "neodeslané PDF se nesmí archivovat");

  // a po nápravě musí projít napodruhé
  await sendOrder(orderId);
  assert.equal(getOrderById(orderId).status, "sent");
  assert.equal(smtp.messages.length, 1);
});

test("sendOrder loguje auto_send jen u automatického odeslání", async () => {
  smtp.reset();
  const manualId = seedOrder("2026-03-05");
  await sendOrder(manualId);
  assert.ok(getAuditLog(manualId).some((e) => e.action === "order_send"));

  const autoId = seedOrder("2026-03-06");
  await sendOrder(autoId, "auto");
  assert.ok(getAuditLog(autoId).some((e) => e.action === "auto_send"));
});

test("resendOrderEmail pošle znovu, ale nesahá na status ani sent_at", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-09");
  await sendOrder(orderId);
  const afterSend = getOrderById(orderId);

  await resendOrderEmail(orderId);

  assert.equal(smtp.messages.length, 2, "resend musí poslat další e-mail");
  const afterResend = getOrderById(orderId);
  assert.equal(afterResend.status, "sent");
  assert.equal(afterResend.sentAt, afterSend.sentAt, "sent_at musí zůstat čas prvního odeslání");
  assert.ok(getAuditLog(orderId).some((e) => e.details === "Znovu odesláno"));
});

test("resendOrderEmail aktualizuje archivované PDF podle aktuálních dat", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-10");
  await sendOrder(orderId);
  const before = archivedPdf(orderId);

  const extra = addOrderRow(orderId, "Konstrukce");
  updateOrderRow(extra.id, { personName: "Pribyvsi Stravnik", mainItemId: MEAL_ID });

  await resendOrderEmail(orderId);
  const after = archivedPdf(orderId);

  assert.ok(!before.equals(after), "archiv musí odpovídat tomu, co odešlo naposledy");
  assert.ok(after.length > 0);
});

test("reopen a opětovné odeslání projde a přepíše archiv", async () => {
  smtp.reset();
  const orderId = seedOrder("2026-03-11");
  await sendOrder(orderId);
  const before = archivedPdf(orderId);

  reopenOrder(orderId);
  assert.equal(getOrderById(orderId).status, "draft");

  const extra = addOrderRow(orderId, "Dílna");
  updateOrderRow(extra.id, { personName: "Dodatecny Radek", mainItemId: MEAL_ID });

  await sendOrder(orderId);

  assert.equal(getOrderById(orderId).status, "sent");
  assert.equal(smtp.messages.length, 2);
  assert.ok(!before.equals(archivedPdf(orderId)), "archiv se musí přepsat");
});

test("znovuotevření po uzávěrce zapíše razítko odemčení", () => {
  const orderId = seedOrder(getPragueISODate(), "Dnesni Stravnik");
  saveSettings({ cutoffTime: "00:00", orderForceOpenAt: "" }); // uzávěrka už proběhla

  reopenOrderAndUnlock(orderId);

  const { orderForceOpenAt } = getSettings();
  assert.match(orderForceOpenAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "má se uložit razítko s časem");
  assert.equal(orderForceOpenAt.split("T")[0], getPragueISODate(), "razítko musí být dnešní");

  saveSettings({ cutoffTime: "08:00", orderForceOpenAt: "" });
});

test("znovuotevření před uzávěrkou nic neodemyká", () => {
  const orderId = seedOrder(getPragueISODate(), "Dalsi Stravnik");
  saveSettings({ cutoffTime: "23:59", orderForceOpenAt: "" }); // uzávěrka ještě nenastala

  reopenOrderAndUnlock(orderId);
  assert.equal(getSettings().orderForceOpenAt, "", "není co promíjet");

  saveSettings({ cutoffTime: "08:00" });
});

test("prázdná objednávka se neodešle ani jednou cestou", async () => {
  smtp.reset();
  const { order } = getOrderDataForDate("2026-03-12");

  await assert.rejects(() => sendOrder(order.id), /nejsou vyplněna žádná data/);
  await assert.rejects(() => resendOrderEmail(order.id), /neobsahuje žádná data/);
  assert.equal(smtp.messages.length, 0);
});

test("neznámé id objednávky skončí chybou u obou cest", async () => {
  smtp.reset();
  await assert.rejects(() => sendOrder(999999), /nebyla nalezena/i);
  await assert.rejects(() => resendOrderEmail(999999), /nebyla nalezena/i);
  assert.equal(smtp.messages.length, 0);
});
