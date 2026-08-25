import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { RELEASE_NOTES } from "./release-notes";

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
});
