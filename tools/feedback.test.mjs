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
const { verifySettingsPin, checkSettingsPinAttempt } = await lib("api-auth");
const { getDb } = await lib("db");
const github = await lib("feedback-github");
const exporter = await lib("feedback-export");

const input = (overrides = {}) => {
  const r = feedback.validateFeedbackInput({ category: "napad", message: "Přidejte tmavý režim", ...overrides });
  assert.ok(r.ok);
  return r.data;
};

test("uloží připomínku jako novou, bez jména a bez IP adresy", () => {
  const { entry } = feedback.addFeedback(input({ authorName: "Jana" }), "mobil");
  assert.equal(entry.status, "new");
  assert.equal(getDb().prepare("SELECT author_name FROM feedback WHERE id = ?").get(entry.id).author_name, "");
  assert.equal(entry.device, "mobil");
  assert.equal(entry.resolvedAt, null);

  const columns = getDb().prepare("PRAGMA table_info(feedback)").all().map((c) => c.name);
  assert.ok(!columns.some((c) => /ip|agent/i.test(c)), `sloupce: ${columns.join(", ")}`);
});

test("počítá jen nové připomínky", () => {
  const before = feedback.countNewFeedback();
  const { entry } = feedback.addFeedback(input(), "");
  assert.equal(feedback.countNewFeedback(), before + 1);
  feedback.updateFeedback(entry.id, { status: "read" });
  assert.equal(feedback.countNewFeedback(), before);
});

test("veřejný seznam ukáže jen hotové s odpovědí — nikdy text ani autora", () => {
  const { entry: secret } = feedback.addFeedback(input({ category: "jidlo", message: "Kuchař Novák je hrozný" }), "");
  const { entry: noReply } = feedback.addFeedback(input({ message: "Hotovo bez odpovědi" }), "");
  const { entry: planned } = feedback.addFeedback(input({ message: "V plánu s odpovědí" }), "");

  feedback.updateFeedback(secret.id, { status: "done", publicReply: "Upravili jsme ceník." });
  feedback.updateFeedback(noReply.id, { status: "done" });
  feedback.updateFeedback(planned.id, { status: "planned", publicReply: "Chystáme." });

  const pub = feedback.getPublicFeedbackReplies();
  assert.deepEqual(pub.map((r) => r.id), [secret.id]);
  assert.deepEqual(Object.keys(pub[0]).sort(), ["category", "id", "publicReply", "resolvedAt", "votes"]);
  assert.ok(!JSON.stringify(pub).includes("Novák"));
});

test("datum vyřízení drží první přechod do Hotovo a návrat ho smaže", () => {
  const { entry } = feedback.addFeedback(input(), "");
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
  const { entry } = feedback.addFeedback(input(), "");
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

test("odemčení Nastavení počítá jen špatné PINy — správná odemčení zámek nespustí", () => {
  saveSettings({ settingsPin: "4711" });
  const ip = "10.9.1.1";
  // Dřív se po pěti správných odemčeních za 10 minut zamklo i správci
  for (let i = 0; i < 30; i++) assert.deepEqual(checkSettingsPinAttempt(ip, "4711"), { ok: true });

  for (let i = 0; i < 9; i++) assert.deepEqual(checkSettingsPinAttempt(ip, "0000"), { ok: false });
  // Desátá chyba zamkne a obrazovka hned ví, do kdy odpočítávat
  const locked = checkSettingsPinAttempt(ip, "0000");
  assert.equal(locked.ok, false);
  assert.ok(locked.lockedUntil > Date.now());
  // Zamčeno i pro správný PIN a sdílí to i Server Actions
  assert.equal(checkSettingsPinAttempt(ip, "4711").ok, false);
  assert.equal(verifySettingsPin(ip, "4711"), "locked");
  assert.deepEqual(checkSettingsPinAttempt("10.9.1.2", "4711"), { ok: true });
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

// ── Screenshoty ──────────────────────────────────────────────────────────────

const attachmentsLib = await lib("feedback-attachments");
const { default: sharp } = await import(path.resolve("node_modules/sharp/lib/index.js"));

const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: "#ea580c" } }).png().toBuffer();

test("obrázek se znovu zakóduje do WebP, zmenší a zahodí metadata", async () => {
  const input = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#fff" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: "tajne" } } })
    .toBuffer();
  const out = await attachmentsLib.processImage(input);
  assert.equal(out.width, 2000);
  assert.equal(out.height, 500);
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
});

test("soubor, který není obrázek, neprojde — ani s koncovkou nebo hlavičkou PNG", async () => {
  await assert.rejects(attachmentsLib.processImage(Buffer.from("<script>alert(1)</script>")), attachmentsLib.AttachmentError);
  const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("<html>")]);
  await assert.rejects(attachmentsLib.processImage(fakePng), attachmentsLib.AttachmentError);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>x</script></svg>');
  await assert.rejects(attachmentsLib.processImage(svg), attachmentsLib.AttachmentError);
});

