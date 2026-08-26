"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { checkRateLimit, getRateLimitReset, isRateLimited } from "@/lib/rate-limit";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/guards";
import { GOOGLE_LINK_COOKIE, readPendingGoogleLink } from "@/lib/auth/oauth";
import {
  createSession,
  getSessionCookieOptions,
  listSessions,
  revokeAllSessions,
  revokeSession,
  SESSION_COOKIE,
} from "@/lib/auth/sessions";
import {
  authenticateWithPassword,
  changePassword,
  createUserWithPassword,
  linkGoogleIdentity,
  verifyUserPassword,
} from "@/lib/auth/users";
import { checkPasswordStrength } from "@/lib/auth/password";
import {
  resetPasswordWithToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/auth/mail";
import { findMergeCandidates } from "@/lib/people";
import {
  countActiveGuests,
  createInvite,
  listInvites,
  registerGuestWithInvite,
  revokeInvite,
} from "@/lib/auth/invites";
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

// ── Hesla ────────────────────────────────────────────────────────────────────

const RESET_MAX = 10;
const RESET_WINDOW_MS = 60 * 60 * 1000;

/**
 * Požádá o odkaz na obnovu hesla.
 *
 * Odpověď je vždy stejná, i pro neexistující účet. Jinak by se z formuláře
 * stal seznam toho, kdo tu účet má — a ten seznam by šel projet strojově.
 */
export async function actionRequestPasswordReset(
  email: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const HOTOVO = { ok: true } as const;
  if (typeof email !== "string" || !email.trim()) return HOTOVO;

  const key = `reset-request:${await clientIp()}`;
  if (!checkRateLimit(key, RESET_MAX, RESET_WINDOW_MS)) {
    return { ok: false, error: "Příliš mnoho pokusů. Zkuste to za hodinu." };
  }

  try {
    await sendPasswordResetEmail(email, appBaseUrl());
  } catch {
    // Ani chyba SMTP nesmí prozradit, že účet existuje.
  }
  return HOTOVO;
}

export async function actionResetPassword(
  token: unknown,
  newPassword: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof token !== "string" || typeof newPassword !== "string") {
    return { ok: false, error: "Odkaz nefunguje. Vyžádejte si nový." };
  }

  const key = `reset-use:${await clientIp()}`;
  if (!checkRateLimit(key, RESET_MAX, RESET_WINDOW_MS)) {
    return { ok: false, error: "Příliš mnoho pokusů. Zkuste to za hodinu." };
  }

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { ok: false, error: strength.reason ?? "Heslo je příliš krátké." };

  try {
    resetPasswordWithToken(token, newPassword);
  } catch {
    // Použitý, prošlý i vymyšlený token končí stejně — jinak by šlo tokeny
    // zkoušet a poznat, který existoval.
    return { ok: false, error: "Odkaz už byl použitý, nebo mu vypršela platnost." };
  }

  // Sezení zrušil backend. Cookie po sobě uklidíme, ať nezůstane mrtvá.
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Změna hesla zevnitř účtu. Aktuální sezení zůstává, ostatní zanikají. */
export async function actionChangePassword(
  currentPassword: unknown,
  newPassword: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return { ok: false, error: "Vyplňte obě pole." };
  }

  const key = `password-change:${await clientIp()}`;
  if (isRateLimited(key, RESET_MAX)) {
    return { ok: false, error: "Příliš mnoho pokusů. Zkuste to za hodinu." };
  }
  if (!verifyUserPassword(session.userId, currentPassword)) {
    checkRateLimit(key, RESET_MAX, RESET_WINDOW_MS);
    return { ok: false, error: "Stávající heslo nesouhlasí." };
  }

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { ok: false, error: strength.reason ?? "Heslo je příliš krátké." };

  changePassword(session.userId, newPassword, session.sessionId);
  return { ok: true };
}

// ── Sezení ───────────────────────────────────────────────────────────────────

export interface SessionView {
  id: number;
  /** Je to zařízení, na kterém se člověk právě dívá? */
  current: boolean;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  persistent: boolean;
}

