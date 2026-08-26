import { cookies } from "next/headers";
import { getDb } from "../db";
import { AuthError } from "./errors";
import { PIN_COOKIE, verifyPinProof } from "./pin-gate";
import {
  isBlockedSessionToken,
  readSession,
  SESSION_COOKIE,
  type SessionInfo,
} from "./sessions";

const NOT_SIGNED_IN = "Pro tuto akci se nejdřív přihlaste.";

function activeAdminExists(): boolean {
  return Boolean(
    getDb()
      .prepare("SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1")
      .get()
  );
}

async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSession(): Promise<SessionInfo | null> {
  const token = await getSessionToken();
  return token ? readSession(token) : null;
}

export async function requireSession(): Promise<SessionInfo> {
  const token = await getSessionToken();
  if (!token) throw new AuthError("NEPRIHLASEN", NOT_SIGNED_IN);

  const session = readSession(token);
  if (session) {
    // Účet bez správce nesmí otevřít zapisovací provoz jen tím, že se někdo
    // veřejně zaregistruje. Obnovu provádí výhradně bootstrap z prostředí.
    if (!activeAdminExists()) {
      throw new AuthError(
        "JEN_SPRAVCE",
        "Aplikace nemá aktivního správce. Obraťte se na provozovatele."
      );
    }
    return session;
  }
  if (isBlockedSessionToken(token)) {
    throw new AuthError("BLOKOVAN", "Tento účet je zablokovaný. Obraťte se na správce.");
  }
  throw new AuthError("NEPRIHLASEN", NOT_SIGNED_IN);
}

export async function requireAdmin(): Promise<SessionInfo> {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new AuthError("JEN_SPRAVCE", "Tuto akci může provést jen správce.");
  }
  return session;
}

export async function requireAdminWithPin(): Promise<SessionInfo> {
  const session = await requireAdmin();
  const store = await cookies();
  if (!verifyPinProof(store.get(PIN_COOKIE)?.value, session)) {
    throw new AuthError(
      "VYZADOVAN_PIN",
      "Pro tuto citlivou akci znovu potvrďte správcovský PIN."
    );
  }
  return session;
}

export async function assertCanEditRow(session: SessionInfo, rowId: number): Promise<void> {
  if (!Number.isSafeInteger(rowId) || rowId <= 0) {
    throw new AuthError("CIZI_ZAZNAM", "Tento záznam nelze upravit.");
  }

  const row = getDb()
    .prepare("SELECT person_id AS personId FROM order_rows WHERE id = ?")
    .get(rowId) as { personId: number | null } | undefined;
  if (!row) throw new AuthError("CIZI_ZAZNAM", "Tento záznam nelze upravit.");
  if (session.role === "admin") return;
  if (row.personId !== null && session.personIds.includes(row.personId)) return;

  throw new AuthError("CIZI_ZAZNAM", "Tento záznam patří jinému strávníkovi.");
}

export async function assertCanActAsPerson(
  session: SessionInfo,
  personId: number
): Promise<void> {
  if (
    !Number.isSafeInteger(personId) ||
    personId <= 0 ||
    !getDb().prepare("SELECT 1 FROM people WHERE id = ?").get(personId)
  ) {
    throw new AuthError("CIZI_ZAZNAM", "Za tohoto strávníka nelze objednávat.");
  }
  if (session.role === "admin" || session.personIds.includes(personId)) return;
  throw new AuthError("CIZI_ZAZNAM", "Za tohoto strávníka nemůžete objednávat.");
}