test("přílohy se uloží s připomínkou a se smazáním zmizí i z disku", async () => {
  const img = await attachmentsLib.processImage(await png(300, 200));
  const { entry } = feedback.addFeedback(input({ message: "S obrázkem" }), "", [img, img]);
  assert.equal(entry.attachments.length, 2);
  const files = entry.attachments.map((a) => attachmentsLib.getAttachmentFile(a.id).filePath);
  assert.ok(files.every((f) => fs.existsSync(f)));

  feedback.deleteFeedback(entry.id);
  assert.ok(files.every((f) => !fs.existsSync(f)));
  assert.equal(attachmentsLib.getAttachmentFile(entry.attachments[0].id), null);
});

test("veřejný seznam přílohy nevydá", async () => {
  const img = await attachmentsLib.processImage(await png(50, 50));
  const { entry } = feedback.addFeedback(input({ message: "Veřejná s obrázkem" }), "", [img]);
  feedback.updateFeedback(entry.id, { status: "done", publicReply: "Hotovo" });
  const pub = feedback.getPublicFeedbackReplies().find((r) => r.id === entry.id);
  assert.deepEqual(Object.keys(pub).sort(), ["category", "id", "publicReply", "resolvedAt", "votes"]);
});

// ── Moje připomínky, kontext, úklid ──────────────────────────────────────────

test("autor vidí svou připomínku jen se správným kódem", () => {
  const { entry, token } = feedback.addFeedback(input({ message: "Moje vlastní" }), "");
  const other = feedback.addFeedback(input({ message: "Cizí připomínka" }), "");
  feedback.updateFeedback(entry.id, { status: "planned", publicReply: "Chystáme to", adminNote: "interní" });

  const own = feedback.getOwnFeedback([
    { id: entry.id, token },
    { id: other.entry.id, token },            // cizí id s mým kódem
    { id: 999999, token },                    // neexistuje
  ]);
  assert.equal(own.length, 1);
  assert.equal(own[0].id, entry.id);
  assert.equal(own[0].status, "planned");
  assert.equal(own[0].reply, "Chystáme to");
  // interní poznámka ani autor se ven nedostanou
  assert.ok(!JSON.stringify(own).includes("interní"));
  assert.deepEqual(Object.keys(own[0]).sort(), ["attachmentCount", "category", "createdAt", "id", "message", "reply", "status"]);

  // v DB je jen hash kódu
  const row = getDb().prepare("SELECT secret_hash FROM feedback WHERE id = ?").get(entry.id);
  assert.notEqual(row.secret_hash, token);
  assert.match(row.secret_hash, /^[0-9a-f]{64}$/);
});

