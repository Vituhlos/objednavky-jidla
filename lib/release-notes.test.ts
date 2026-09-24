import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { RELEASE_NOTES, formatReleaseDate, getPublicReleaseNotes, type ReleaseNote } from "./release-notes";

/**
 * Novinky v aplikaci jsou psané ručně a zvlášť od `CHANGELOG.md` — ten je
 * technický, tohle je pro lidi. Cena za to je, že se na ně dá při vydání
 * zapomenout; u verzí 1.3.2 a 1.3.3 se to taky stalo a appka pak ukazovala
 * novinky staré dvě verze.
 *
 * Tenhle test je proto brána: bez záznamu k aktuální verzi neprojde release.
 */
describe("RELEASE_NOTES", () => {
  it("obsahuje záznam k verzi z package.json", () => {
    const versions = RELEASE_NOTES.map((note) => note.version);
    expect(versions).toContain(pkg.version);
  });

  it("má nejnovější verzi na prvním místě", () => {
    expect(RELEASE_NOTES[0].version).toBe(pkg.version);
  });

  it("nemá dvě sekce se stejným nadpisem u jedné verze", () => {
    for (const note of RELEASE_NOTES) {
      const titles = note.sections.map((s) => s.title);
      expect(new Set(titles).size, `verze ${note.version}`).toBe(titles.length);
    }
  });

  it("nemá prázdné sekce ani položky", () => {
    for (const note of RELEASE_NOTES) {
      expect(note.sections.length, `verze ${note.version}`).toBeGreaterThan(0);
      for (const section of note.sections) {
        expect(section.items.length, `${note.version} / ${section.title}`).toBeGreaterThan(0);
        for (const item of section.items) {
          expect(item.trim().length, `${note.version} / ${section.title}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("má u každé vydané verze datum ve tvaru RRRR-MM-DD", () => {
    for (const note of RELEASE_NOTES) {
      if (note.version === "Unreleased") continue;
      expect(note.date, `verze ${note.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("nemá ve veřejných novinkách prázdné řádky ani oslovení", () => {
    for (const note of RELEASE_NOTES) {
      for (const item of note.forEveryone) {
        expect(item.trim().length, `verze ${note.version}`).toBeGreaterThan(0);
        // Stránka Připomínky tyká, zbytek appky vyká — veřejné novinky jsou neosobní.
        expect(item, `verze ${note.version}`).not.toMatch(/(?<!\p{L})(vy|vás|vám|vaš\p{L}*|tebe|tobě|tvůj|tvoj\p{L}*|tvá|tvé)(?!\p{L})/iu);
      }
    }
  });
});

describe("getPublicReleaseNotes", () => {
  const note = (version: string, forEveryone: string[]): ReleaseNote => ({
    version, date: "2026-01-02", title: version, forEveryone,
    sections: [{ title: "Fixed", items: ["x"] }],
  });

  it("vynechá verze bez veřejných novinek i nevydanou verzi a nepustí ven technické sekce", () => {
    const result = getPublicReleaseNotes([note("Unreleased", ["a"]), note("2.0.0", ["b"]), note("1.9.0", [])]);
    expect(result).toEqual([{ version: "2.0.0", date: "2026-01-02", title: "2.0.0", forEveryone: ["b"] }]);
  });

  it("má co ukázat pro aktuální data", () => {
    expect(getPublicReleaseNotes().length).toBeGreaterThan(0);
  });
});

describe("formatReleaseDate", () => {
  it("píše datum česky s mezerami a bez nul", () => {
    expect(formatReleaseDate("2026-09-04")).toBe("4. 9. 2026");
    expect(formatReleaseDate("nesmysl")).toBe("nesmysl");
  });
});

