import type { OwnFeedback } from "@/lib/feedback-meta";

/**
 * Co z vlastních připomínek už autor viděl — kvůli odznaku „nová odpověď“
 * u Připomínek v menu. Jen v prohlížeči autora, server nic neví.
 *
 * Otisk bere stav a odpověď. „Čeká na přečtení“ a „Přečteno“ jsou pro autora
 * totéž (správce jen rozklikl), takže samotné přečtení odznak nevyvolá.
 */

export const SEEN_KEY = "feedbackSeen";
/** Poslední odpověď `/api/feedback/mine` pro odznak v menu — ať se neptá na každé stránce. */
export const MINE_CACHE_KEY = "feedbackMineCache";
export const MINE_CACHE_TTL_MS = 60_000;
/** Po zobrazení „Mých připomínek“ — menu si přepočítá odznak. */
export const SEEN_EVENT = "kantyna:feedback-seen";

export type Seen = Record<number, string>;
export type UpdateKind = "reply" | "status";

type Signable = Pick<OwnFeedback, "status" | "reply" | "merged">;

export function signature(item: Signable): string {
  const status = item.status === "new" || item.status === "read" ? "open" : item.status;
  return JSON.stringify([status, item.reply.trim(), item.merged]);
}

/** Otisk čerstvě odeslané připomínky — aby ji odznak nehlásil jako novinku. */
export const FRESH_SIGNATURE = signature({ status: "new", reply: "", merged: false });

export function parseSeen(raw: string | null): Seen {
  try {
    const data: unknown = JSON.parse(raw ?? "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const seen: Seen = {};
    for (const [id, sig] of Object.entries(data)) {
      if (Number(id) > 0 && typeof sig === "string" && sig.length < 4000) seen[Number(id)] = sig;
    }
    return seen;
  } catch {
    return {};
  }
}

/**
 * Co je nového oproti tomu, co autor viděl. Připomínku, kterou prohlížeč
 * ještě nemá zapsanou (odeslaná před touhle funkcí), nehlásí — jen ji zapíše.
 */
export function diffSeen(items: OwnFeedback[], seen: Seen): { updates: Map<number, UpdateKind>; next: Seen } {
  const updates = new Map<number, UpdateKind>();
  const next: Seen = {};
  for (const item of items) {
    const sig = signature(item);
    const before = seen[item.id];
    next[item.id] = sig;
    if (before === undefined || before === sig) continue;
    let prevReply = "";
    try { prevReply = String((JSON.parse(before) as unknown[])[1] ?? ""); } catch { /* starý formát */ }
    updates.set(item.id, item.reply.trim() && item.reply.trim() !== prevReply ? "reply" : "status");
  }
  return { updates, next };
}

export function readSeen(): Seen {
  try { return parseSeen(localStorage.getItem(SEEN_KEY)); } catch { return {}; }
}

export function writeSeen(seen: Seen): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* */ }
}