test("kontext z chybové stránky a verze se uloží, nesmysly se zahodí", () => {
  const ok = feedback.addFeedback(input({ context: "Kód chyby:\u0000 123abc", appVersion: "1.4.0" }), "").entry;
  assert.equal(ok.context, "Kód chyby: 123abc");
  assert.equal(ok.appVersion, "1.4.0");
  const bad = feedback.addFeedback(input({ context: "x".repeat(1000), appVersion: "<b>1</b>" }), "").entry;
  assert.equal(bad.context.length, 300);
  assert.equal(bad.appVersion, "");
});

test("screenshoty vyřízených připomínek se po 90 dnech smažou, text zůstane", async () => {
  const img = await attachmentsLib.processImage(await png(40, 40));
  const oldDone = feedback.addFeedback(input({ message: "Stará hotová" }), "", [img]).entry;
  const oldOpen = feedback.addFeedback(input({ message: "Stará otevřená" }), "", [img]).entry;
  const freshDone = feedback.addFeedback(input({ message: "Čerstvě hotová" }), "", [img]).entry;
  feedback.updateFeedback(oldDone.id, { status: "done" });
  feedback.updateFeedback(freshDone.id, { status: "done" });
  const setAge = getDb().prepare("UPDATE feedback SET status_changed_at = datetime('now', '-91 days') WHERE id = ?");
  setAge.run(oldDone.id);
  setAge.run(oldOpen.id);
  const oldFile = attachmentsLib.getAttachmentFile(oldDone.attachments[0].id).filePath;

  const removed = feedback.cleanupOldAttachments();
  assert.equal(removed, 1);
  assert.ok(!fs.existsSync(oldFile));
  assert.equal(feedback.getFeedbackById(oldDone.id).attachments.length, 0);
  assert.equal(feedback.getFeedbackById(oldDone.id).message, "Stará hotová");
  assert.equal(feedback.getFeedbackById(oldOpen.id).attachments.length, 1);   // není vyřízená
  assert.equal(feedback.getFeedbackById(freshDone.id).attachments.length, 1); // ještě ne 90 dní
});

test("změna stavu posune datum změny, úprava textu ne", () => {
  const { entry } = feedback.addFeedback(input(), "");
  getDb().prepare("UPDATE feedback SET status_changed_at = '2020-01-01 00:00:00' WHERE id = ?").run(entry.id);
  feedback.updateFeedback(entry.id, { adminNote: "jen poznámka" });
  assert.equal(getDb().prepare("SELECT status_changed_at AS t FROM feedback WHERE id = ?").get(entry.id).t, "2020-01-01 00:00:00");
  feedback.updateFeedback(entry.id, { status: "rejected" });
  assert.notEqual(getDb().prepare("SELECT status_changed_at AS t FROM feedback WHERE id = ?").get(entry.id).t, "2020-01-01 00:00:00");
});

// ── Hlasování ────────────────────────────────────────────────────────────────

