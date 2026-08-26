// Regresní testy serverové hranice citlivých API rout.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const SETTINGS_ROUTES = [
  "app/api/backup/route.ts",
  "app/api/restore/route.ts",
  "app/api/smtp-test/route.ts",
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
