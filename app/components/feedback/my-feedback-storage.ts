import { FEEDBACK_LIMITS } from "@/lib/feedback-meta";

export type OwnKey = { id: number; token: string };

export const OWN_KEY = "myFeedback";

/** Klíče vlastních připomínek z localStorage — poškozené nebo cizí položky se zahodí. */
export function parseOwnKeys(raw: string | null): OwnKey[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<number>();
    const keys: OwnKey[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const { id, token } = item as { id?: unknown; token?: unknown };
      if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) continue;
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      keys.push({ id, token });
    }
    return keys.slice(0, FEEDBACK_LIMITS.ownMax);
  } catch {
    return [];
  }
}

/** Nová připomínka jde na začátek; nejstarší nad limit se zapomene. */
export function addOwnKey(keys: OwnKey[], key: OwnKey): OwnKey[] {
  return [key, ...keys.filter((k) => k.id !== key.id)].slice(0, FEEDBACK_LIMITS.ownMax);
}
