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
import { authenticateWithPassword, createUserWithPassword } from "@/lib/auth/users";
import { checkPasswordStrength } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/auth/mail";
import { findMergeCandidates } from "@/lib/people";
import { getSettings } from "@/lib/settings";

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

// ── Registrace ───────────────────────────────────────────────────────────────

// Kolegové v kanceláři sdílejí jednu veřejnou IP, takže limit musí unést,
// že se tým zaregistruje během jednoho odpoledne. Bot dělá stovky pokusů,
// ne patnáct.
const REGISTER_MAX = 15;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export interface ClaimCandidate {
  id: number;
  name: string;
  department: string | null;
  orderCount: number;
  lastOrderDate: string | null;
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string }
  /** Stejné jméno už v historii je. Rozhodnout musí ten, kdo se registruje. */
  | { ok: false; claim: ClaimCandidate[] };

/**
 * Kanonická adresa aplikace pro odkazy v e-mailech.
 *
 * Nikdy z hlavičky `Host` — tu si útočník nastaví sám a ověřovací odkaz by
 * pak mířil na jeho server i s platným tokenem.
 */
function appBaseUrl(): string {
  const configured = process.env.APP_URL?.trim() || getSettings().telegramAppUrl.trim();
  if (!configured) throw new Error("Pro odesílání odkazů nastavte APP_URL.");
  return new URL(configured).origin;
}

export async function actionRegister(
  email: unknown,
  name: unknown,
  password: unknown,
  departmentId: unknown,
  claimPersonId?: unknown
): Promise<RegisterResult> {
  if (typeof email !== "string" || typeof name !== "string" || typeof password !== "string") {
    return { ok: false, error: "Vyplňte prosím všechna pole." };
  }
  const deptId =
    departmentId === null || departmentId === undefined
      ? null
      : Number.isSafeInteger(departmentId) && (departmentId as number) > 0
        ? (departmentId as number)
        : null;
  if (deptId === null) return { ok: false, error: "Vyberte oddělení." };

  const jmeno = name.trim();
  if (jmeno.length < 2) return { ok: false, error: "Vyplňte jméno a příjmení." };

  // Formát e-mailu říkáme nahlas — to není údaj o tom, kdo tu účet má.
  // Existenci účtu naopak neprozrazujeme nikdy.
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, error: "E-mail nemá platný tvar." };
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) return { ok: false, error: strength.reason ?? "Heslo je příliš krátké." };

  const key = `register:${await clientIp()}`;
  if (isRateLimited(key, REGISTER_MAX)) {
    return { ok: false, error: "Příliš mnoho registrací z této sítě. Zkuste to později." };
  }

  // „Nejsi to náhodou ty?" — nabídne se jen strávník bez účtu (R4). Jména
  // strávníků jsou stejně veřejná na objednávkové stránce, takže se nic
  // nového neprozrazuje.
  const claimId =
    Number.isSafeInteger(claimPersonId) && (claimPersonId as number) > 0
      ? (claimPersonId as number)
      : undefined;
  if (claimPersonId === undefined) {
    const kandidati = findMergeCandidates(jmeno);
    if (kandidati.length > 0) {
      return {
        ok: false,
        claim: kandidati.map((p) => ({
          id: p.id,
          name: p.name,
          department: p.departmentName,
          orderCount: p.orderCount,
          lastOrderDate: p.lastOrderDate,
        })),
      };
    }
  }

  // Rozpočet ubírá až skutečně založený účet. Otevřená registrace na veřejné
  // adrese je sama o sobě to, co se dá zneužít — ale mezikrok „nejsi to ty?“
  // žádný účet nezakládá a nemá co ubírat.
  checkRateLimit(key, REGISTER_MAX, REGISTER_WINDOW_MS);

  let userId: number;
  try {
    ({ userId } = createUserWithPassword({
      email,
      name: jmeno,
      password,
      departmentId: deptId,
      claimPersonId: claimId,
    }));
  } catch (err) {
    // Nesmí prozradit, jestli e-mail už účet má — jinak by šlo účty vyzkoušet.
    if (err instanceof AuthError) return { ok: false, error: err.message };
    return { ok: false, error: "Účet se nepodařilo založit. Zkontrolujte údaje." };
  }

  try {
    await sendVerificationEmail(userId, appBaseUrl());
  } catch {
    // Účet existuje; nefunkční SMTP nesmí registraci shodit. Ověření se dá
    // poslat znovu z účtu.
  }

  try {
    const { token, expiresAt } = createSession(userId, {
      persistent: false,
      userAgent: (await headers()).get("user-agent") ?? undefined,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, token, getSessionCookieOptions(false, expiresAt));
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
