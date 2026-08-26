import { createHmac, timingSafeEqual } from "node:crypto";
import { getSettings } from "../settings";

/**
 * Doklad o zadaném PINu — zadní vrátka do Nastavení bez správcovského účtu.
 *
 * **Vědomá odchylka od R12**, které chtělo PIN až jako druhý krok po přihlášení.
 * Důvod je provozní: kdyby se přihlašování rozbilo, je tohle jediná cesta zpět —
 * a bez Nastavení nejde spravit ani SMTP, přes které se obnovuje heslo. Bez
 * vrátek by šla appka zamknout tak, že by ji nešlo odemknout.
 *
 * Cena je reálná a nemá se zlehčovat: na veřejné adrese stačí uhodnout PIN
 * a člověk si stáhne zálohu celé databáze. Proto je doklad krátkodobý, vázaný
 * na PIN (změna PINu ho zneplatní) a jeho použití se zapisuje do auditu.
 *
 * Není to sezení: nenese uživatele, nedá se z něj zjistit, kdo to byl, a na nic
 * kromě Nastavení neplatí.
 */

export const PIN_COOKIE = "kantyna_pin";

/** Půl hodiny — dost na proklikání nastavení, málo na zapomenutý mobil. */
const PLATNOST_MS = 30 * 60 * 1000;

/**
 * Klíč k podpisu.
 *
 * Přednost má vyhrazený `COOKIE_SIGNING_SECRET`. Když nastavený není, použije
 * se uložený otisk PINu — ten je vždycky po ruce a má vedlejší užitečnou
 * vlastnost: změna PINu podpis zneplatní. Kdo má přístup k databázi, má stejně
 * všechno, takže se tím nic nového neodkrývá.
 */
function podpisovyKlic(): string {
  const secret = process.env.COOKIE_SIGNING_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : `pin:${getSettings().settingsPin}`;
}

function podepsat(payload: string): string {
  return createHmac("sha256", podpisovyKlic()).update(payload).digest("base64url");
}

export function vystavPinDoklad(): string {
  const platiDo = String(Date.now() + PLATNOST_MS);
  return `${platiDo}.${podepsat(platiDo)}`;
}

export function jePinDokladPlatny(value: string | undefined): boolean {
  if (!value) return false;

  const tecka = value.indexOf(".");
  if (tecka <= 0) return false;

  const platiDo = value.slice(0, tecka);
  const podpis = value.slice(tecka + 1);
  if (!/^\d+$/.test(platiDo) || Number(platiDo) < Date.now()) return false;

  const ocekavany = Buffer.from(podepsat(platiDo));
  const dorucen = Buffer.from(podpis);
  return ocekavany.length === dorucen.length && timingSafeEqual(ocekavany, dorucen);
}

export function pinCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: PLATNOST_MS / 1000,
  };
}
