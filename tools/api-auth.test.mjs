// Regresní testy serverové hranice citlivých API rout.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadLib } from "./test-helpers.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const lib = loadLib();
const { getClientIpFromHeaders } = await lib("api-auth");

const SETTINGS_ROUTES = [
  "app/api/backup/route.ts",
  "app/api/restore/route.ts",
  "app/api/smtp-test/route.ts",
];

const SETTINGS_CLIENTS = [
  "app/components/SettingsPage.tsx",
  "app/components/settings/BackupSection.tsx",
  "app/components/settings/PinGate.tsx",
  "app/components/settings/SmtpSection.tsx",
];

test("citlivé API vyžaduje admin session i PIN proof", () => {
  const helper = read("lib/api-auth.ts");
  assert.match(helper, /await requireAdminWithPin\(\)/);

  for (const file of SETTINGS_ROUTES) {
    const source = read(file);
    assert.match(source, /await requireSettingsAccess\(\)/, `${file} nemá step-up guard`);
    assert.doesNotMatch(source, /requireSettingsPin|x-settings-pin/, `${file} stále přijímá raw PIN`);
  }
});

test("klient Nastavení po step-upu nikde nedrží ani nepředává raw PIN", () => {
  for (const file of SETTINGS_CLIENTS) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /x-settings-pin|confirmedPinRef|getPin/,
      `${file} znovu přenáší raw PIN mimo step-up akci`
    );
  }

  const page = read("app/components/SettingsPage.tsx");
  assert.match(page, /await actionSaveSettings\(updates\)/);
  assert.doesNotMatch(page, /actionSaveSettings\(updates\s*,/);

  const gate = read("app/components/settings/PinGate.tsx");
  assert.match(gate, /await actionCheckPin\(pin\)/);
  assert.match(gate, /onUnlock: \(\) => void/);
});

test("API guard běží před čtením těla, databáze a externím spojením", () => {
  const cases = [
    ["app/api/backup/route.ts", "getDb()"],
    ["app/api/restore/route.ts", "req.json()"],
    ["app/api/smtp-test/route.ts", "await testSmtpConnection"],
  ];

  for (const [file, sink] of cases) {
    const source = read(file);
    assert.ok(
      source.indexOf("await requireSettingsAccess()") < source.indexOf(sink),
      `${file} provádí citlivou práci před guardem`
    );
  }
});

test("PDF import vyžaduje správce před parsováním uploadu", () => {
  const source = read("app/api/menu/import/route.ts");
  assert.ok(source.indexOf("await requireApiAdmin()") < source.indexOf("request.formData()"));
});

test("nedůvěryhodné forwarded hlavičky nejdou střídat kvůli obcházení limitu", () => {
  delete process.env.TRUST_CLOUDFLARE_PROXY;
  for (const value of ["1.1.1.1", "8.8.8.8", "203.0.113.9, 10.0.0.1"]) {
    assert.equal(getClientIpFromHeaders(new Headers({ "x-forwarded-for": value })), "untrusted");
  }
});

test("v potvrzeném Cloudflare režimu se přijme jen platná canonical IP", () => {
  process.env.TRUST_CLOUDFLARE_PROXY = "true";
  assert.equal(
    getClientIpFromHeaders(new Headers({ "cf-connecting-ip": "203.0.113.9" })),
    "203.0.113.9"
  );
  assert.equal(
    getClientIpFromHeaders(new Headers({ "cf-connecting-ip": "podvrh" })),
    "untrusted"
  );
  delete process.env.TRUST_CLOUDFLARE_PROXY;
});