test("o chybě jde hlasovat, až ji správce dá do „Co chystáme“; jeden hlas na prohlížeč", () => {
  const { entry } = feedback.addFeedback(input({ category: "chyba", message: "Tmavý režim, prosím" }), "");
  const alice = "a".repeat(24);
  const bob = "b".repeat(24);

  // chyba není veřejná kategorie → nejde
  assert.equal(feedback.setVote(entry.id, alice, 1), null);

  feedback.updateFeedback(entry.id, { status: "planned", voteTitle: "Tmavý režim", votable: true });
  assert.deepEqual(feedback.setVote(entry.id, alice, 1), { up: 1, down: 0 });
  assert.deepEqual(feedback.setVote(entry.id, alice, 1), { up: 1, down: 0 });   // podruhé se nepřičte
  assert.deepEqual(feedback.setVote(entry.id, bob, -1), { up: 1, down: 1 });
  assert.deepEqual(feedback.setVote(entry.id, bob, 1), { up: 2, down: 0 });     // změna názoru
  assert.deepEqual(feedback.setVote(entry.id, alice, 0), { up: 1, down: 0 });   // vzít zpět

  const board = feedback.getVotableFeedback();
  const item = board.find((i) => i.id === entry.id);
  assert.equal(item.up, 1);
  assert.equal(item.summary, "Tmavý režim");
  assert.deepEqual(Object.keys(item).sort(), ["category", "down", "id", "status", "summary", "up"]);

  // hotová připomínka z hlasování zmizí a 👍 si nese do seznamu změn
  feedback.updateFeedback(entry.id, { status: "done", publicReply: "Tmavý režim je venku." });
  assert.equal(feedback.setVote(entry.id, alice, 1), null);
  assert.ok(!feedback.getVotableFeedback().some((i) => i.id === entry.id));
  assert.equal(feedback.getPublicFeedbackReplies().find((r) => r.id === entry.id).votes, 1);

  // v DB není kód prohlížeče, jen jeho otisk
  const voters = getDb().prepare("SELECT voter_hash FROM feedback_votes WHERE feedback_id = ?").all(entry.id);
  assert.ok(voters.every((v) => /^[0-9a-f]{64}$/.test(v.voter_hash) && v.voter_hash !== bob));
});

test("bez názvu se k hlasování nedá, odpověď autorovi se veřejně neukáže", () => {
  const { entry } = feedback.addFeedback(input({ category: "chyba" }), "");
  feedback.updateFeedback(entry.id, { votable: true, publicReply: "Díky, podíváme se na to." });
  assert.equal(feedback.getFeedbackById(entry.id).votable, false);
  assert.ok(!feedback.getVotableFeedback().some((i) => i.id === entry.id));
  assert.equal(feedback.setVote(entry.id, "c".repeat(24), 1), null);

  feedback.updateFeedback(entry.id, { voteTitle: "  Export   do Excelu ", votable: true });
  const item = feedback.getVotableFeedback().find((i) => i.id === entry.id);
  assert.equal(item.summary, "Export do Excelu");
  assert.equal(feedback.setVote(entry.id, "<script>", 1), null);

  // smazáním názvu se hlasování vypne
  feedback.updateFeedback(entry.id, { voteTitle: "" });
  assert.equal(feedback.getFeedbackById(entry.id).votable, false);
});

test("úkol z GitHubu se spáruje podle značky jen od důvěryhodného autora a nepřepíše cizí úkol", () => {
  const { entry } = feedback.addFeedback(input({ message: "Chybí tmavý režim" }), "počítač");
  const body = decodeURIComponent(new URL(exporter.buildGithubIssueUrl(entry)).searchParams.get("body") ?? "");
  const issues = [
    // nejnovější první, jako v odpovědi GitHubu
    { number: 9, state: "open", body, author_association: "NONE" },            // cizí člověk — ignorovat
    { number: 8, state: "open", body, author_association: "OWNER", pull_request: {} }, // PR — ignorovat
    { number: 7, state: "closed", body, author_association: "OWNER" },
    { number: 5, state: "open", body: body.replace(/@[^ ]+ -->/, "@2000-01-01T00:00:00 -->"), author_association: "OWNER" }, // jiný čas
  ];
  const links = github.extractIssueLinks(issues);
  assert.deepEqual(links.map((l) => l.issue), [5, 7]);

  assert.equal(github.applyIssueLinks(links), 1);
  let fresh = feedback.getFeedbackById(entry.id);
  assert.equal(fresh.githubIssue, 7);
  assert.equal(fresh.githubIssueState, "closed");

  // Opakovaný běh bez změny nic nezapisuje; jiný úkol k téže připomínce ji nepřepíše
  assert.equal(github.applyIssueLinks(links), 0);
  assert.equal(github.applyIssueLinks([{ ...links[1], issue: 12 }]), 0);
  // Změna stavu téhož úkolu se propíše
  assert.equal(github.applyIssueLinks([{ ...links[1], state: "open" }]), 1);
  fresh = feedback.getFeedbackById(entry.id);
  assert.equal(fresh.githubIssue, 7);
  assert.equal(fresh.githubIssueState, "open");
});

