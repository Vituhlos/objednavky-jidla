import { describe, expect, it } from "vitest";
import type { OwnFeedback } from "@/lib/feedback-meta";
import { diffSeen, FRESH_SIGNATURE, parseSeen, signature } from "./feedback-seen";

const item = (over: Partial<OwnFeedback> = {}): OwnFeedback => ({
  id: 1, createdAt: "2026-09-24 08:00:00", category: "napad", message: "Tmavý režim",
  status: "new", reply: "", attachmentCount: 0, merged: false, ...over,
});

describe("odznak nové odpovědi", () => {
  it("čerstvě odeslanou připomínku nehlásí a samotné přečtení taky ne", () => {
    const seen = { 1: FRESH_SIGNATURE };
    expect(diffSeen([item()], seen).updates.size).toBe(0);
    expect(diffSeen([item({ status: "read" })], seen).updates.size).toBe(0);
  });

  it("nahlásí odpověď i změnu stavu a rozliší je", () => {
    const seen = { 1: FRESH_SIGNATURE, 2: signature(item({ id: 2 })) };
    const { updates } = diffSeen([
      item({ status: "read", reply: "Díky, podíváme se." }),
      item({ id: 2, status: "planned" }),
    ], seen);
    expect(updates.get(1)).toBe("reply");
    expect(updates.get(2)).toBe("status");
  });

  it("po zobrazení už nic nehlásí a připomínku bez záznamu jen zapíše", () => {
    const first = diffSeen([item({ status: "done", reply: "Hotovo." })], { 1: FRESH_SIGNATURE });
    expect(first.updates.size).toBe(1);
    expect(diffSeen([item({ status: "done", reply: "Hotovo." })], first.next).updates.size).toBe(0);
    const unknown = diffSeen([item({ id: 9, status: "done" })], {});
    expect(unknown.updates.size).toBe(0);
    expect(unknown.next[9]).toBeDefined();
  });

  it("sloučení s jinou připomínkou je změna", () => {
    expect(diffSeen([item({ merged: true, status: "planned" })], { 1: FRESH_SIGNATURE }).updates.get(1)).toBe("status");
  });

  it("poškozená data v prohlížeči nic nerozbijí", () => {
    expect(parseSeen("nesmysl")).toEqual({});
    expect(parseSeen('{"x":"a","3":5,"4":"ok"}')).toEqual({ 4: "ok" });
  });
});
