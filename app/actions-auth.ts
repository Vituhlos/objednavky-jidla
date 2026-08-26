"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { checkRateLimit, getRateLimitReset, isRateLimited } from "@/lib/rate-limit";
import { AuthError } from "@/lib/auth/errors";
import {
  createSession,
  getSessionCookieOptions,
  revokeSession,
  SESSION_COOKIE,
} from "@/lib/auth/sessions";
import { authenticateWithPassword } from "@/lib/auth/users";

/**
 * Akce kolem přihlášení.
 *
 * Oddělené od `actions.ts` schválně: tam jsou akce, které se zamykají, tady ty,
 * kterými se odemyká. Míchat je dohromady by znamenalo, že v jednom souboru
 * platí dvě protichůdná pravidla.
 *
 * Chyby se vracejí, nevyhazují. Next v produkci hlášky ze server actions
 * maskuje, takže vyhozená věta by k člověku dorazila jako obecný digest —
 * stejná úvaha jako u `actionAddClosure`.
 */

const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Jedna hláška pro špatné heslo i neznámý e-mail — jinak by šlo účty vyzkoušet. */
const BAD_CREDENTIALS = "Nesprávný e-mail nebo heslo.";

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string; lockedUntil?: number };

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function actionLogin(
  email: unknown,
  password: unknown,
  stayLoggedIn: unknown
): Promise<LoginResult> {
  // Typ z klienta není kontrola — server action jde zavolat s čímkoli.
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: BAD_CREDENTIALS };
  }
  const persistent = stayLoggedIn === true;

  const key = `login:${await clientIp()}`;
  if (isRateLimited(key, LOGIN_MAX_FAILURES)) {
    return {
      ok: false,
      error: "Příliš mnoho pokusů. Zkuste to znovu za chvíli.",
      lockedUntil: getRateLimitReset(key) ?? Date.now(),
    };
  }

  const user = authenticateWithPassword(email, password);
  if (!user) {
    // Rozpočet ubírá jen neúspěch. Kdyby ho ubíral každý pokus, vyhodilo by to
    // člověka, který se přihlašuje správně několikrát za den.
    checkRateLimit(key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
    return { ok: false, error: BAD_CREDENTIALS };
  }

  try {
    const { token, expiresAt } = createSession(user.id, {
      persistent,
      userAgent: (await headers()).get("user-agent") ?? undefined,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, token, getSessionCookieOptions(persistent, expiresAt));
  } catch (err) {
    // Blokovaný účet heslo prokázal, takže se smí dozvědět proč (R14).
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actionLogout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) revokeSession(token);
  store.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
}