/**
 * Přihlášená zařízení.
 *
 * Tokeny ani jejich otisky sem nepatří a `listSessions` je ani nevrací —
 * do klienta jde jen to, podle čeho člověk pozná svůj mobil.
 */
export async function actionListSessions(): Promise<SessionView[]> {
  const session = await requireSession();
  return listSessions(session.userId).map((s) => ({
    id: s.id,
    current: s.id === session.sessionId,
    device: describeDevice(s.userAgent),
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    persistent: s.persistent,
  }));
}

/** Odhlásí všechna ostatní zařízení. To, na kterém se člověk dívá, zůstane. */
export async function actionRevokeOtherSessions(): Promise<{ ok: true; count: number }> {
  const session = await requireSession();
  const before = listSessions(session.userId).length;
  revokeAllSessions(session.userId, session.sessionId);
  return { ok: true, count: Math.max(0, before - 1) };
}

/**
 * Z hlavičky prohlížeče udělá něco, co člověk pozná.
 *
 * Záměrně hrubé: přesná verze prohlížeče nikomu nepomůže rozhodnout, jestli
 * tohle přihlášení zná, a plná hlavička by v seznamu jen překážela.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Neznámé zařízení";
  const ua = userAgent.toLowerCase();

  const system = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "Mac"
            : ua.includes("linux")
              ? "Linux"
              : "Neznámý systém";

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/") && !ua.includes("chromium")
      ? "Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/")
          ? "Safari"
          : null;

  return browser ? `${system} · ${browser}` : system;
}

// ── Pozvánky hostů ───────────────────────────────────────────────────────────

export interface InviteView {
  id: number;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  revoked: boolean;
}

/**
 * Vytvoří pozvací odkaz pro hosta.
 *
 * Token se vrací **jedinkrát** — potom už ho nikdo nezjistí, protože v databázi
 * je jen otisk. Kdo odkaz ztratí, vytvoří nový a starý zruší.
 *
 * Limity (tři aktivní hosté, pět čekajících pozvánek) i pravidlo „host nesmí
 * zvát dál" hlídá backend; tady se jen ukáže, co odmítl.
 */
export async function actionCreateInvite(): Promise<
  { ok: true; url: string; expiresAt: string } | { ok: false; error: string }
> {
  const session = await requireSession();

  // Adresa se ověřuje dřív, než pozvánka vznikne. Obráceně by chybějící
  // APP_URL založila pozvánku, jejíž odkaz už nikdo nikdy neuvidí — a ještě by
  // ubrala z pěti čekajících.
  let base: string;
  try {
    base = appBaseUrl();
  } catch {
    return {
      ok: false,
      error: "Aplikace nezná svou veřejnou adresu. Správce musí nastavit APP_URL.",
    };
  }

  try {
    const { token, expiresAt } = createInvite(session.userId);
    const url = new URL("/ucet/pozvanka", base);
    url.searchParams.set("token", token);
    return { ok: true, url: url.href, expiresAt };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Pozvánku se nepodařilo vytvořit.",
    };
  }
}

export async function actionListInvites(): Promise<InviteView[]> {
  const session = await requireSession();
  return listInvites(session.userId).map((i) => ({
    id: i.id,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
    used: i.usedAt !== null,
    revoked: i.revokedAt !== null,
  }));
}

export async function actionRevokeInvite(
  inviteId: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!Number.isSafeInteger(inviteId) || (inviteId as number) <= 0) {
    return { ok: false, error: "Neplatná pozvánka." };
  }
  try {
    revokeInvite(inviteId as number, session.userId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Pozvánku se nepodařilo zrušit.",
    };
  }
}

export async function actionGuestCount(): Promise<number> {
  const session = await requireSession();
  return countActiveGuests(session.userId);
}

/**
 * Registrace hosta z pozvánky.
 *
 * Účet, strávník, vztah hosta i spotřebování pozvánky vznikají v jediné
 * backendové transakci — proto se sem posílá jen to, co host vyplnil. Žádné
 * `personId` ani `claimPersonId`: host historii nepřebírá, host je nový.
 */
