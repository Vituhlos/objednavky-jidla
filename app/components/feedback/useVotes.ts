"use client";

import { useCallback, useEffect, useState } from "react";
import { VOTER_TOKEN_PATTERN, type VotableFeedback } from "@/lib/feedback-meta";

const VOTER_KEY = "feedbackVoter";
const VOTED_KEY = "feedbackVoted";

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

function readVoted(): Set<number> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(VOTED_KEY) ?? "[]");
    return new Set(Array.isArray(data) ? data.filter((n): n is number => Number.isInteger(n) && n > 0) : []);
  } catch {
    return new Set();
  }
}

function writeVoted(ids: Set<number>): void {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...ids].slice(-200))); } catch { /* */ }
}

/**
 * Hlasování „chci taky“: počty ze serveru, vlastní hlasy z prohlížeče.
 * Přepnutí se projeví hned; když server odmítne, vrátí se zpět.
 */
export function useVotes(initial: VotableFeedback[]) {
  const [counts, setCounts] = useState<Record<number, number>>(() => Object.fromEntries(initial.map((i) => [i.id, i.votes])));
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vlastní hlasy jsou jen v prohlížeči
    setVoted(readVoted());
  }, []);

  const toggle = useCallback(async (id: number) => {
    const voter = getVoter();
    if (!voter) { setError("Hlasovat jde jen v prohlížeči, který si pamatuje data stránek."); return; }
    const vote = !voted.has(id);
    const apply = (on: boolean, delta: number) => {
      setVoted((prev) => {
        const next = new Set(prev);
        if (on) next.add(id); else next.delete(id);
        writeVoted(next);
        return next;
      });
      setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    };
    apply(vote, vote ? 1 : -1);
    setError(null);
    try {
      const res = await fetch("/api/feedback/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, voter, vote }),
      });
      const data = await res.json() as { ok: boolean; votes?: number; error?: string };
      if (!data.ok || data.votes === undefined) throw new Error(data.error);
      setCounts((prev) => ({ ...prev, [id]: data.votes! }));
    } catch (err) {
      apply(!vote, vote ? -1 : 1);
      setError(err instanceof Error && err.message ? err.message : "Hlas se nepodařilo uložit.");
    }
  }, [voted]);

  return { counts, voted, error, toggle };
}
