import { checkPin } from "./settings";
import { checkRateLimit, isRateLimited } from "./rate-limit";

/** Hlavička, kterou Nastavení posílá u volání chráněných API rout. */
export const PIN_HEADER = "x-settings-pin";

const MAX_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

/**
 * Vpustí dál jen požadavek se správným PINem z Nastavení.
 *
 * Vrací `Response` k okamžitému vrácení, nebo `null` když je vše v pořádku —
 * volající tedy píše `const denied = requireSettingsPin(req); if (denied) return denied;`.
 *
 * Appka běží na veřejné adrese bez autentizace, takže routy, které čtou nebo
 * zapisují celou databázi, nesmí být dostupné komukoli, kdo zná URL. Tohle je
 * záplata do doby, než přijdou skutečné účty — ne cílový stav.
 *
 * **Počítají se jen neúspěchy.** Kdyby kredit ubíral i povedený pokus,
 * vyčerpalo by ho běžné používání a Nastavení by se samo zamklo. Po deseti
 * chybách během patnácti minut se ale zavře úplně, i pro správný PIN —
 * jinak by šlo čtyřmístné číslo uhodnout hrubou silou během chvíle.
 */
export function requireSettingsPin(req: Request): Response | null {
  const result = verifySettingsPin(getClientIp(req), req.headers.get(PIN_HEADER));
  if (result === "locked") {
    return new Response("Příliš mnoho pokusů. Zkuste to za 15 minut.", { status: 429 });
  }
  if (result === "denied") {
    return new Response("Neautorizováno.", { status: 401 });
  }
  return null;
}

/**
 * Stejná brána jako `requireSettingsPin`, jen bez `Request` — pro Server
 * Actions, které PIN dostávají jako argument. Sdílí s API routami i počítadlo
 * neúspěchů, takže se hádání nedá rozložit mezi oba vstupy.
 */
export function verifySettingsPin(ip: string, pin: string | null | undefined): "ok" | "denied" | "locked" {
  const key = `pin-auth:${ip}`;
  if (isRateLimited(key, MAX_FAILURES)) return "locked";
  if (!pin || !checkPin(pin)) {
    checkRateLimit(key, MAX_FAILURES, LOCKOUT_MS);
    return "denied";
  }
  return "ok";
}