export async function actionRegisterGuest(
  token: unknown,
  email: unknown,
  name: unknown,
  password: unknown,
  departmentId: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    typeof token !== "string" ||
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string"
  ) {
    return { ok: false, error: "Vyplňte prosím všechna pole." };
  }

  const deptId =
    Number.isSafeInteger(departmentId) && (departmentId as number) > 0
      ? (departmentId as number)
      : null;
  if (deptId === null) return { ok: false, error: "Vyberte oddělení." };

  const jmeno = name.trim();
  if (jmeno.length < 2) return { ok: false, error: "Vyplňte jméno a příjmení." };
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, error: "E-mail nemá platný tvar." };
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) return { ok: false, error: strength.reason ?? "Heslo je příliš krátké." };

  const key = `guest-register:${await clientIp()}`;
  if (!checkRateLimit(key, REGISTER_MAX, REGISTER_WINDOW_MS)) {
    return { ok: false, error: "Příliš mnoho pokusů. Zkuste to později." };
  }

  let userId: number;
  try {
    ({ userId } = registerGuestWithInvite(token, {
      provider: "password",
      email,
      name: jmeno,
      password,
      departmentId: deptId,
    }));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Registraci se nepodařilo dokončit.",
    };
  }

  try {
    await sendVerificationEmail(userId, appBaseUrl());
  } catch {
    // Účet existuje; nefunkční SMTP registraci neshodí.
  }

  try {
    const { token: sessionToken, expiresAt } = createSession(userId, {
      persistent: false,
      userAgent: (await headers()).get("user-agent") ?? undefined,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions(false, expiresAt));
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Propojení Google účtu ────────────────────────────────────────────────────

/**
 * Dokončí propojení Googlu s existujícím heslovým účtem (R6).
 *
 * E-mail, `subject` ani jméno se **neberou z formuláře** — jsou v podepsané
 * cookie, kterou vystavil callback po ověřeném přihlášení u Googlu. Z formuláře
 * jde jen heslo. Kdyby se profil bral z klienta, stačilo by poslat cizí e-mail
 * a Google by si přivlastnil cizí účet.
 *
 * Samotná shoda e-mailu nestačí — kdo chce k účtu připojit Google, musí nejdřív
 * prokázat, že účet je jeho.
 */
export async function actionConfirmGoogleLink(
  password: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const VYPRSELO = {
    ok: false as const,
    error: "Propojení vypršelo. Zkuste přihlášení přes Google znovu.",
  };

  const store = await cookies();
  const sealed = store.get(GOOGLE_LINK_COOKIE)?.value;
  if (!sealed) return VYPRSELO;

  const pending = readPendingGoogleLink(sealed);
  if (!pending) return VYPRSELO;

  if (typeof password !== "string" || !password) {
    return { ok: false, error: BAD_CREDENTIALS };
  }

  const key = `google-link:${await clientIp()}`;
  if (isRateLimited(key, LOGIN_MAX_FAILURES)) {
    return { ok: false, error: "Příliš mnoho pokusů. Zkuste to znovu za chvíli." };
  }

  const user = authenticateWithPassword(pending.email, password);
  if (!user) {
    checkRateLimit(key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
    return { ok: false, error: BAD_CREDENTIALS };
  }

  try {
    linkGoogleIdentity(user.id, pending.subject);

    const { token, expiresAt } = createSession(user.id, {
      persistent: false,
      userAgent: (await headers()).get("user-agent") ?? undefined,
    });
    store.set(SESSION_COOKIE, token, getSessionCookieOptions(false, expiresAt));
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    return { ok: false, error: "Propojení se nepodařilo dokončit." };
  }

  // Čekající stav už není k čemu — uklidit hned, ne až vyprší.
  store.set(GOOGLE_LINK_COOKIE, "", { path: "/", maxAge: 0 });
  revalidatePath("/", "layout");
  return { ok: true };
}
