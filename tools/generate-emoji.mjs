// Generates public/emoji.json from emojibase-data.
//
// Run after `npm i emojibase-data`:  node tools/generate-emoji.mjs
//
// The dataset is ~49 MB in node_modules and ~570 KB even in its compact form —
// far too much to bundle into the client. This trims it to what the picker needs
// (character, label, group, search tags) and writes a single file that the picker
// fetches lazily the first time it is opened.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const compact = require("emojibase-data/en/compact.json");

// Emojibase groups → Czech. Browsing stays Czech even though the search index
// underneath is English (emojibase ships no Czech locale).
const GROUP_LABELS = {
  0: "Smajlíci",
  1: "Lidé",
  3: "Zvířata a příroda",
  4: "Jídlo a pití",
  5: "Cestování a místa",
  6: "Aktivity",
  7: "Předměty",
  8: "Symboly",
  9: "Vlajky",
};

const entries = compact
  // group 2 = "component" (skin tones, hair styles) — not standalone pictures
  .filter((e) => e.group !== undefined && e.group !== 2 && e.unicode)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map((e) => ({
    c: e.unicode,
    l: e.label,
    g: e.group,
    t: (e.tags ?? []).join(" "),
  }));

const payload = {
  groups: GROUP_LABELS,
  count: entries.length,
  emoji: entries,
};

mkdirSync(join(root, "public"), { recursive: true });
const target = join(root, "public", "emoji.json");
writeFileSync(target, JSON.stringify(payload));

const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024);
console.log(`public/emoji.json — ${entries.length} emoji, ${kb} kB`);
