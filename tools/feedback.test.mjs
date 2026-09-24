// Testy připomínek proti dočasné SQLite (lib/feedback.ts, lib/telegram.ts, lib/api-auth.ts).
//
// Spuštění:  node --test tools/feedback.test.mjs
//
// Hlídají hlavně to, co by bylo vidět navenek: že veřejný seznam „co jsme
// upravili“ nikdy nevydá původní text ani autora, že upozornění na Telegram
// dostane jen admin, který si ho sám zapnul, a že správa stojí za PINem.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-"));
process.env.DB_PATH = path.join(dataDir, "test.db");

const lib = loadLib();
const feedback = await lib("feedback");
const telegram = await lib("telegram");
const { saveSettings } = await lib("settings");
const { verifySettingsPin } = await lib("api-auth");
const { getDb } = await lib("db");

const input = (overrides = {}) => {
  const r = feedback.validateFeedbackInput({ category: "napad", message: "Přidejte tmavý režim", ...overrides });
  assert.ok(r.ok);
  return r.data;
};

test("uloží připomínku jako novou a bez IP adresy", () => {
  const entry = feedback.addFeedback(input({ authorName: "Jana" }), "mobil");
  assert.equal(entry.status, "new");
  assert.equal(entry.authorName, "Jana");
  assert.equal(entry.device, "mobil");
  assert.equal(entry.resolvedAt, null);

  const columns = getDb().prepare("PRAGMA table_info(feedback)").all().map((c) => c.name);
  assert.ok(!columns.some((c) => /ip|agent/i.test(c)), `sloupce: ${columns.join(", ")}`);
});

test("počítá jen nové připomínky", () => {
  const before = feedback.countNewFeedback();
  const entry = feedback.addFeedback(input(), "");
  assert.equal(feedback.countNewFeedback(), before + 1);
  feedback.updateFeedback(entry.id, { status: "read" });
  assert.equal(feedback.countNewFeedback(), before);
});

test("veřejný seznam ukáže jen hotové s odpovědí — nikdy text ani autora", () => {
  const secret = feedback.addFeedback(input({ message: "Kuchař Novák je hrozný", authorName: "Tajný" }), "");
  const noReply = feedback.addFeedback(input({ message: "Hotovo bez odpovědi" }), "");
  const planned = feedback.addFeedback(input({ message: "V plánu s odpovědí" }), "");

  feedback.updateFeedback(secret.id, { status: "done", publicReply: "Upravili jsme ceník." });
  feedback.updateFeedback(noReply.id, { status: "done" });
  feedback.updateFeedback(planned.id, { status: "planned", publicReply: "Chystáme." });

  const pub = feedback.getPublicFeedbackReplies();
  assert.deepEqual(pub.map((r) => r.id), [secret.id]);
  assert.deepEqual(Object.keys(pub[0]).sort(), ["category", "id", "publicReply", "resolvedAt"]);
  assert.ok(!JSON.stringify(pub).includes("Novák"));
  assert.ok(!JSON.stringify(pub).includes("Tajný"));
});

test("datum vyřízení drží první přechod do Hotovo a návrat ho smaže", () => {
  const entry = feedback.addFeedback(input(), "");
  const done = feedback.updateFeedback(entry.id, { status: "done", publicReply: "Ano" });
  assert.match(done.resolvedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

  getDb().prepare("UPDATE feedback SET resolved_at = '2026-01-01 10:00:00' WHERE id = ?").run(entry.id);
  const edited = feedback.updateFeedback(entry.id, { publicReply: "Ano, opraveno" });
  assert.equal(edited.resolvedAt, "2026-01-01 10:00:00");

  const reopened = feedback.updateFeedback(entry.id, { status: "planned" });
  assert.equal(reopened.resolvedAt, null);
});

test("úprava a smazání neexistující připomínky nic nerozbije", () => {
  assert.equal(feedback.updateFeedback(999999, { status: "read" }), null);
  assert.equal(feedback.deleteFeedback(999999), false);
});

test("smazání připomínku odstraní", () => {
  const entry = feedback.addFeedback(input(), "");
  assert.equal(feedback.deleteFeedback(entry.id), true);
  assert.equal(feedback.getFeedbackById(entry.id), null);
});

test("správa připomínek stojí za PINem a po deseti chybách se zamkne", () => {
  saveSettings({ settingsPin: "4711" });
  const ip = "10.9.0.1";
  assert.equal(verifySettingsPin(ip, "4711"), "ok");
  assert.equal(verifySettingsPin(ip, null), "denied");
  for (let i = 0; i < 9; i++) verifySettingsPin(ip, "0000");
  assert.equal(verifySettingsPin(ip, "4711"), "locked");
  // jiná IP zámek nesdílí
  assert.equal(verifySettingsPin("10.9.0.2", "4711"), "ok");
});

test("upozornění na Telegram dostane jen admin, který si ho zapnul", async () => {
  saveSettings({ telegramEnabled: "true", telegramBotToken: "123:TEST" });
  telegram.registerTelegramUser("100", "Admin", "admin");         // první = admin
  telegram.registerTelegramUser("200", "Kolega", "kolega");
  telegram.registerTelegramUser("300", "Admin2", "admin2");
  telegram.setTelegramAdmin("300", true);

  const sentTo = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sentTo.push(JSON.parse(init.body).chat_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    // výchozí stav: vypnuto u všech
    await telegram.sendTelegramFeedbackNotification("test");
    assert.deepEqual(sentTo, []);

    telegram.toggleNotifySetting("100", "notify_feedback");
    // i kdyby si to běžný uživatel zapnul přímo v DB, nic nedostane
    telegram.toggleNotifySetting("200", "notify_feedback");
    await telegram.sendTelegramFeedbackNotification("test");
    assert.deepEqual(sentTo, ["100"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
