"use client";

import { useCallback, useEffect, useState } from "react";
import { VOTER_TOKEN_PATTERN, type VoteValue } from "@/lib/feedback-meta";

const VOTER_KEY = "feedbackVoter";
const VOTES_KEY = "feedbackVotes";
// Z doby „chci taky“ — seznam id s 👍. Převede se jednou a smaže.
const LEGACY_VOTED_KEY = "feedbackVoted";

export type Tally = { up: number; down: number };

function getVoter(): string | null {
  try {
    let voter = localStorage.getItem(VOTER_KEY);
    if (!voter || !VOTER_TOKEN_PATTERN.test(voter)) {
      voter = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VOTER_KEY, voter);
    }
    return voter;
  } catch {
    return null; // bez localStorage (soukromý režim) hlasovat nejde – hlas by nešel vzít zpět
  }
}

function readMine(): Record<number, 1 | -1> {
  const result: Record<number, 1 | -1> = {};
  try {
    const data: unknown = JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}");
    if (data && typeof data === "object") {
      for (const [id, v] of Object.entries(data)) {
        if (Number(id) > 0 && (v === 1 || v === -1)) result[Number(id)] = v;
      }
    }
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_VOTED_KEY) ?? "null");
    if (Array.isArray(legacy)) {
      for (const id of legacy) if (Number.isInteger(id) && id > 0) result[id] ??= 1;
      localStorage.removeItem(LEGACY_VOTED_KEY);
      writeMine(result);
    }
  } catch { /* */ }
  return result;
}

function writeMine(votes: Record<number, 1 | -1>): void {
  try {
    const recent = Object.entries(votes).slice(-300);
    localStorage.setItem(VOTES_KEY, JSON.stringify(Object.fromEntries(recent)));
  } catch { /* */ }
}

/**
 * Hlasování 👍 / 👎 pro „Co chystáme“ i „Připomínky ostatních“: počty ze
 * serveru, vlastní hlas z prohlížeče. Změna se projeví hned; když ji server
 * odmítne, vrátí se zpět.
 */
export function useVotes(initial: { id: number; up: number; down: number }[]) {
  const [tallies, setTallies] = useState<Record<number, Tally>>(
    () => Object.fromEntries(initial.map((i) => [i.id, { up: i.up, down: i.down }])),
  );
  const [mine, setMine] = useState<Record<number, 1 | -1>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vlastní hlasy jsou jen v prohlížeči
    setMine(readMine());
  }, []);

  /** Klik na 👍 nebo 👎. Druhý klik na stejný palec hlas vezme zpět. */
  const vote = useCallback(async (id: number, pressed: 1 | -1) => {
    const voter = getVoter();
    if (!voter) { setError("Hlasovat jde jen v prohlížeči, který si pamatuje data stránek."); return; }
    const before = mine[id] ?? 0;
    const value: VoteValue = before === pressed ? 0 : pressed;

    const apply = (from: VoteValue, to: VoteValue) => {
      setMine((prev) => {
        const next = { ...prev };
        if (to === 0) delete next[id]; else next[id] = to;
        writeMine(next);
        return next;
      });
      setTallies((prev) => {
        const t = prev[id] ?? { up: 0, down: 0 };
        return {
          ...prev,
          [id]: {
            up: Math.max(0, t.up - (from === 1 ? 1 : 0) + (to === 1 ? 1 : 0)),
            down: Math.max(0, t.down - (from === -1 ? 1 : 0) + (to === -1 ? 1 : 0)),
          },
        };
      });
    };

    apply(before, value);
    setError(null);
    try {
      const res = await fetch("/api/feedback/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, voter, value }),
      });
      const data = await res.json() as { ok: boolean; up?: number; down?: number; error?: string };
      if (!data.ok || data.up === undefined || data.down === undefined) throw new Error(data.error);
      setTallies((prev) => ({ ...prev, [id]: { up: data.up!, down: data.down! } }));
    } catch (err) {
      apply(value, before);
      setError(err instanceof Error && err.message ? err.message : "Hlas se nepodařilo uložit.");
    }
  }, [mine]);

  return { tallies, mine, error, vote };
}
