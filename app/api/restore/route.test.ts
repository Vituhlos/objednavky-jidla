import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Záloha → smazání → obnova připomínek. Hlídá hlavně, aby se po obnově
 * skrytá připomínka znovu neobjevila na veřejné nástěnce a aby se neztratily
 * návrhy v „Co chystáme“ ani hlasy.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "restore-route-")), "test.db");
process.env.SETTINGS_PIN = "4321";

let BACKUP: typeof import("../backup/route")["GET"];
let RESTORE: typeof import("./route")["POST"];
let fb: typeof import("@/lib/feedback");
let db: typeof import("@/lib/db");

beforeAll(async () => {
  ({ GET: BACKUP } = await import("../backup/route"));
  ({ POST: RESTORE } = await import("./route"));
  fb = await import("@/lib/feedback");
  db = await import("@/lib/db");
});

const pinHeaders = { "x-settings-pin": "4321", "x-forwarded-for": "10.99.0.1" };

describe("záloha a obnova připomínek", () => {
  it("zachová skrytí, návrhy správce i hlasy", async () => {
    const input = (category: string, message: string) => {
      const r = fb.validateFeedbackInput({ category, message });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    };
    const { entry: visible } = fb.addFeedback(input("napad", "Tmavý režim by se hodil."), "");
    const { entry: hidden } = fb.addFeedback(input("napad", "Nevhodný text, který jsem skryl."), "");
    fb.updateFeedback(hidden.id, { hidden: true });
    const proposal = fb.addProposal({ title: "Objednávka na celý týden", category: "napad" });
    fb.setVote(visible.id, "a".repeat(24), 1);
    fb.setVote(visible.id, "b".repeat(24), -1);
    fb.setVote(proposal.id, "a".repeat(24), 1);
    const { entry: dup } = fb.addFeedback(input("napad", "Duplicita tmavého režimu."), "");
    fb.mergeFeedback(dup.id, visible.id);

    const backupRes = await BACKUP(new Request("http://localhost/api/backup", { headers: pinHeaders }) as never);
    expect(backupRes.status).toBe(200);
    const backup = await backupRes.json();
    expect(backup.feedback_votes).toHaveLength(3);

    // Nový server: prázdné tabulky
    db.getDb().exec("DELETE FROM feedback_votes; DELETE FROM feedback;");

    const body = JSON.stringify({ backup, restoreSettings: false });
    const res = await RESTORE(new Request("http://localhost/api/restore", {
      method: "POST",
      body,
      headers: { ...pinHeaders, "content-type": "application/json" },
    }) as never);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result).toMatchObject({ feedback: 4, feedbackVotes: 3 });

    const publicTexts = fb.getPublicFeedback().map((i) => i.text);
    expect(publicTexts).toContain("Tmavý režim by se hodil.");
    expect(publicTexts).not.toContain("Nevhodný text, který jsem skryl.");

    const board = fb.getVotableFeedback();
    expect(board.map((i) => i.summary)).toEqual(["Objednávka na celý týden"]);
    expect(board[0]).toMatchObject({ up: 1, down: 0 });
    expect(fb.getPublicFeedback().find((i) => i.text.startsWith("Tmavý"))).toMatchObject({ up: 1, down: 1 });

    // Sloučená duplicita zůstane sloučená a na nástěnce není
    expect(publicTexts).not.toContain("Duplicita tmavého režimu.");
    const restoredDup = fb.getFeedbackList().find((e) => e.message === "Duplicita tmavého režimu.");
    const restoredTarget = fb.getFeedbackList().find((e) => e.message === "Tmavý režim by se hodil.");
    expect(restoredDup?.mergedInto).toBe(restoredTarget?.id);

    // Druhá obnova stejné zálohy nic nezdvojí
    const again = await RESTORE(new Request("http://localhost/api/restore", {
      method: "POST",
      body,
      headers: { ...pinHeaders, "content-type": "application/json" },
    }) as never);
    expect((await again.json()).result).toMatchObject({ feedback: 0, feedbackVotes: 0 });
  });
});