test("nesmyslná odpověď GitHubu nic nerozbije", () => {
  assert.deepEqual(github.extractIssueLinks(null), []);
  assert.deepEqual(github.extractIssueLinks({ message: "API rate limit exceeded" }), []);
  assert.deepEqual(github.extractIssueLinks([null, 1, { number: -1 }, { number: 3, body: 42, author_association: "OWNER" }]), []);
});

test("„Připomínky ostatních“ ukážou jen otevřené veřejné kategorie a nic navíc", () => {
  const { entry: idea } = feedback.addFeedback(input({ category: "napad", message: "Tmavý režim prosím", page: "/pizza", context: "digest 1" }), "mobil");
  const { entry: bug } = feedback.addFeedback(input({ category: "chyba", message: "Padá mi to" }), "");
  const { entry: food } = feedback.addFeedback(input({ category: "jidlo", message: "Polévka studená" }), "");
  const { entry: hidden } = feedback.addFeedback(input({ category: "mobil", message: "Nevhodný text" }), "");
  const { entry: done } = feedback.addFeedback(input({ category: "ovladani", message: "Větší písmo" }), "");
  const { entry: promoted } = feedback.addFeedback(input({ category: "jine", message: "Nápad pro Co chystáme" }), "");
  feedback.updateFeedback(hidden.id, { hidden: true });
  feedback.updateFeedback(done.id, { status: "done" });
  feedback.updateFeedback(promoted.id, { voteTitle: "Hezčí souhrn", votable: true });

  const ids = feedback.getPublicFeedback().map((i) => i.id);
  assert.ok(ids.includes(idea.id));
  for (const other of [bug, food, hidden, done, promoted]) assert.ok(!ids.includes(other.id), `id ${other.id}`);
  const item = feedback.getPublicFeedback().find((i) => i.id === idea.id);
  assert.deepEqual(Object.keys(item).sort(), ["category", "createdAt", "down", "id", "status", "text", "up"]);

  // Přesunutá do „Co chystáme“ je tam pod názvem správce
  assert.ok(feedback.getVotableFeedback().some((v) => v.id === promoted.id && v.summary === "Hezčí souhrn"));
});

test("vlastní návrh správce jde rovnou do „Co chystáme“ a hlasuje se 👍 i 👎", () => {
  const parsed = feedback.proposalSchema.safeParse({ title: "  Objednávka  na celý týden ", category: "napad" });
  assert.ok(parsed.success);
  const entry = feedback.addProposal(parsed.data);
  assert.equal(entry.isProposal, true);
  assert.equal(entry.status, "planned");
  const item = feedback.getVotableFeedback().find((v) => v.id === entry.id);
  assert.equal(item.summary, "Objednávka na celý týden");
  // Ve veřejném seznamu připomínek od lidí není
  assert.ok(!feedback.getPublicFeedback().some((i) => i.id === entry.id));

  assert.deepEqual(feedback.setVote(entry.id, "a".repeat(24), 1), { up: 1, down: 0 });
  assert.deepEqual(feedback.setVote(entry.id, "b".repeat(24), -1), { up: 1, down: 1 });
  assert.deepEqual(feedback.setVote(entry.id, "a".repeat(24), -1), { up: 0, down: 2 });
  // Návrh zůstane k hlasování, i kdyby se klient pokusil hlasování vypnout
  feedback.updateFeedback(entry.id, { votable: false });
  assert.ok(feedback.getVotableFeedback().some((v) => v.id === entry.id));
  // Hotový návrh se z hlasování stáhne
  feedback.updateFeedback(entry.id, { status: "done" });
  assert.equal(feedback.setVote(entry.id, "c".repeat(24), 1), null);
});

