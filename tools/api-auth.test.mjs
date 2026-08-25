// Testy brány chráněných API rout (lib/api-auth.ts).
//
// Motivace: appka běží na veřejné adrese a `/api/backup` i `/api/restore` byly
// dostupné komukoli, kdo znal URL. Tenhle modul je zavírá za PIN z Nastavení.
//
// Spuštění:  node --test tools/api-auth.test.mjs
//
// Jedna databáze na celý soubor, takže se případy izolují různými IP —
// počítadlo neúspěchů je vedené právě na IP.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLib } from "./test-helpers.mjs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-auth-"));
process.env.DB_PATH = path.join(dataDir, "test.db");

const lib = loadLib();
const { saveSettings } = await lib("settings");
const { requireSettingsPin } = await lib("api-auth");

const PIN = "4711";
saveSettings({ settingsPin: PIN });

/** Požadavek s daným PINem a IP; `null` = hlavička úplně chybí. */
const req = (pin, ip) =>
  new Request("http://localhost/api/backup", {
    headers: pin === null
      ? { "x-forwarded-for": ip }
      : { "x-settings-pin": pin, "x-forwarded-for": ip },
  });

test("správný PIN projde", () => {
  assert.equal(requireSettingsPin(req(PIN, "10.0.0.1")), null);
});

test("chybějící hlavička vrátí 401", () => {
  assert.equal(requireSettingsPin(req(null, "10.0.0.2")).status, 401);
});

test("špatný PIN vrátí 401", () => {
  assert.equal(requireSettingsPin(req("0000", "10.0.0.3")).status, 401);
});

test("opakované používání se správným PINem se nezamkne", () => {
  // Kdyby kredit ubíral i povedený pokus, spadlo by to na 429 a Nastavení
  // by se samo zamklo běžným používáním.
  for (let i = 0; i < 30; i++) {
    assert.equal(requireSettingsPin(req(PIN, "10.0.0.4")), null, `pokus ${i + 1}`);
  }
});

test("po deseti chybách se zavře i pro správný PIN", () => {
  const ip = "10.0.0.5";
  for (let i = 0; i < 10; i++) {
    assert.equal(requireSettingsPin(req("0000", ip)).status, 401, `chyba ${i + 1}`);
  }
  assert.equal(requireSettingsPin(req("0000", ip)).status, 429);
  assert.equal(requireSettingsPin(req(PIN, ip)).status, 429, "správný PIN nesmí obejít zámek");
});

test("zámek platí na IP, ne globálně", () => {
  for (let i = 0; i < 11; i++) requireSettingsPin(req("0000", "10.0.0.6"));
  assert.equal(requireSettingsPin(req("0000", "10.0.0.6")).status, 429);
  assert.equal(requireSettingsPin(req(PIN, "10.0.0.7")), null, "jiná IP musí projít");
});
