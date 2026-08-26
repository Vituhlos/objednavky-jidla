import { getRowOwner } from "../orders";
import { getPerson } from "../people";
import { AuthError } from "./errors";
import { assertCanEditRow } from "./guards";
import type { SessionInfo } from "./sessions";
import { listUsers } from "./users";

/**
 * Pravidla, která stojí nad guardy z `guards.ts`.
 *
 * Guardy odpovídají na otázku „smí tahle session na tenhle záznam". Tady je
 * navíc to, co plyne z chování aplikace: že nový řádek chvíli nikomu nepatří
 * a že jméno v řádku není volný text, ale volba mezi vlastními strávníky.
 */

/**
 * Dokud v databázi není žádný aktivní správce, běží aplikace v předúčtovém
 * režimu a zápisy se nezamykají.
 *
 * Bez téhle výjimky by nasazení bez nastavených `ADMIN_EMAIL` a `ADMIN_PASSWORD`
 * zamklo objednávky i Nastavení a dovnitř by se nedostal nikdo. Zadní vrátka to
 * nejsou: jakmile první správce vznikne, výjimka zmizí a vrátit se nemůže —
 * posledního aktivního správce nejde zablokovat, degradovat ani smazat.
 */
let enabledCache = false;

export function accountsEnabled(): boolean {
  if (enabledCache) return true; // přechod je jednosměrný, stačí zjistit jednou
  enabledCache = listUsers().some((u) => u.role === "admin" && u.status === "active");
  return enabledCache;
}

/** Typ z klienta není kontrola — id ověř za běhu, než se podle něj rozhodne. */
export function assertId(value: unknown, co: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new AuthError("CIZI_ZAZNAM", `Neplatné ${co}.`);
  }
  return value as number;
}

/**
 * Smí session zapsat do řádku?
 *
 * Vedle vlastníka a správce pouští i řádek, který ještě nikomu nepatří — ten si
 * smí přivlastnit kdokoli přihlášený, ale jen vlastním jménem (viz
 * `assertNameIsOwn`). Bez toho by nešlo objednat: nový řádek vzniká prázdný
 * a strávníka dostane až vyplněním jména, takže by ho `assertCanEditRow`
 * odmítl i tomu, kdo si ho právě založil.
 *
 * Neexistující řádek se odmítá vždy.
 */
export async function assertMayEditRow(session: SessionInfo, rowId: number): Promise<void> {
  if (session.role === "admin") return;

  const owner = getRowOwner(rowId);
  if (!owner.exists) throw new AuthError("CIZI_ZAZNAM", "Tento záznam nelze upravit.");
  if (owner.personId === null) return;

  await assertCanEditRow(session, rowId);
}

/**
 * Uživatel smí do řádku napsat jen jméno svého strávníka nebo svého hosta (R8).
 *
 * Volné jméno by založilo strávníka, za kterého objednávat nesmí — a ten řádek
 * by pak nemohl upravit ani on sám. Správce zapisuje kohokoli, protože podle
 * pravidel opravuje i cizí objednávky.
 */
export async function assertNameIsOwn(
  session: SessionInfo,
  personName: unknown
): Promise<void> {
  if (session.role === "admin") return;
  if (typeof personName !== "string") {
    throw new AuthError("CIZI_ZAZNAM", "Neplatné jméno.");
  }

  const wanted = personName.trim();
  if (!wanted) return; // vyprázdnit jméno smí každý, kdo na řádek dosáhne

  const own = session.personIds.map((id) => getPerson(id)?.name.trim());
  if (own.includes(wanted)) return;

  throw new AuthError("CIZI_ZAZNAM", "Objednávat můžete jen za sebe a za své hosty.");
}
