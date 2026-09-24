"use client";

import { useEffect, useState } from "react";
import type { OwnFeedback } from "@/lib/feedback-meta";
import { OWN_KEY, parseOwnKeys } from "./my-feedback-storage";
import { diffSeen, MINE_CACHE_KEY, MINE_CACHE_TTL_MS, readSeen, SEEN_EVENT, writeSeen } from "./feedback-seen";

function readCache(): OwnFeedback[] | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(MINE_CACHE_KEY) ?? "null") as { at?: number; items?: OwnFeedback[] } | null;
    if (!raw || !Array.isArray(raw.items) || typeof raw.at !== "number") return null;
    return Date.now() - raw.at < MINE_CACHE_TTL_MS ? raw.items : null;
  } catch {
    return null;
  }
}

/**
 * Kolik vlastních připomínek má novou odpověď nebo stav, které autor ještě
 * neviděl — pro odznak u Připomínek v menu. Ptá se serveru jen když prohlížeč
 * nějakou připomínku odeslal, a výsledek drží minutu, ať se neptá na každé
 * stránce. Na stránce Připomínky je 0 — tam je autor vidí rovnou.
 */
export function useFeedbackBadge(onFeedbackPage: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (onFeedbackPage) return;
    let cancelled = false;

    const apply = (items: OwnFeedback[]) => {
      const seen = readSeen();
      const { updates, next } = diffSeen(items, seen);
      // Připomínky, které prohlížeč ještě neměl zapsané, si jen tiše zapamatuje
      if (items.some((i) => seen[i.id] === undefined)) {
        writeSeen({ ...next, ...Object.fromEntries([...updates.keys()].map((id) => [id, seen[id]])) });
      }
      if (!cancelled) setCount(updates.size);
    };

    const load = async () => {
      let keys;
      try { keys = parseOwnKeys(localStorage.getItem(OWN_KEY)); } catch { return; }
      if (keys.length === 0) { if (!cancelled) setCount(0); return; }
      const cached = readCache();
      if (cached) { apply(cached); return; }
      try {
        const res = await fetch("/api/feedback/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: keys }),
        });
        const data = await res.json() as { ok: boolean; items?: OwnFeedback[] };
        if (!data.ok || !data.items) return;
        try { sessionStorage.setItem(MINE_CACHE_KEY, JSON.stringify({ at: Date.now(), items: data.items })); } catch { /* */ }
        apply(data.items);
      } catch { /* bez sítě odznak prostě není */ }
    };

    void load();
    const onSeen = () => { const cached = readCache(); if (cached) apply(cached); };
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      cancelled = true;
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [onFeedbackPage]);

  return onFeedbackPage ? 0 : count;
}
