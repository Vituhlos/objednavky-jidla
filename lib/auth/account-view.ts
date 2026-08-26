import { getSession } from "./guards";
import { getUserById } from "./users";

/**
 * Co o přihlášeném člověku ví klient.
 *
 * Vědomě neobsahuje žádné id, token ani otisk. UI potřebuje jméno, roli a to,
 * jestli člověk objednává i za někoho dalšího — nic víc. Kdyby se sem přidalo
 * `userId`, dřív nebo později by se poslalo do klientské komponenty a začalo
 * by se podle něj rozhodovat na straně, kde rozhodovat nejde.
 */
export interface AccountView {
  name: string;
  email: string;
  role: "admin" | "user";
  emailVerified: boolean;
  /** Kolik strávníků účet zastupuje — přepínač „objednávám za“ má smysl od dvou. */
  personCount: number;
}

export async function getAccountView(): Promise<AccountView | null> {
  const session = await getSession();
  if (!session) return null;

  const user = getUserById(session.userId);
  if (!user) return null;

  return {
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    personCount: user.personIds.length,
  };
}
