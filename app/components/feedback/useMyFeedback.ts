"use client";

import { useCallback, useEffect, useState } from "react";
import type { OwnFeedback } from "@/lib/feedback-meta";
import { addOwnKey, OWN_KEY, parseOwnKeys, type OwnKey } from "./my-feedback-storage";
import { diffSeen, FRESH_SIGNATURE, MINE_CACHE_KEY, readSeen, SEEN_EVENT, writeSeen, type UpdateKind } from "./feedback-seen";

function readKeys(): OwnKey[] {
  try { return parseOwnKeys(localStorage.getItem(OWN_KEY)); } catch { return []; }
}

function writeKeys(keys: OwnKey[]): void {
  try {
    if (keys.length === 0) localStorage.removeItem(OWN_KEY);
    else localStorage.setItem(OWN_KEY, JSON.stringify(keys));
  } catch { /* soukromý režim – seznam prostě nepřežije zavření */ }
}

/**
 * „Moje připomínky“ bez účtů: prohlížeč si ke každé odeslané připomínce
 * pamatuje tajný kód a server podle něj vrátí stav a odpověď. Kdo vymaže
 * data prohlížeče nebo přejde na jiné zařízení, seznam neuvidí — to je cena
 * za to, že se nikdo nemusí přihlašovat.
 */
export function useMyFeedback() {
  const [items, setItems] = useState<OwnFeedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Co se změnilo od minula — zvýrazní se jen při téhle návštěvě
  const [updates, setUpdates] = useState<Map<number, UpdateKind>>(new Map());

  const refresh = useCallback(async () => {
    const keys = readKeys();
    if (keys.length === 0) { setItems([]); setLoaded(true); return; }
    try {
      const res = await fetch("/api/feedback/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: keys }),
      });
      const data = await res.json() as { ok: boolean; items?: OwnFeedback[] };
      if (!data.ok || !data.items) return;
      // Smazané připomínky server nevrátí — jejich kódy není proč držet
      const alive = new Set(data.items.map((i) => i.id));
      writeKeys(keys.filter((k) => alive.has(k.id)));
      setItems(data.items);
      // Autor je na stránce a změny vidí — odznak v menu tím zhasne
      const { updates: fresh, next } = diffSeen(data.items, readSeen());
      if (fresh.size > 0) setUpdates((prev) => new Map([...prev, ...fresh]));
      writeSeen(next);
      try { sessionStorage.setItem(MINE_CACHE_KEY, JSON.stringify({ at: Date.now(), items: data.items })); } catch { /* */ }
      window.dispatchEvent(new Event(SEEN_EVENT));
    } catch { /* bez sítě zůstane poslední stav */ } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- načtení z prohlížeče po hydrataci
    void refresh();
  }, [refresh]);

  const remember = useCallback((id: number, token: string) => {
    writeKeys(addOwnKey(readKeys(), { id, token }));
    writeSeen({ ...readSeen(), [id]: FRESH_SIGNATURE });
    void refresh();
  }, [refresh]);

  const forget = useCallback((id: number) => {
    writeKeys(readKeys().filter((k) => k.id !== id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /** Stáhne připomínku ze serveru (i u ostatních). Vrací chybovou hlášku, nebo null. */
  const withdraw = useCallback(async (id: number): Promise<string | null> => {
    const key = readKeys().find((k) => k.id === id);
    if (!key) return "Tuhle připomínku už stáhnout nejde.";
    try {
      const res = await fetch("/api/feedback/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token: key.token }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) return data.error ?? "Stáhnout se nepodařilo.";
      forget(id);
      return null;
    } catch {
      return "Stáhnout se nepodařilo. Zkus to znovu.";
    }
  }, [forget]);

  return { items, loaded, updates, remember, forget, withdraw };
}
