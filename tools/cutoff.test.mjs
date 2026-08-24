// Testy vyhodnocení uzávěrky (lib/cutoff.ts).
//
// Motivace: když se objednávka po uzávěrce znovu otevřela, uzávěrka se toho
// dne už nikdy nezapnula — příznak odemčení nesl jen datum, takže přenastavení
// času uzávěrky nemělo kam zabrat.
//
// Spuštění:  node --test tools/cutoff.test.mjs   (nebo npm run test:cutoff)

import test from "node:test";
import assert from "node:assert/strict";

import { loadLib } from "./test-helpers.mjs";

const lib = loadLib();
const { isCutoffPassed, isCutoffLifted, isOrderingLocked, forceOpenStamp } = await lib("cutoff");

/** Pražský čas jako Date, jak ho vrací getPragueNow(). */
const at = (hhmm, date = "2026-08-24") => new Date(`${date}T${hhmm}:00`);

// ---------------------------------------------------------------------------

test("uzávěrka nastane přesně ve svůj čas", () => {
  assert.equal(isCutoffPassed({ cutoffTime: "08:00", forceOpenAt: "", now: at("07:59") }), false);
  assert.equal(isCutoffPassed({ cutoffTime: "08:00", forceOpenAt: "", now: at("08:00") }), true);
  assert.equal(isCutoffPassed({ cutoffTime: "08:00", forceOpenAt: "", now: at("08:01") }), true);
});

test("bez odemčení se po uzávěrce zamyká", () => {
  assert.equal(isOrderingLocked({ cutoffTime: "08:00", forceOpenAt: "", now: at("07:30") }), false);
  assert.equal(isOrderingLocked({ cutoffTime: "08:00", forceOpenAt: "", now: at("08:30") }), true);
});

test("odemčení promine uzávěrku, která už proběhla", () => {
  const input = { cutoffTime: "08:00", forceOpenAt: "2026-08-24T08:05", now: at("08:06") };
  assert.equal(isCutoffLifted(input), true);
  assert.equal(isOrderingLocked(input), false);
});

test("posun uzávěrky za okamžik odemčení ji znovu aktivuje", () => {
  // odemčeno v 08:05, uzávěrka přenastavena na 08:10
  const base = { forceOpenAt: "2026-08-24T08:05", cutoffTime: "08:10" };

  // v 08:07 uzávěrka ještě nenastala — otevřeno
  assert.equal(isOrderingLocked({ ...base, now: at("08:07") }), false);
  // v 08:10 nastala a odemčení ji nepromíjí — zamčeno
  assert.equal(isCutoffLifted({ ...base, now: at("08:10") }), false);
  assert.equal(isOrderingLocked({ ...base, now: at("08:10") }), true);
  assert.equal(isOrderingLocked({ ...base, now: at("08:30") }), true);
});

test("uzávěrka nastavená přesně na okamžik odemčení zůstává promlčená", () => {
  const base = { forceOpenAt: "2026-08-24T08:05", cutoffTime: "08:05" };
  assert.equal(isOrderingLocked({ ...base, now: at("08:06") }), false);
});

test("opětovné odemčení promine i posunutou uzávěrku", () => {
  const base = { cutoffTime: "08:10", forceOpenAt: "2026-08-24T08:12" };
  assert.equal(isOrderingLocked({ ...base, now: at("08:15") }), false);
});

test("odemčení platí jen pro svůj den", () => {
  const input = { cutoffTime: "08:00", forceOpenAt: "2026-08-23T08:05", now: at("08:30") };
  assert.equal(isCutoffLifted(input), false);
  assert.equal(isOrderingLocked(input), true, "včerejší odemčení dnes neplatí");
});

test("starší formát bez času platí na celý den", () => {
  // hodnoty uložené před zavedením razítka nesly jen datum
  const input = { cutoffTime: "08:10", forceOpenAt: "2026-08-24", now: at("09:00") };
  assert.equal(isCutoffLifted(input), true);
  assert.equal(isOrderingLocked(input), false);

  const yesterday = { cutoffTime: "08:10", forceOpenAt: "2026-08-23", now: at("09:00") };
  assert.equal(isOrderingLocked(yesterday), true);
});

test("nesmyslný čas uzávěrky nezamyká", () => {
  for (const cutoffTime of ["", "osm", "25:00", "08:70", "8"]) {
    assert.equal(
      isOrderingLocked({ cutoffTime, forceOpenAt: "", now: at("23:00") }),
      false,
      `cutoffTime=${JSON.stringify(cutoffTime)} nesmí zamknout`
    );
  }
});

test("forceOpenStamp vyrobí razítko, kterému rozumí isCutoffLifted", () => {
  const now = at("08:05");
  const stamp = forceOpenStamp(now);
  assert.equal(stamp, "2026-08-24T08:05");

  // uzávěrka, která proběhla před odemčením, je promlčená
  assert.equal(isCutoffLifted({ cutoffTime: "08:00", forceOpenAt: stamp, now }), true);
  // uzávěrka po odemčení nikoliv
  assert.equal(isCutoffLifted({ cutoffTime: "08:30", forceOpenAt: stamp, now }), false);
});

test("odemčení před uzávěrkou ji nepromíjí", () => {
  // admin klikne na odemknout v 07:00, uzávěrka je až v 08:00
  const base = { cutoffTime: "08:00", forceOpenAt: "2026-08-24T07:00" };
  assert.equal(isOrderingLocked({ ...base, now: at("07:30") }), false, "před uzávěrkou je otevřeno tak jako tak");
  assert.equal(isOrderingLocked({ ...base, now: at("08:30") }), true, "uzávěrka v 08:00 pak normálně platí");
});
